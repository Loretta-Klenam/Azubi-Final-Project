variable "lambda_invoke_arn" {
  description = "Lambda function invoke ARN for API Gateway integration"
  type        = string
}

variable "lambda_function_name" {
  description = "Lambda function name (for permission resource)"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
