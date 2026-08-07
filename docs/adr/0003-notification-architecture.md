# ADR-0003: SES + SNS Split, and Async Delivery via DynamoDB Streams

**Status:** Accepted

## Context

The architecture brief calls for "confirmation emails," with SNS explicitly named as
(optional) infrastructure. Two things needed deciding: which AWS service actually sends
the attendee-facing confirmation email, and whether that send happens synchronously
inside the registration request or is decoupled from it.

**Why not SNS for the attendee email:** SNS email subscriptions require the recipient to
click a confirmation link *before* the topic can ever deliver to them. That's fine for a
fixed, known set of subscribers (a team's ops inbox) but cannot work for "email this
one-off ticket to whatever address a stranger just typed into a form." SES, by contrast,
is designed to send transactional email to arbitrary recipients.

**Why not send synchronously from `register_for_event`:** SES is an external network
call. If it's slow, or briefly rejects a message (very likely early on, since new SES
accounts start in **sandbox mode** and can only send to *verified* addresses until
production access is requested), that failure would leak into the attendee's
registration API call -- their seat could fail to reserve, or the response could hang,
because of an email problem, not a booking problem.

## Decision

Split by responsibility, not by "email vs. everything else":

- **SES** sends the attendee-facing confirmation email (with the QR ticket embedded
  inline via a `Content-ID` MIME part -- see ADR-0004), because it is the correct tool
  for one-off transactional email to an arbitrary address.
- **SNS** carries operational notifications to the team: "new registration for event X,"
  and every CloudWatch alarm defined in `MonitoringStack`. It is not attendee-facing.

Delivery is decoupled from the registration request via DynamoDB Streams: `NEW_IMAGE`
INSERT events on `registrations` (filtered to `type = REGISTRATION`) invoke
`notify_on_registration`, which sends the SES email and publishes the SNS message. The
synchronous API response never waits on either.

Reliability is handled at the event-source-mapping level, not by swallowing errors in
code: `retry_attempts=3`, `bisect_batch_on_error=True`, and an SQS dead-letter queue on
failure (`infrastructure/stacks/api_stack.py`). A persistent SES rejection (e.g., a
recipient who isn't verified while the account is still in sandbox mode) retries a
bounded number of times and then lands in the DLQ for inspection -- it cannot stall the
stream or silently vanish.

## Consequences

- Registration succeeds or fails purely on the DynamoDB transaction outcome; email
  delivery can never be the reason a seat reservation fails.
- New deployments must manually verify the SES sender identity (and, while in sandbox
  mode, each test recipient) before real email delivery works -- documented in
  `docs/deployment.md`. This is an AWS account-level restriction, not something CDK can
  automate away.
- This adds real moving parts (a stream, an event source mapping, a DLQ) that a naive
  "just call `ses.send_email()` inline and hope for the best" implementation wouldn't
  have. Given the explicit goal of demonstrating event-driven AWS patterns, and that the
  failure mode being guarded against (SES sandbox rejection) is not hypothetical, this is
  judged worth the added complexity.
