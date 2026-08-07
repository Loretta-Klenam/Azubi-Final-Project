# ADR-0006: GitHub OIDC for Deploy Credentials

**Status:** Accepted

## Context

`deploy.yml` needs AWS credentials to run `cdk deploy` and sync the frontend to S3. The
common, simplest-looking option -- generating a long-lived IAM user access key and
pasting it into a GitHub Actions secret -- is also a standing liability: that key works
forever (or until manually rotated), works from anywhere, and if the secret ever leaks
(a misconfigured workflow, a fork's PR, a compromised dependency) an attacker has
durable, undetected AWS access.

## Decision

Use GitHub's OpenID Connect (OIDC) identity provider instead. `deploy.yml` requests
`permissions: id-token: write`, and `aws-actions/configure-aws-credentials` exchanges a
short-lived OIDC token (scoped to this specific repository, and optionally branch) for
temporary AWS credentials via `sts:AssumeRoleWithWebIdentity`. No AWS access key ever
exists as a GitHub secret -- only an IAM role ARN, which is not a credential by itself.

Setup (documented in `docs/deployment.md`) is a one-time, per-AWS-account step: create
the OIDC identity provider for `token.actions.githubusercontent.com`, and an IAM role
whose trust policy restricts `sts:AssumeRoleWithWebIdentity` to this repository (via the
`sub` claim), attached to a deploy policy scoped to what `cdk deploy` actually needs.

## Consequences

- Credentials used by CI are short-lived (typically ~1 hour) and automatically scoped to
  the workflow run that requested them -- there is nothing long-lived to leak or rotate.
- The trust policy is repository-scoped: a workflow in a different repo, even in the same
  GitHub organization, cannot assume this role.
- This does add one manual, click-through AWS console/CLI setup step before the first CI
  deploy can succeed, versus "paste an access key into Settings -> Secrets." That
  trade-off is judged worth it for anything beyond a disposable sandbox account.
