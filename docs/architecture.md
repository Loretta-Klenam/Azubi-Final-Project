# Architecture Overview

The solution is a fully serverless event registration and ticketing platform designed for AWS. The frontend is served from S3 and CloudFront, while the backend runs on API Gateway and AWS Lambda with DynamoDB as the primary data store. Terraform provisions networking, IAM, Lambda, DynamoDB, S3, and CloudFront assets in a modular way.

## Components
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js 22 + TypeScript + Zod validation
- Infrastructure: Terraform modules for DynamoDB, Lambda, and S3
- Monitoring: CloudWatch and X-Ray ready through AWS services
