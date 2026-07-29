variable "s3_bucket_id" {
  description = "S3 bucket ID for the frontend"
  type        = string
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN for the frontend"
  type        = string
}

variable "s3_bucket_regional_domain" {
  description = "S3 bucket regional domain name"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
