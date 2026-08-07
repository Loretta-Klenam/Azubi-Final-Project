"""PUT /admin/events/{eventId} -- partial update of an event.

Only attributes present in the request body are changed (see
EventUpdateRequest -- every field is Optional). Admin-only.
"""
from __future__ import annotations

from datetime import datetime, timezone

from botocore.exceptions import ClientError

from common.auth import require_admin_group
from common.dynamo import events_table
from common.errors import NotFoundError, ValidationAppError
from common.middleware import api_handler
from common.models import EventUpdateRequest
from common.validation import parse_json_body


@api_handler
def lambda_handler(event: dict, _context) -> tuple[int, dict]:
    require_admin_group(event)
    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        raise ValidationAppError("eventId path parameter is required.")

    payload = parse_json_body(event, EventUpdateRequest)
    updates = payload.model_dump(exclude_none=True)
    for date_field in ("startDateTime", "endDateTime"):
        if date_field in updates:
            updates[date_field] = updates[date_field].isoformat()
    if "status" in updates:
        updates["status"] = updates["status"].value if hasattr(updates["status"], "value") else updates["status"]

    if not updates:
        raise ValidationAppError("At least one field must be provided to update.")

    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()

    update_expression = "SET " + ", ".join(f"#{key} = :{key}" for key in updates)
    expression_attribute_names = {f"#{key}": key for key in updates}
    expression_attribute_values = {f":{key}": value for key, value in updates.items()}

    try:
        result = events_table().update_item(
            Key={"eventId": event_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ConditionExpression="attribute_exists(eventId)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise NotFoundError(f"Event '{event_id}' was not found.") from exc
        raise

    return 200, result["Attributes"]
