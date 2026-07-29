variable "events_table_name" {
  description = "DynamoDB events table name"
  type        = string
}

variable "registrations_table_name" {
  description = "DynamoDB registrations table name"
  type        = string
}

variable "enable_pitr" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
