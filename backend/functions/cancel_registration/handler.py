"""DELETE /registrations/{registrationId}?code=... (public self-service) and
DELETE /admin/registrations/{registrationId} (admin) -- cancel a registration.

Same handler, two authorization paths: an admin's Cognito identity is
trusted outright; a public caller must supply the matching confirmationCode.
Cancelling reverses every effect of registering, in one transaction:
  1. Mark the registration CANCELLED (only if it was CONFIRMED).
  2. Delete the uniqueness lock item, so this attendee can register again.
  3. Decrement the event's registeredCount, freeing up a seat.
"""
from __future__ import annotations

from datetime import UTC, datetime

from common.auth import is_admin_request
from common.dynamo import events_table, registrations_table, to_dynamo_item, transact_write
from common.errors import ConflictError, NotFoundError, ValidationAppError
from common.middleware import api_handler


@api_handler
def lambda_handler(event: dict, _context) -> dict:
    registration_id = (event.get("pathParameters") or {}).get("registrationId")
    if not registration_id:
        raise ValidationAppError("registrationId path parameter is required.")

    admin_mode = is_admin_request(event)
    code = (event.get("queryStringParameters") or {}).get("code")
    if not admin_mode and not code:
        raise ValidationAppError("code query parameter is required.")

    item = registrations_table().get_item(Key={"PK": registration_id}).get("Item")
    not_found = NotFoundError("Registration not found.")
    if not item or item.get("type") != "REGISTRATION":
        raise not_found
    if not admin_mode and item.get("confirmationCode") != code:
        raise not_found

    if item.get("status") != "CONFIRMED":
        raise ConflictError("This registration is already cancelled.", error_code="ALREADY_CANCELLED")

    now = datetime.now(UTC).isoformat()
    lock_key = f"LOCK#{item['eventId']}#{item['attendeeEmail'].lower()}"
    registrations_table_name = registrations_table().table_name
    events_table_name = events_table().table_name

    transact_items = [
        {
            "Update": {
                "TableName": registrations_table_name,
                "Key": to_dynamo_item({"PK": registration_id}),
                "UpdateExpression": "SET #status = :cancelled, cancelledAt = :now",
                "ConditionExpression": "#status = :confirmed",
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": to_dynamo_item(
                    {":cancelled": "CANCELLED", ":confirmed": "CONFIRMED", ":now": now}
                ),
            }
        },
        {
            "Delete": {
                "TableName": registrations_table_name,
                "Key": to_dynamo_item({"PK": lock_key}),
                "ConditionExpression": "registrationId = :thisId",
                "ExpressionAttributeValues": to_dynamo_item({":thisId": registration_id}),
            }
        },
        {
            "Update": {
                "TableName": events_table_name,
                "Key": to_dynamo_item({"eventId": item["eventId"]}),
                "UpdateExpression": "SET registeredCount = registeredCount - :one",
                "ConditionExpression": "registeredCount > :zero",
                "ExpressionAttributeValues": to_dynamo_item({":one": 1, ":zero": 0}),
            }
        },
    ]

    failure_map = {
        0: ConflictError("This registration is already cancelled.", error_code="ALREADY_CANCELLED"),
    }
    transact_write(transact_items, failure_map)

    return {"registrationId": registration_id, "status": "CANCELLED", "cancelledAt": now}
