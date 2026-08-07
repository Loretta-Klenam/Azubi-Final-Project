# Cost and Free Tier

## Expected cost at this project's scale

Every compute-adjacent service used here has a perpetual AWS Free Tier allotment (not a
12-month trial one), and this project's traffic pattern -- idle between events, a burst
during registration windows -- sits comfortably inside those limits for a small-to-
medium event program:

| Service | Free Tier (perpetual, per month) | This project's usage pattern |
|---|---|---|
| Lambda | 1M requests, 400,000 GB-seconds compute | ARM64 + 256MB memory; a few thousand invocations per event is nowhere close to this. |
| API Gateway (REST) | 1M requests (first 12 months only) | After 12 months, REST API is ~$3.50/million requests -- still negligible at this scale. |
| DynamoDB | 25GB storage, 25 WCU/RCU provisioned-equivalent | On-demand billing here; at low request volume this is pennies. |
| S3 | 5GB storage, 20,000 GET / 2,000 PUT (first 12 months) | QR images are a few KB each; the SPA build is a few hundred KB. |
| CloudFront | 1TB data transfer out, 10M requests (first 12 months) | Far beyond what a small event site needs. |
| Cognito | 50,000 MAUs | This project has a handful of admin users, not attendees (attendees never authenticate). |
| SES | 62,000 emails/month when sent from a Lambda-invoked account | One email per registration. |
| SNS | 1M publishes, 1,000 email notifications | Ops alerts only, not per-attendee. |
| CloudWatch | 10 custom metrics, 5GB log ingestion, 3 dashboards | This project defines ~25 alarms and 2 custom metrics -- see the note below. |

**Note on CloudWatch alarms specifically:** the Free Tier covers 10 alarms; this project
defines roughly one per Lambda function (errors + duration, x2 x10 functions) plus a
handful of table/API/application alarms -- more than 10. At current CloudWatch pricing
(~$0.10/alarm/month for standard alarms), the excess is on the order of $1-2/month, not
a meaningful cost, but it is the one line item in this stack that isn't fully free.

## AWS Budgets (this project's automated guardrail)

`MonitoringStack` provisions a monthly `AWS::Budgets::Budget` (`budgetLimitUsd` context
value, default **$5**) with email notifications at:

- **80% of actual spend** -- an early warning while there's still room to investigate.
- **100% of forecasted spend** -- AWS's own month-end cost projection, so you find out
  *before* the month ends, not after.

Both notify `adminAlertEmail` directly (Budgets supports email notification
subscribers natively, no SNS topic required for this one).

## Manual step: enable account-level Free Tier alerts

AWS also offers "Free Tier usage alerts" as an account **billing preference** -- these
warn specifically when a Free-Tier-eligible service's usage approaches its limit (e.g.,
"80% of your Lambda free tier used"), which is a different, complementary signal to the
dollar-based Budget above. This is **not** a CloudFormation/CDK-manageable resource; it's
a one-time manual step:

1. Console -> Billing and Cost Management -> Billing preferences.
2. Enable "Receive Free Tier Usage Alerts" and confirm the notification email.

## Cost-conscious design choices already baked in

- **ARM64 (Graviton2) Lambdas** -- ~20% cheaper than x86 for identical workloads.
- **DynamoDB on-demand** -- no idle provisioned-capacity cost between events.
- **Two shared Lambda Layers instead of per-function bundling** -- smaller deployment
  packages, faster cold starts, less S3 storage for Lambda code assets.
- **CloudWatch Log retention capped at 14 days** -- long enough to debug an incident,
  short enough not to accumulate storage cost indefinitely.
- **S3 lifecycle rule** expiring ticket QR images after 365 days.

See [ADR-0005](adr/0005-compute-and-cost-choices.md) for the full reasoning behind the
compute and packaging choices.
