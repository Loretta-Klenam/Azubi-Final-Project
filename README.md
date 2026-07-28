# Serverless Event Registration & Ticketing System

This repository contains a production-ready starter implementation of a serverless event registration and ticketing platform aligned to the supplied master prompt.

## What is included
- React + TypeScript frontend with a polished landing experience
- Node.js + TypeScript backend with Zod-based validation and health response logic
- Terraform modules for DynamoDB, Lambda, and S3
- OpenAPI specification and Postman collection
- Documentation for architecture, sequence flow, security, and cost
- GitHub Actions workflow for lint, test, build, and Terraform validation

## Project structure
- backend/: Lambda-compatible TypeScript service
- frontend/: Vite React application
- terraform/: Infrastructure as Code modules and root configuration
- docs/: Architecture and operational documentation
- openapi.yaml: API definition
- postman_collection.json: API testing collection

## Getting started
1. Install dependencies: npm install
2. Start frontend: npm run dev
3. Run backend tests: npm run test --workspace backend
4. Build all workspaces: npm run build
5. Validate Terraform: terraform -chdir=terraform validate
