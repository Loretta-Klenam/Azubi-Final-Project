output "tf_state_bucket" {
  description = "Value for the TF_STATE_BUCKET GitHub Secret"
  value       = aws_s3_bucket.tfstate.bucket
}

output "tf_lock_table" {
  description = "Value for the TF_LOCK_TABLE GitHub Secret"
  value       = aws_dynamodb_table.tfstate_lock.name
}

output "github_actions_role_arn" {
  description = "Value for the AWS_ROLE_ARN GitHub Secret"
  value       = aws_iam_role.github_actions.arn
}

output "aws_region" {
  description = "Value for the AWS_REGION GitHub Variable"
  value       = var.aws_region
}

output "next_steps" {
  description = "Instructions to complete setup"
  value       = <<-EOT
    ─────────────────────────────────────────────────────────────
    Bootstrap complete. Add these to GitHub:

    Settings → Secrets and variables → Actions → Secrets:
      AWS_ROLE_ARN          = ${aws_iam_role.github_actions.arn}
      TF_STATE_BUCKET       = ${aws_s3_bucket.tfstate.bucket}
      TF_LOCK_TABLE         = ${aws_dynamodb_table.tfstate_lock.name}

    Settings → Secrets and variables → Actions → Variables:
      AWS_REGION            = ${var.aws_region}

    Settings → Environments  (create these three):
      dev      – no protection rules
      staging  – no protection rules
      prod     – add "Required reviewers" for approval gate

    If not using OIDC, also add these Secrets:
      AWS_ACCESS_KEY_ID     = <your access key>
      AWS_SECRET_ACCESS_KEY = <your secret key>
    ─────────────────────────────────────────────────────────────
  EOT
}
