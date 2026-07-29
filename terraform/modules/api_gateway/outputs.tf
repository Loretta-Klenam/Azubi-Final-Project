output "api_url" {
  description = "Base URL of the deployed API"
  value       = aws_api_gateway_stage.this.invoke_url
}

output "rest_api_id" {
  value = aws_api_gateway_rest_api.this.id
}
