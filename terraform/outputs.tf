output "api_url" {
  value = "https://example.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "s3_bucket" {
  value = module.s3.bucket_name
}

output "dynamodb_table" {
  value = module.dynamodb.table_name
}

output "lambda_arn" {
  value = module.lambda.lambda_arn
}
