# ──────────────────────────────────────────────────────────────────────────────
# Bootstrap — run ONCE manually before any CI/CD pipelines execute.
# Creates:
#   • S3 bucket for Terraform remote state
#   • DynamoDB table for state locking
#   • GitHub Actions OIDC identity provider
#   • IAM role for GitHub Actions (OIDC-based, no long-lived keys needed)
#
# Usage:
#   cd terraform/bootstrap
#   terraform init
#   terraform apply -var="github_org=YOUR_ORG" -var="github_repo=YOUR_REPO"
#
# After apply, copy the outputs into GitHub Secrets / Variables.
# ──────────────────────────────────────────────────────────────────────────────
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bootstrap uses a LOCAL backend intentionally — it creates the remote
  # backend infrastructure, so it cannot use it yet.
  backend "local" {
    path = "bootstrap.tfstate"
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name
  bucket_name = "event-ticketing-tfstate-${local.account_id}"
  lock_table  = "event-ticketing-tfstate-lock"
}

# ── Terraform State S3 Bucket ─────────────────────────────────────────────────

resource "aws_s3_bucket" "tfstate" {
  bucket = local.bucket_name

  # Prevent accidental deletion of state data
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name      = "Terraform State"
    ManagedBy = "terraform-bootstrap"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── DynamoDB State Lock Table ─────────────────────────────────────────────────

resource "aws_dynamodb_table" "tfstate_lock" {
  name         = local.lock_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name      = "Terraform State Lock"
    ManagedBy = "terraform-bootstrap"
  }
}

# ── GitHub Actions OIDC Identity Provider ────────────────────────────────────

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub's OIDC thumbprint (stable — GitHub controls this endpoint)
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1",
  "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]

  tags = {
    Name      = "GitHub Actions OIDC"
    ManagedBy = "terraform-bootstrap"
  }
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? (
    aws_iam_openid_connect_provider.github[0].arn
  ) : data.aws_iam_openid_connect_provider.github[0].arn
}

# ── IAM Role for GitHub Actions ───────────────────────────────────────────────

resource "aws_iam_role" "github_actions" {
  name        = "github-actions-event-ticketing"
  description = "Assumed by GitHub Actions via OIDC for event-ticketing deployments"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GitHubOIDC"
        Effect = "Allow"
        Principal = {
          Federated = local.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Allows any branch/environment in the target repo
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name      = "GitHub Actions – Event Ticketing"
    ManagedBy = "terraform-bootstrap"
  }
}

# ── IAM Policy (least-privilege for deploying this project) ───────────────────

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "event-ticketing-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TerraformStateRead"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${local.bucket_name}",
          "arn:aws:s3:::${local.bucket_name}/*"
        ]
      },
      {
        Sid      = "TerraformStateLock"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:DescribeTable"]
        Resource = "arn:aws:dynamodb:${local.region}:${local.account_id}:table/${local.lock_table}"
      },
      {
        Sid    = "DynamoDB"
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable", "dynamodb:DeleteTable", "dynamodb:DescribeTable",
          "dynamodb:UpdateTable", "dynamodb:TagResource", "dynamodb:UntagResource",
          "dynamodb:ListTagsOfResource", "dynamodb:UpdateContinuousBackups",
          "dynamodb:DescribeContinuousBackups"
        ]
        Resource = "arn:aws:dynamodb:${local.region}:${local.account_id}:table/event-ticketing-*"
      },
      {
        Sid      = "Lambda"
        Effect   = "Allow"
        Action   = ["lambda:*"]
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:event-ticketing-*"
      },
      {
        Sid      = "APIGateway"
        Effect   = "Allow"
        Action   = ["apigateway:*"]
        Resource = "*"
      },
      {
        Sid    = "S3Frontend"
        Effect = "Allow"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::event-ticketing-*",
          "arn:aws:s3:::event-ticketing-*/*"
        ]
      },
      {
        Sid      = "CloudFront"
        Effect   = "Allow"
        Action   = ["cloudfront:*"]
        Resource = "*"
      },
      {
        Sid    = "IAM"
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:PassRole",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy",
          "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy",
          "iam:GetPolicyVersion", "iam:ListPolicyVersions",
          "iam:ListAttachedRolePolicies", "iam:ListRolePolicies",
          "iam:ListInstanceProfilesForRole",
          "iam:GetRolePolicy", "iam:PutRolePolicy", "iam:DeleteRolePolicy",
          "iam:TagRole", "iam:UntagRole"
        ]
        Resource = "*"
      },
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = ["logs:*"]
        Resource = "*"
      }
    ]
  })
}
