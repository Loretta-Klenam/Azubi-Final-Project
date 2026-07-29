resource "aws_dynamodb_table" "events" {
  name         = var.events_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags
}

resource "aws_dynamodb_table" "registrations" {
  name         = var.registrations_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "eventId"
    type = "S"
  }

  global_secondary_index {
    name            = "eventId-index"
    hash_key        = "eventId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = var.tags
}
