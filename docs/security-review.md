# Security Review

- Use IAM roles with least privilege for Lambda and Terraform-managed resources.
- Store configuration in AWS Secrets Manager or SSM Parameter Store.
- Enable S3 public access block and restrict bucket policies.
- Validate API payloads with Zod before processing.
- Apply encryption at rest for DynamoDB and S3.
