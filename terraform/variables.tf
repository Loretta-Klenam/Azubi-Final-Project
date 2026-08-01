variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment used to namespace shared AWS resources"
  type        = string
  default     = "dev"
}
