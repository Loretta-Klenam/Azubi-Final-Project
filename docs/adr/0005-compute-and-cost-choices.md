# ADR-0005: Compute, Packaging, and Cost Choices

**Status:** Accepted

## Context

Several smaller, independent decisions all point the same direction -- keep this
comfortably inside the AWS Free Tier while staying idiomatic CDK -- and are grouped here
rather than spread across one-line comments.

## Decisions

**REST API Gateway, not HTTP API.** The brief's architecture diagram specifies "API
Gateway (REST Endpoints)" explicitly, and REST API's `CognitoUserPoolsAuthorizer` and
per-stage `MethodOptions` (used for the `/admin/*` authorization split) are a direct,
well-documented fit. HTTP API (API Gateway v2) is cheaper per-request and supports JWT
authorizers too, and would be the better choice if this were being optimized purely for
cost/latency at higher volume -- noted here as the natural next step if traffic ever
justified it.

**Lambda on ARM64 (Graviton2), Python 3.12.** Graviton pricing is roughly 20% cheaper
than x86 for the same memory/duration, with no code changes required for pure-Python
workloads (the only compiled dependency, Pillow, publishes `manylinux...aarch64` wheels,
so ARM64 bundling works without extra configuration).

**DynamoDB on-demand billing (`PAY_PER_REQUEST`), not provisioned capacity.** Registration
traffic for an event is inherently spiky -- near zero between events, a burst when
registration opens -- which is the textbook case on-demand billing is priced for, and it
avoids capacity-planning entirely for a system this small.

**Lambda packaging: two shared Layers, not per-function dependency bundling.** A `common`
Layer (`aws-lambda-powertools`, `pydantic`, and this project's own shared `common/`
package: models, DynamoDB helpers, error/response formatting) is attached to all ten
functions. A second `ticketing` Layer (`qrcode`, `Pillow`) is attached **only** to
`register_for_event` -- the one function that actually generates a QR image -- so every
other function's cold start stays free of an imaging library it never imports. Function
code itself ships as a plain zip asset with no dependencies of its own, so only the two
Layers need Docker-based `pip install` bundling (`aws_lambda_python_alpha.
PythonLayerVersion`), keeping CI fast.

**Structured observability via AWS Lambda Powertools.** `Logger` (structured JSON logs),
`Tracer` (X-Ray), and `Metrics` (EMF custom metrics -- `RegistrationSucceeded`,
`RegistrationFailed{reason}`) are used instead of hand-rolled logging, satisfying the
"track request count, failed registrations, duration" requirement without bespoke
plumbing. See `backend/layers/common/common/observability.py` and `middleware.py`.

**cdk-nag was evaluated and deliberately left disabled for now.** `AwsSolutionsChecks`
(cdk-nag 3.0.2) was wired in as an `Aspect` for automated security-best-practice linting
on every `cdk synth`, but its published jsii assembly is incompatible with the
`aws-cdk-lib` release this project pins (2.263.0): applying the aspect raises a jsii
`RuntimeError` (`aspectApplication.aspect.visit is not a function`) at synth time,
reproduced identically after pinning `aws-cdk-lib` back to cdk-nag's own declared floor
version (2.257.0), which points to a genuine cross-release compatibility gap rather than
a version-pinning mistake in this project. Least-privilege IAM is instead verified
directly: every `.grant(...)` in `api_stack.py` names specific actions on a specific
resource (see `docs/adr/0001...` and the codebase), and
`infrastructure/tests/test_api_stack.py::test_no_iam_wildcard_resources_outside_xray_and_streams`
asserts, on every test run, that no IAM statement uses a wildcard resource except the
handful of AWS actions (`xray:PutTelemetryRecords`, `xray:PutTraceSegments`,
`dynamodb:ListStreams`) that AWS itself does not support scoping to a specific ARN.
Re-enabling cdk-nag is a tracked follow-up once the two libraries' releases catch up to
each other.

## Consequences

- All of the above are individually reversible and none are load-bearing on each other:
  switching to HTTP API, provisioned DynamoDB capacity, or x86 Lambdas would each be a
  localized change.
- The Layer-splitting strategy means adding a new function's dependencies requires a
  conscious choice of "does this belong in `common` (everyone needs it) or does it need
  its own Layer (only one or two functions need it)" -- documented here so that choice
  isn't made accidentally.
