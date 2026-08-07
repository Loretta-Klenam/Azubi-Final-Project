#!/usr/bin/env bash
# Creates the first admin user in the Cognito User Pool provisioned by
# AuthStack. Deliberately a manual, one-time script rather than a CDK
# custom resource -- see docs/adr/0002-cognito-admin-auth.md for why.
#
# Usage:
#   ./scripts/bootstrap-admin.sh <user-pool-id> <admin-email>
#
# The new admin is created with a temporary password (emailed to them by
# Cognito) and must set a permanent password on first login -- the frontend's
# login page handles that "new password required" flow automatically.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <user-pool-id> <admin-email>" >&2
  echo "  <user-pool-id> is the AuthStack 'UserPoolId' CloudFormation output." >&2
  exit 1
fi

USER_POOL_ID="$1"
ADMIN_EMAIL="$2"
ADMINS_GROUP="Admins"

echo "Creating admin user '${ADMIN_EMAIL}' in user pool ${USER_POOL_ID}..."

aws cognito-idp admin-create-user \
  --user-pool-id "${USER_POOL_ID}" \
  --username "${ADMIN_EMAIL}" \
  --user-attributes Name=email,Value="${ADMIN_EMAIL}" Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL

echo "Adding '${ADMIN_EMAIL}' to the ${ADMINS_GROUP} group..."

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "${USER_POOL_ID}" \
  --username "${ADMIN_EMAIL}" \
  --group-name "${ADMINS_GROUP}"

echo "Done. ${ADMIN_EMAIL} will receive a temporary password by email and"
echo "will be prompted to set a permanent one on first sign-in."
