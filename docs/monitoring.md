# Monitoring & Runbook

Everything below is provisioned by `infrastructure/stacks/monitoring_stack.py`. All
alarm actions publish to the ops SNS topic (`event-ticketing-ops-alerts`), which
`NotificationsStack` subscribes `adminAlertEmail` to.

## Dashboard

`event-ticketing-operations` (CloudWatch console -> Dashboards) shows:

- API request volume (total count, 4xx, 5xx).
- API 5xx error rate (%), the same metric math the alarm below uses.
- Lambda invocations, per function.
- Lambda p99 duration, per function.
- `RegistrationSucceeded` vs `RegistrationFailed` (the application-level EMF metrics
  emitted by `register_for_event`).

## Alarms

| Alarm | Condition | Why it's tuned this way |
|---|---|---|
| `ApiErrorRateAlarm` | 5xx / total requests > 5%, in 2 of the last 3 five-minute periods | A flat "> 5%" check on raw counts would trip on a single failed request when traffic is near zero. Requiring 2-of-3 breaching periods, and treating missing data as healthy (`NOT_BREACHING`), keeps this meaningful at low volume instead of paging on every cold-start hiccup. |
| `<Function>ErrorsAlarm` (x10) | >= 1 error in a 5-minute period, 1 of 2 periods | One per Lambda function; catches unhandled exceptions specifically, independent of API-level error rate. |
| `<Function>DurationAlarm` (x10) | p99 duration > 80% of that function's configured timeout, 2 of 3 periods | Early warning before a function starts actually timing out under load. |
| `EventsTableThrottleAlarm` / `RegistrationsTableThrottleAlarm` | Any throttled request across the read/write/query/transaction operations this app uses | On-demand billing makes sustained throttling unlikely, but a burst (e.g. a very popular event opening registration) could still hit a brief adaptive-capacity limit. |
| `RegistrationFailedSpikeAlarm` | > 5 `RegistrationFailed` (any reason) in a 5-minute period, 2 of 2 periods | The explicit "track failed registrations" requirement -- catches a spike distinct from generic 5xx/errors, since most registration failures (duplicate, sold out) are expected `409`s, not errors. |

**Deliberately not alarmed on:** DynamoDB `ConditionalCheckFailedRequests`. In this
system, that metric increments on every duplicate-registration attempt and every
sold-out attempt -- both completely normal outcomes of a popular event, not failures of
the system. See [ADR-0001](adr/0001-dynamodb-transactional-integrity.md).

## Custom metrics (namespace `EventTicketing`)

Emitted via AWS Lambda Powertools (`common/observability.py`), EMF format:

- `RegistrationSucceeded` -- count, no dimensions.
- `RegistrationFailed` -- count, dimension `reason` ∈ `DUPLICATE_REGISTRATION` \|
  `EVENT_SOLD_OUT` \| `EVENT_NOT_PUBLISHED` \| `REGISTRATION_CLOSED` \|
  `VALIDATION_ERROR` \| `NOT_FOUND`.
- Powertools' built-in cold-start metric, per function.

## Logs and tracing

Every function writes structured JSON logs (Powertools `Logger`) to its own CloudWatch
Log Group (`RetentionDays.TWO_WEEKS` -- long enough to debug an incident, short enough
to stay cheap). X-Ray tracing is active on every function (`Tracer`), so a slow request
can be traced end-to-end including its DynamoDB/S3/SES/SNS calls.

## Runbook: alarm fired, now what?

**`ApiErrorRateAlarm`** -- Check the dashboard's "Lambda invocations/errors by function"
widget to see which function is actually failing, then that function's CloudWatch Logs
(structured JSON, so `errorCode`/`message` fields are directly searchable) for the
specific exception.

**`<Function>ErrorsAlarm`** -- Same function's log group, filter on
`level = "ERROR"` or the `unhandled_error` log message emitted by
`common/middleware.py`'s catch-all. If it's `notify_on_registration`, also check the
`NotifyOnRegistrationDlq` SQS queue depth -- a persistent SES/SNS failure lands there
after 3 retries rather than looping forever.

**`<Function>DurationAlarm`** -- Check X-Ray traces for that function around the alarm
time; look for a slow downstream call (DynamoDB, S3, SES) rather than assuming the
function's own code regressed.

**`RegistrationFailedSpikeAlarm`** -- Look at the `reason` dimension on the metric
(CloudWatch console -> Metrics -> `EventTicketing` -> `RegistrationFailed`, break down
by `reason`). A spike of `EVENT_SOLD_OUT` is good news (a popular event); a spike of
`VALIDATION_ERROR` might mean the frontend and backend have drifted out of sync on the
registration form's shape.

**Table throttle alarms** -- Check whether a single event's opening moment caused a
burst far beyond normal traffic; DynamoDB on-demand adapts within minutes, so a
throttle alarm is usually informational rather than actionable, unless it persists.
