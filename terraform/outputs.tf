output "api_url" {
  description = "API Gateway invoke URL"
  value       = module.api_gateway.api_url
}

output "cloudfront_url" {
  description = "CloudFront distribution HTTPS URL"
  value       = module.cloudfront.cloudfront_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (used for cache invalidation)"
  value       = module.cloudfront.cloudfront_distribution_id
}

output "s3_bucket" {
  description = "S3 bucket name for frontend assets"
  value       = module.s3.bucket_name
}

output "events_table" {
  description = "DynamoDB events table name"
  value       = module.dynamodb.events_table_name
}

output "registrations_table" {
  description = "DynamoDB registrations table name"
  value       = module.dynamodb.registrations_table_name
}

output "lambda_arn" {
  description = "Lambda function ARN"
  value       = module.lambda.lambda_arn
}
