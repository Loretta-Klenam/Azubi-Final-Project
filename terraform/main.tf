terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

resource "random_id" "bucket" {
  byte_length = 4
}

locals {
  common_tags = {
    Project   = "event-ticketing"
    ManagedBy = "terraform"
  }
}

module "dynamodb" {
  source = "./modules/dynamodb"

  events_table_name        = "event-ticketing-events"
  registrations_table_name = "event-ticketing-registrations"
  enable_pitr              = false
  tags                     = local.common_tags
}

module "lambda" {
  source = "./modules/lambda"

  function_name            = "event-ticketing-api"
  events_table_name        = module.dynamodb.events_table_name
  events_table_arn         = module.dynamodb.events_table_arn
  registrations_table_name = module.dynamodb.registrations_table_name
  registrations_table_arn  = module.dynamodb.registrations_table_arn
  tags                     = local.common_tags
}

module "api_gateway" {
  source = "./modules/api_gateway"

  lambda_invoke_arn    = module.lambda.lambda_invoke_arn
  lambda_function_name = module.lambda.lambda_function_name
  tags                 = local.common_tags
}

module "s3" {
  source = "./modules/s3"

  bucket_name = "event-ticketing-frontend-${random_id.bucket.hex}"
  tags        = local.common_tags
}

module "cloudfront" {
  source = "./modules/cloudfront"

  s3_bucket_id              = module.s3.bucket_id
  s3_bucket_arn             = module.s3.bucket_arn
  s3_bucket_regional_domain = module.s3.bucket_regional_domain
  tags                      = local.common_tags
}
