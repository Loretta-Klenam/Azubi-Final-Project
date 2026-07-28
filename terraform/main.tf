terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "dynamodb" {
  source = "./modules/dynamodb"

  table_name = "event-ticketing-${var.environment}"
}

module "lambda" {
  source = "./modules/lambda"

  environment = var.environment
  function_name = "event-ticketing-${var.environment}"
}

module "s3" {
  source = "./modules/s3"

  bucket_name = "event-ticketing-${var.environment}-${random_id.bucket.hex}"
}

resource "random_id" "bucket" {
  byte_length = 4
}
