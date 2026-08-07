"""GET /admin/events/{eventId}/registrations -- paginated registrant list.

Uses the EventIndex GSI (PK eventId, SK registeredAt). Lock items never
appear here: they don't have a registeredAt attribute, so DynamoDB excludes
them from this GSI's projection automatically.
"""
from __future__ import annotations

import base64
import json

from boto3.dynamodb.conditions import Key

from common.auth import require_admin_group
from common.dynamo import registrations_table
from common.errors import ValidationAppError
from common.middleware import api_handler

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


@api_handler
def lambda_handler(event: dict, _context) -> dict:
    require_admin_group(event)
    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        raise ValidationAppError("eventId path parameter is required.")

    query = event.get("queryStringParameters") or {}
    limit = min(int(query.get("limit", DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)

    query_kwargs = {
        "IndexName": "EventIndex",
        "KeyConditionExpression": Key("eventId").eq(event_id),
        "Limit": limit,
        "ScanIndexForward": False,
    }
    cursor = query.get("cursor")
    if cursor:
        query_kwargs["ExclusiveStartKey"] = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())

    result = registrations_table().query(**query_kwargs)

    next_cursor = None
    if result.get("LastEvaluatedKey"):
        next_cursor = base64.urlsafe_b64encode(json.dumps(result["LastEvaluatedKey"]).encode()).decode()

    return {"items": result.get("Items", []), "nextCursor": next_cursor}
