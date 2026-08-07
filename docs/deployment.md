# Deployment Guide

## Prerequisites

- An AWS account (a fresh/free-tier account is fine to start with).
- AWS CLI v2, configured with credentials that can create the resources in this stack
  (`aws configure` or an SSO profile).
- Node.js 20+ (for the AWS CDK CLI: `npm install -g aws-cdk`) and npm.
- Python 3.12.
- **Docker, running.** The two Lambda Layers (`common`, `ticketing`) are built by
  installing their `requirements.txt` inside a Lambda-compatible container
  (`aws_lambda_python_alpha.PythonLayerVersion`), and CDK needs to do this on every
  `cdk synth`, not just on deploy, because the resulting asset hash is part of the
  synthesized template.

## One-time: `cdk bootstrap`

Every AWS account+region combination this is deployed into needs to be CDK-bootstrapped
once:

```bash
cd infrastructure
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cdk bootstrap aws://<account-id>/<region>
```

## Required configuration (CDK context)

Two values have no safe default and must be supplied on every `cdk synth`/`cdk deploy`,
via `-c key=value`:

| Context key | Meaning |
|---|---|
| `adminAlertEmail` | Where CloudWatch alarm notifications and AWS Budgets alerts are sent (an SNS email subscription). |
| `sesSenderEmail` | The "From" address for attendee confirmation emails. Must be verified in SES before it can actually send (see below). |

Optional: `budgetLimitUsd` (default `5`), `region` (default `us-east-1`), `account`.

`config.py` raises a clear error naming the missing key if either required value is
omitted -- this is intentional, so a misconfigured deploy fails fast with an actionable
message instead of deploying something half-wired.

## Manual deploy

```bash
ADMIN_ALERT_EMAIL=you@example.com SES_SENDER_EMAIL=noreply@example.com ./scripts/deploy.sh
```

This runs `cdk deploy --all`, extracts the API/Cognito outputs into
`frontend/.env.production`, builds the frontend, syncs it to the `FrontendStack` S3
bucket, and invalidates the CloudFront distribution. It's exactly what
`.github/workflows/deploy.yml` automates for every push to `main`.

## Verifying the SES sender identity (required before real emails send)

A brand-new AWS account's SES is in **sandbox mode**: it can only send to (and, for some
checks, from) verified identities, and daily/rate limits are low. `NotificationsStack`
creates an `EmailIdentity` resource for `sesSenderEmail`, but **verification itself is a
manual step** -- AWS emails a confirmation link to that address, which cannot be
automated via CloudFormation:

1. Check the inbox for `sesSenderEmail` after the first deploy; click AWS's
   verification link.
2. While still in sandbox mode, *recipients* must also be verified individually (Console
   -> SES -> Verified identities -> Create identity) to actually receive test emails --
   fine for development, not for real attendees.
3. To send to arbitrary attendee addresses in production, request SES production access
   (Console -> SES -> Account dashboard -> "Request production access"; typically
   approved within a day, no cost).

If an attendee's confirmation email fails to send (e.g., still in sandbox mode and their
address isn't verified), the registration itself still succeeds -- see
[ADR-0003](adr/0003-notification-architecture.md) -- and the failed send lands in the
`NotifyOnRegistrationDlq` SQS queue after 3 retries, visible in the SQS console.

## Creating the first admin user

No admin accounts exist after a fresh deploy. Create one:

```bash
./scripts/bootstrap-admin.sh <UserPoolId> you@example.com
```

`<UserPoolId>` is the `UserPoolId` output of `event-ticketing-auth`
(`aws cloudformation describe-stacks --stack-name event-ticketing-auth --query
"Stacks[0].Outputs"`, or read it from `infrastructure/outputs.json` after a deploy).
Cognito emails a temporary password to that address; the admin sets a permanent one on
first login via the SPA (handled automatically by the login page's "new password
required" flow).

## Setting up GitHub Actions CI/CD

### CI workflows (no AWS access needed)

`backend-ci.yml`, `infrastructure-ci.yml`, and `frontend-ci.yml` run automatically on
every pull request and push to `main` that touches their respective directories -- no
setup required beyond having the repository on GitHub.

### Deploy workflow (needs a one-time AWS + GitHub setup)

`deploy.yml` uses GitHub OIDC to assume an AWS IAM role -- no long-lived access keys are
stored anywhere (see [ADR-0006](adr/0006-github-oidc-deploy-credentials.md)). One-time
setup:

1. **Create the OIDC identity provider** (skip if your account already has one for
   GitHub Actions):

   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

2. **Create a deploy role** trusting that provider, scoped to this repository (replace
   `ACCOUNT_ID` and `your-org/your-repo`):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
         "StringLike": { "token.actions.githubusercontent.com:sub": "repo:your-org/your-repo:ref:refs/heads/main" }
       }
     }]
   }
   ```

   Attach a policy scoped to what `cdk deploy` needs for this project (CloudFormation,
   IAM role/policy management for the Lambda execution roles, and the specific services
   this stack provisions -- DynamoDB, Lambda, API Gateway, Cognito, S3, CloudFront, SES,
   SNS, SQS, CloudWatch, Budgets). `AdministratorAccess` also works for a personal
   sandbox account but is broader than necessary.

3. **Add repository secrets** (Settings -> Secrets and variables -> Actions):

   | Secret | Value |
   |---|---|
   | `AWS_DEPLOY_ROLE_ARN` | ARN of the role created above |
   | `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |
   | `ADMIN_ALERT_EMAIL` | Same as the manual-deploy value |
   | `SES_SENDER_EMAIL` | Same as the manual-deploy value |

   Optional repository **variable**: `AWS_REGION` (defaults to `us-east-1`).

4. Push to `main` (or merge a PR into it). `deploy.yml` runs `cdk deploy --all`, then
   builds and publishes the frontend using the real API/Cognito values from the stack
   outputs.

## Tearing down

Both DynamoDB tables and both S3 buckets use `RemovalPolicy.RETAIN` (deliberately --
see [ADR-0001](adr/0001-dynamodb-transactional-integrity.md)), so `cdk destroy --all`
will remove every other resource but leave these four behind. Delete them manually via
the console or CLI if a full teardown (e.g., end of the free-tier evaluation period) is
actually intended:

```bash
aws dynamodb delete-table --table-name <EventsTableName>
aws dynamodb delete-table --table-name <RegistrationsTableName>
aws s3 rb s3://<TicketsBucketName> --force
aws s3 rb s3://<SiteBucketName> --force
```
