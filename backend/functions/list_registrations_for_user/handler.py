"""GET /me/registrations -- the authenticated attendee's own registrations.

Protected by the AttendeeAuthorizer, a Cognito User Pool entirely separate
from the Admins one (see infrastructure/stacks/auth_stack.py). Uses the
UserIndex GSI (PK userId, SK registeredAt); only registrations made through
the authenticated POST /me/events/{eventId}/registrations route carry a
userId, so anonymous registrations never appear here.
"""
from __future__ import annotations

import base64
import json

from boto3.dynamodb.conditions import Key

from common.auth import get_cognito_sub
from common.dynamo import registrations_table
from common.errors import ForbiddenError
from common.middleware import api_handler

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


@api_handler
def lambda_handler(event: dict, _context) -> dict:
    user_id = get_cognito_sub(event)
    if not user_id:
        raise ForbiddenError("Sign in to view your registrations.")

    query = event.get("queryStringParameters") or {}
    limit = min(int(query.get("limit", DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)

    query_kwargs = {
        "IndexName": "UserIndex",
        "KeyConditionExpression": Key("userId").eq(user_id),
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
