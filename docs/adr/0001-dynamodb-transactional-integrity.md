# ADR-0001: DynamoDB Multi-Table Design with Transactional Integrity

**Status:** Accepted

## Context

The whole reason this project exists is that Excel cannot safely handle concurrent
registrations: two people can register for the last seat at the same moment, both see
"success," and the event ends up overbooked. Any replacement needs an access pattern
that makes overbooking and duplicate registrations *structurally* impossible, not just
"unlikely."

We also need: a public "list published events" query without scanning the whole table,
an admin "list all registrants for this event" query, and a way to avoid double
registration for the same event+email.

## Decision

Two DynamoDB tables, both on-demand billing with Point-in-Time Recovery:

- **`events`** -- PK `eventId`. GSI `StatusStartDateIndex` (PK `status`, SK
  `startDateTime`) serves the public listing query without a Scan.
- **`registrations`** -- PK `PK`, which holds either a real `registrationId` (UUID) for
  an actual registration record, or a string `LOCK#{eventId}#{email}` for a *uniqueness
  lock item*. GSI `EventIndex` (PK `eventId`, SK `registeredAt`) serves the admin
  registrant list; GSI `EmailIndex` (PK `attendeeEmail`, SK `registeredAt`) serves
  attendee-by-email lookups. Lock items have neither `registeredAt` nor
  `attendeeEmail`-as-GSI-key populated in a way that satisfies either GSI's key schema,
  so they never appear in either index -- no extra filtering needed there.

Registering is one `TransactWriteItems` call with three items:

1. **Put** the lock item, condition `attribute_not_exists(PK)`. If this attendee already
   registered for this event, the condition fails -- duplicate blocked, atomically.
2. **Put** the registration record itself.
3. **Update** the event's `registeredCount = registeredCount + 1`, condition
   `registeredCount < capacity AND status = PUBLISHED`. If the event is already full (or
   no longer published), this fails -- overbooking blocked, atomically, even if a
   thousand people click "Register" in the same second.

All three succeed or all three roll back -- there is no window where a registration
exists without a capacity increment, or vice versa.

Cancelling reverses all three effects, also as one transaction: mark the registration
`CANCELLED` (condition: was `CONFIRMED`), delete the lock item (condition: it still
points at *this* registration, guarding against a rare re-registration race), and
decrement `registeredCount`. Deleting the lock item is what lets the same attendee
register again later.

DynamoDB Streams (`NEW_IMAGE`) on `registrations` feed the async notification function
(see ADR-0003), filtered to `INSERT` + `type = REGISTRATION` so lock-item writes never
trigger it.

## Consequences

- Overbooking and duplicate registration are prevented by DynamoDB's own conditional
  writes, not application-level locking or "check then write" logic that races.
- We deliberately do **not** alarm on DynamoDB's `ConditionalCheckFailed` metric --
  duplicate/sold-out attempts trigger it as a matter of normal, expected operation, and
  alarming on it would page someone every time an event is popular. `RegistrationFailed`
  (an application-level EMF metric with a `reason` dimension) is the correct signal
  instead -- see `docs/adr/0005-compute-and-cost-choices.md` and
  `infrastructure/stacks/monitoring_stack.py`.
- The lock-item pattern is a well-known DynamoDB idiom, but it does mean the
  `registrations` table holds two different "shapes" of item under one partition key
  scheme -- documented here and in `docs/data-model.md` so it isn't mistaken for a bug.
- Both tables use `RemovalPolicy.RETAIN`: this is real registrant data, and a `cdk
  destroy` must not silently delete it.
