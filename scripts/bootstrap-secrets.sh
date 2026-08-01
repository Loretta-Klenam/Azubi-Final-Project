#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# bootstrap-secrets.sh
#
# Creates the AWS infrastructure required for the CI/CD pipeline and writes
# every secret value to GITHUB_SECRETS.md (gitignored).
#
# What it creates:
#   • S3 bucket for Terraform remote state (versioned + encrypted)
#   • DynamoDB table for Terraform state locking
#   • IAM user with a least-privilege deploy policy
#   • IAM access key pair for that user
#   • GITHUB_SECRETS.md with all values ready to copy-paste into GitHub
#
# Optionally (if `gh` CLI is installed and authenticated):
#   • Sets all secrets/variables directly via the GitHub API
#
# Prerequisites:
#   brew install awscli jq          # macOS
#   apt install awscli jq           # Debian/Ubuntu
#   aws configure                   # authenticate AWS CLI
#   gh auth login                   # only needed for auto-set
#
# Usage:
#   chmod +x scripts/bootstrap-secrets.sh
#   ./scripts/bootstrap-secrets.sh
#   # then open GITHUB_SECRETS.md and copy the values into GitHub
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${BLUE}==>${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
die()  { echo -e "${RED}  ✗ ERROR:${NC} $1" >&2; exit 1; }

# ── Dependency check ──────────────────────────────────────────────────────────
for cmd in aws jq; do
  command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is not installed. Run: brew install $cmd"
done

GH_AVAILABLE=false
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  GH_AVAILABLE=true
  warn "GitHub CLI detected — secrets will be set automatically via 'gh'"
else
  warn "GitHub CLI not found or not authenticated — values will only be written to GITHUB_SECRETS.md"
fi

# ── Configuration ─────────────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
STATE_BUCKET="event-ticketing-tfstate-${ACCOUNT_ID}"
LOCK_TABLE="event-ticketing-tfstate-lock"
IAM_USER="github-actions-event-ticketing"
POLICY_NAME="event-ticketing-ci-deploy"
OUTPUT_FILE="GITHUB_SECRETS.md"

echo ""
echo -e "${BOLD}Event Ticketing — AWS Bootstrap${NC}"
echo -e "Account : ${ACCOUNT_ID}"
echo -e "Region  : ${AWS_REGION}"
echo ""

# ── 1. S3 Terraform State Bucket ──────────────────────────────────────────────
log "Creating Terraform state bucket: ${STATE_BUCKET}"
if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  warn "Bucket already exists — skipping creation"
else
  if [[ "${AWS_REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket \
      --bucket "${STATE_BUCKET}" \
      --region "${AWS_REGION}" \
      --no-cli-pager
  else
    aws s3api create-bucket \
      --bucket "${STATE_BUCKET}" \
      --region "${AWS_REGION}" \
      --create-bucket-configuration LocationConstraint="${AWS_REGION}" \
      --no-cli-pager
  fi
  ok "Bucket created"
fi

aws s3api put-bucket-versioning \
  --bucket "${STATE_BUCKET}" \
  --versioning-configuration Status=Enabled \
  --no-cli-pager
ok "Versioning enabled"

aws s3api put-bucket-encryption \
  --bucket "${STATE_BUCKET}" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}' \
  --no-cli-pager
ok "Encryption enabled"

aws s3api put-public-access-block \
  --bucket "${STATE_BUCKET}" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --no-cli-pager
ok "Public access blocked"

# ── 2. DynamoDB State Lock Table ──────────────────────────────────────────────
log "Creating DynamoDB lock table: ${LOCK_TABLE}"
if aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${AWS_REGION}" 2>/dev/null | jq -e .Table >/dev/null; then
  warn "Table already exists — skipping creation"
else
  aws dynamodb create-table \
    --table-name "${LOCK_TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${AWS_REGION}" \
    --no-cli-pager
  aws dynamodb wait table-exists --table-name "${LOCK_TABLE}" --region "${AWS_REGION}"
  ok "Lock table created and active"
fi

# ── 3. IAM Policy ─────────────────────────────────────────────────────────────
log "Creating IAM deploy policy: ${POLICY_NAME}"

POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TerraformStateAccess",
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${STATE_BUCKET}",
        "arn:aws:s3:::${STATE_BUCKET}/*"
      ]
    },
    {
      "Sid": "TerraformStateLock",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem","dynamodb:PutItem","dynamodb:DeleteItem","dynamodb:DescribeTable"],
      "Resource": "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${LOCK_TABLE}"
    },
    {
      "Sid": "DynamoDBAppTables",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable","dynamodb:DeleteTable","dynamodb:DescribeTable",
        "dynamodb:UpdateTable","dynamodb:TagResource","dynamodb:UntagResource",
        "dynamodb:ListTagsOfResource","dynamodb:UpdateContinuousBackups",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem",
        "dynamodb:Query","dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/event-ticketing-*"
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": ["lambda:*"],
      "Resource": "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:event-ticketing-*"
    },
    {
      "Sid": "APIGateway",
      "Effect": "Allow",
      "Action": ["apigateway:*"],
      "Resource": "*"
    },
    {
      "Sid": "S3Frontend",
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": [
        "arn:aws:s3:::event-ticketing-*",
        "arn:aws:s3:::event-ticketing-*/*"
      ]
    },
    {
      "Sid": "CloudFront",
      "Effect": "Allow",
      "Action": ["cloudfront:*"],
      "Resource": "*"
    },
    {
      "Sid": "IAMForLambdaRole",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole","iam:DeleteRole","iam:GetRole","iam:PassRole",
        "iam:AttachRolePolicy","iam:DetachRolePolicy",
        "iam:CreatePolicy","iam:DeletePolicy","iam:GetPolicy",
        "iam:GetPolicyVersion","iam:ListPolicyVersions",
        "iam:ListAttachedRolePolicies","iam:ListRolePolicies",
        "iam:ListInstanceProfilesForRole",
        "iam:GetRolePolicy","iam:PutRolePolicy","iam:DeleteRolePolicy",
        "iam:TagRole","iam:UntagRole"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": ["logs:*"],
      "Resource": "*"
    }
  ]
}
EOF
)

