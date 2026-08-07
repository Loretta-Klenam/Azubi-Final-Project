# Data Model

Two DynamoDB tables, both `PAY_PER_REQUEST` billing with Point-in-Time Recovery enabled.
See [ADR-0001](adr/0001-dynamodb-transactional-integrity.md) for the reasoning behind the
transactional design; this doc is the schema reference.

```mermaid
erDiagram
    EVENTS {
        string eventId PK
        string title
        string description
        string venue
        string startDateTime
        string endDateTime
        number capacity
        number registeredCount
        string status "DRAFT | PUBLISHED | CANCELLED"
        string createdBy
        string createdAt
        string updatedAt
    }

    REGISTRATIONS {
        string PK "registrationId OR LOCK#eventId#email"
        string type "REGISTRATION | LOCK"
        string registrationId
        string eventId FK
        string attendeeName
        string attendeeEmail
        string confirmationCode
        string status "CONFIRMED | CANCELLED"
        string ticketS3Key
        string registeredAt
        string cancelledAt
    }

    EVENTS ||--o{ REGISTRATIONS : "eventId (GSI: EventIndex)"
```

## `events`

| Attribute | Type | Notes |
|---|---|---|
| `eventId` (PK) | String (UUID) | |
| `title`, `description`, `venue` | String | Length-validated on input (`common/models.py`). |
| `startDateTime`, `endDateTime` | String (ISO 8601) | `endDateTime` must be after `startDateTime`. |
| `capacity` | Number | 1-100,000. |
| `registeredCount` | Number | Maintained only via the register/cancel transactions -- never set directly by an admin edit. |
| `status` | String | `DRAFT` \| `PUBLISHED` \| `CANCELLED`. Only `PUBLISHED` events are visible to unauthenticated callers. |
| `createdBy` | String | Cognito `sub` of the admin who created it. |
| `createdAt`, `updatedAt` | String (ISO 8601) | |

**GSI `StatusStartDateIndex`** -- PK `status`, SK `startDateTime`. Serves:
`GET /events` (public, forced to `status=PUBLISHED`) and `GET /admin/events?status=...`
(admin, any status), both sorted chronologically without a table Scan.

## `registrations`

A single table holds two different item shapes, distinguished by `type`:

**`type = REGISTRATION`** (the real record):

| Attribute | Type | Notes |
|---|---|---|
| `PK` | String | Equal to `registrationId`. |
| `registrationId` | String (UUID) | |
| `eventId` | String | |
| `attendeeName`, `attendeeEmail` | String | |
| `confirmationCode` | String | 8-char, unambiguous alphabet (no `0/O/1/I/L`), acts as a capability token for the public ticket-lookup/cancel endpoints. |
| `status` | String | `CONFIRMED` \| `CANCELLED`. |
| `ticketS3Key` | String | S3 key of the generated QR PNG. |
| `registeredAt`, `cancelledAt` | String (ISO 8601) | |

**`type = LOCK`** (uniqueness marker, no attendee-facing meaning):

| Attribute | Type | Notes |
|---|---|---|
| `PK` | String | `LOCK#{eventId}#{email, lowercased}`. |
| `eventId`, `attendeeEmail`, `registrationId` | String | `registrationId` points at the owning REGISTRATION item. |
| `createdAt` | String (ISO 8601) | |

**GSI `EventIndex`** -- PK `eventId`, SK `registeredAt`. Admin "list registrants for this
event," paginated, most recent first. LOCK items have no `registeredAt`, so DynamoDB
excludes them from this index's projection automatically -- no application-side
filtering needed.

**GSI `EmailIndex`** -- PK `attendeeEmail`, SK `registeredAt`. Support/admin "find this
attendee's registrations by email." **Not** used for duplicate-registration prevention --
that's the LOCK item transaction, which is atomic; a GSI read-then-check would
reintroduce the exact race it's meant to prevent.

## Why a "lock item" instead of a unique-constraint GSI

DynamoDB has no native unique-secondary-index constraint. The standard idiom for
"exactly one item may exist for this composite key" is: put a small marker item whose
primary key *is* that composite key, with a `ConditionExpression:
attribute_not_exists(PK)`. Bundled into the same `TransactWriteItems` call as the actual
registration write and the capacity-check update, this makes "this email hasn't already
registered for this event" and "there's still capacity" both atomic, all-or-nothing
guarantees -- not two separate reads-then-writes that could race.

## DynamoDB Streams

`registrations` has a stream (`NEW_IMAGE`) feeding `notify_on_registration`. The event
source mapping filters to `eventName = INSERT` and `dynamodb.NewImage.type.S =
REGISTRATION`, so LOCK item inserts (which happen on every successful registration, as
part of the same transaction) never trigger a spurious notification.
