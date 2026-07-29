output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.this.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.this.id
}