EXISTING_POLICY_ARN=$(aws iam list-policies \
  --scope Local \
  --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" \
  --output text \
  --no-cli-pager)

if [[ -n "${EXISTING_POLICY_ARN}" ]]; then
  warn "Policy already exists (${EXISTING_POLICY_ARN}) — creating new version"
  aws iam create-policy-version \
    --policy-arn "${EXISTING_POLICY_ARN}" \
    --policy-document "${POLICY_DOCUMENT}" \
    --set-as-default \
    --no-cli-pager
  POLICY_ARN="${EXISTING_POLICY_ARN}"
else
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "${POLICY_NAME}" \
    --description "Least-privilege deploy policy for event-ticketing CI/CD" \
    --policy-document "${POLICY_DOCUMENT}" \
    --query Policy.Arn \
    --output text \
    --no-cli-pager)
  ok "Policy created: ${POLICY_ARN}"
fi

# ── 4. IAM User ───────────────────────────────────────────────────────────────
log "Creating IAM user: ${IAM_USER}"
if aws iam get-user --user-name "${IAM_USER}" 2>/dev/null | jq -e .User >/dev/null; then
  warn "User already exists — skipping creation"
else
  aws iam create-user \
    --user-name "${IAM_USER}" \
    --tags Key=Project,Value=event-ticketing Key=ManagedBy,Value=bootstrap-script \
    --no-cli-pager
  ok "User created"
fi

# Attach policy to user
aws iam attach-user-policy \
  --user-name "${IAM_USER}" \
  --policy-arn "${POLICY_ARN}" \
  --no-cli-pager
ok "Policy attached to user"

# ── 5. IAM Access Keys ────────────────────────────────────────────────────────
log "Creating access key for ${IAM_USER}"

# Delete any existing keys first (max 2 per user)
EXISTING_KEYS=$(aws iam list-access-keys \
  --user-name "${IAM_USER}" \
  --query 'AccessKeyMetadata[].AccessKeyId' \
  --output text \
  --no-cli-pager)

for KEY_ID in ${EXISTING_KEYS}; do
  warn "Deleting existing key: ${KEY_ID}"
  aws iam delete-access-key \
    --user-name "${IAM_USER}" \
    --access-key-id "${KEY_ID}" \
    --no-cli-pager
done

KEY_JSON=$(aws iam create-access-key \
  --user-name "${IAM_USER}" \
  --query AccessKey \
  --output json \
  --no-cli-pager)

