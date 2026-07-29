variable "aws_region" {
  description = "AWS region where bootstrap resources are created"
  type        = string
  default     = "us-east-1"
}

variable "github_org" {
  description = "GitHub organisation or username that owns the repository"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without the org prefix)"
  type        = string
}

variable "create_oidc_provider" {
  description = <<-EOT
    Set to true on first run to create the GitHub OIDC provider.
    Set to false if the provider already exists in your account
    (only one OIDC provider per URL is allowed per AWS account).
  EOT
  type        = bool
  default     = true
}
