variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "iam_role_name" {
  description = "IAM role name for the Lambda function"
  type        = string
}

variable "iam_policy_name" {
  description = "IAM policy name for Lambda DynamoDB access"
  type        = string
}

variable "events_table_name" {
  description = "DynamoDB events table name"
  type        = string
}

variable "events_table_arn" {
  description = "DynamoDB events table ARN"
  type        = string
}

variable "registrations_table_name" {
  description = "DynamoDB registrations table name"
  type        = string
}

variable "registrations_table_arn" {
  description = "DynamoDB registrations table ARN"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
