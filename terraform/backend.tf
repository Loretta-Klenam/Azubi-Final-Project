# Partial S3 backend configuration.
# All values are supplied via -backend-config flags in CI/CD.
# For local development, run:
#   cp terraform/backend-local.hcl.example terraform/backend-local.hcl
#   # fill in your values
#   terraform -chdir=terraform init -backend-config=../terraform/backend-local.hcl
terraform {
  backend "s3" {}
}
