#!/usr/bin/env bash
# Manual end-to-end deploy: CDK stacks + frontend build/sync/invalidate.
# This is what .github/workflows/deploy.yml runs automatically on every push
# to main; use this script for the very first deploy (before CI/OIDC is set
# up) or for ad-hoc deploys from a local machine.
#
# Requires: AWS CLI configured with credentials that can deploy this stack,
# Docker running (for Lambda layer bundling), Node.js + npm, Python 3.12,
# and the AWS CDK CLI (`npm install -g aws-cdk`).
#
# Usage:
#   ADMIN_ALERT_EMAIL=you@example.com SES_SENDER_EMAIL=noreply@example.com \
#     ./scripts/deploy.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${ADMIN_ALERT_EMAIL:?Set ADMIN_ALERT_EMAIL (receives alarm/budget notifications)}"
: "${SES_SENDER_EMAIL:?Set SES_SENDER_EMAIL (the 'From' address for attendee emails)}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "== Installing infrastructure dependencies =="
cd "${ROOT_DIR}/infrastructure"
python3 -m venv .venv --upgrade-deps >/dev/null 2>&1 || true
source .venv/bin/activate
pip install -q -r requirements.txt

echo "== cdk deploy (this bundles the Lambda layers via Docker) =="
cdk deploy --all --require-approval never \
  --outputs-file outputs.json \
  -c adminAlertEmail="${ADMIN_ALERT_EMAIL}" \
  -c sesSenderEmail="${SES_SENDER_EMAIL}" \
  -c region="${AWS_REGION}"

echo "== Extracting stack outputs for the frontend build =="
python3 - <<'PY'
import json

with open("outputs.json") as f:
    outputs = json.load(f)

api = outputs["event-ticketing-api"]
auth = outputs["event-ticketing-auth"]

with open("../frontend/.env.production", "w") as f:
    f.write(f"VITE_API_BASE_URL={api['ApiEndpoint']}\n")
    f.write(f"VITE_COGNITO_USER_POOL_ID={auth['UserPoolId']}\n")
    f.write(f"VITE_COGNITO_CLIENT_ID={auth['UserPoolClientId']}\n")
PY

echo "== Building frontend =="
cd "${ROOT_DIR}/frontend"
npm ci
npm run build

BUCKET_NAME=$(python3 -c "import json; print(json.load(open('../infrastructure/outputs.json'))['event-ticketing-frontend']['SiteBucketName'])")
DISTRIBUTION_ID=$(python3 -c "import json; print(json.load(open('../infrastructure/outputs.json'))['event-ticketing-frontend']['DistributionId'])")

echo "== Syncing frontend to s3://${BUCKET_NAME} =="
aws s3 sync dist "s3://${BUCKET_NAME}" --delete

echo "== Invalidating CloudFront distribution ${DISTRIBUTION_ID} =="
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*"

echo ""
echo "Deploy complete. Next step: create the first admin user with"
echo "  ./scripts/bootstrap-admin.sh \$(python3 -c \"import json; print(json.load(open('infrastructure/outputs.json'))['event-ticketing-auth']['UserPoolId'])\") you@example.com"