ACCESS_KEY_ID=$(echo "${KEY_JSON}" | jq -r '.AccessKeyId')
SECRET_ACCESS_KEY=$(echo "${KEY_JSON}" | jq -r '.SecretAccessKey')
ok "Access key created: ${ACCESS_KEY_ID}"

# ── 6. Write GITHUB_SECRETS.md ────────────────────────────────────────────────
log "Writing ${OUTPUT_FILE}"
TIMESTAMP=$(date -u "+%Y-%m-%d %H:%M UTC")

cat > "${OUTPUT_FILE}" <<MARKDOWN
# GitHub Secrets — Event Ticketing CI/CD
> Generated by \`scripts/bootstrap-secrets.sh\` on ${TIMESTAMP}
> **This file is gitignored. Do not commit it.**

---

## Secrets
Go to: **GitHub → Settings → Secrets and variables → Actions → Secrets**

| Secret name              | Value |
|--------------------------|-------|
| \`AWS_ACCESS_KEY_ID\`      | \`${ACCESS_KEY_ID}\` |
| \`AWS_SECRET_ACCESS_KEY\`  | \`${SECRET_ACCESS_KEY}\` |
| \`TF_STATE_BUCKET\`        | \`${STATE_BUCKET}\` |
| \`TF_LOCK_TABLE\`          | \`${LOCK_TABLE}\` |

## Variables
Go to: **GitHub → Settings → Secrets and variables → Actions → Variables**

| Variable name  | Value |
|----------------|-------|
| \`AWS_REGION\`   | \`${AWS_REGION}\` |

## Environments
Go to: **GitHub → Settings → Environments** and create:

| Environment | Protection |
|-------------|------------|
| \`dev\`       | None (auto-deploy) |
| \`staging\`   | None (auto-deploy) |
| \`prod\`      | Add "Required reviewers" |

---

## Resources created

| Resource | Name / ARN |
|----------|------------|
| S3 state bucket  | \`${STATE_BUCKET}\` |
| DynamoDB lock    | \`${LOCK_TABLE}\` |
| IAM user         | \`${IAM_USER}\` |
| IAM policy       | \`${POLICY_ARN}\` |
| AWS account      | \`${ACCOUNT_ID}\` |
| AWS region       | \`${AWS_REGION}\` |

---

## Quick copy-paste for \`terraform/backend-local.hcl\`
\`\`\`hcl
bucket         = "${STATE_BUCKET}"
key            = "event-ticketing/terraform.tfstate"
region         = "${AWS_REGION}"
dynamodb_table = "${LOCK_TABLE}"
encrypt        = true
\`\`\`
MARKDOWN

ok "Written to ${OUTPUT_FILE}"

# ── 7. Auto-set via GitHub CLI (optional) ─────────────────────────────────────
if [[ "${GH_AVAILABLE}" == "true" ]]; then
  log "Setting GitHub secrets via gh CLI"
  gh secret set AWS_ACCESS_KEY_ID      --body "${ACCESS_KEY_ID}"
  gh secret set AWS_SECRET_ACCESS_KEY  --body "${SECRET_ACCESS_KEY}"
  gh secret set TF_STATE_BUCKET        --body "${STATE_BUCKET}"
  gh secret set TF_LOCK_TABLE          --body "${LOCK_TABLE}"
  gh variable set AWS_REGION           --body "${AWS_REGION}"
  ok "All secrets and variables set on GitHub"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Bootstrap complete!${NC}"
echo ""
echo -e "  State bucket : ${BOLD}${STATE_BUCKET}${NC}"
echo -e "  Lock table   : ${BOLD}${LOCK_TABLE}${NC}"
echo -e "  IAM user     : ${BOLD}${IAM_USER}${NC}"
echo -e "  Access key   : ${BOLD}${ACCESS_KEY_ID}${NC}"
echo ""

if [[ "${GH_AVAILABLE}" == "true" ]]; then
  echo -e "${GREEN}GitHub secrets were set automatically.${NC}"
else
  echo -e "${YELLOW}Next step:${NC} open ${BOLD}${OUTPUT_FILE}${NC} and add the values to GitHub."
  echo -e "  GitHub → Settings → Secrets and variables → Actions"
fi

echo ""
echo -e "${YELLOW}Security reminder:${NC}"
echo -e "  ${OUTPUT_FILE} contains your secret key. Delete it after adding to GitHub."
echo -e "  It is gitignored and will not be committed."
echo ""
