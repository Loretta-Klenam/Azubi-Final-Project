"""GET /events (public) and GET /admin/events (admin) -- list events.

Shared handler, two routes: the public route always forces status=PUBLISHED
regardless of what's in the query string, so a draft or cancelled event can
never leak to an unauthenticated caller. The admin route may filter by any
status, or omit the filter entirely to see everything (drafts included, for
the "manage events" dashboard).
"""
from __future__ import annotations

import base64
import json

from boto3.dynamodb.conditions import Key

from common.auth import is_admin_request
from common.dynamo import events_table
from common.middleware import api_handler

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def _decode_cursor(raw: str | None) -> dict | None:
    if not raw:
        return None
    return json.loads(base64.urlsafe_b64decode(raw.encode()).decode())


def _encode_cursor(key: dict | None) -> str | None:
    if not key:
        return None
    return base64.urlsafe_b64encode(json.dumps(key).encode()).decode()


@api_handler
def lambda_handler(event: dict, _context) -> dict:
    query = event.get("queryStringParameters") or {}
    admin = is_admin_request(event)

    requested_status = query.get("status")
    status = requested_status if admin else "PUBLISHED"

    limit = min(int(query.get("limit", DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)
    exclusive_start_key = _decode_cursor(query.get("cursor"))

    table = events_table()
    if status:
        query_kwargs = {
            "IndexName": "StatusStartDateIndex",
            "KeyConditionExpression": Key("status").eq(status),
            "Limit": limit,
        }
        if exclusive_start_key:
            query_kwargs["ExclusiveStartKey"] = exclusive_start_key
        result = table.query(**query_kwargs)
    else:
        # Admin, no status filter: fall back to a Scan. Only reachable by
        # authenticated admins on a dataset sized for a small internal tool,
        # so the cost/performance trade-off against a full GSI is acceptable.
        scan_kwargs = {"Limit": limit}
        if exclusive_start_key:
            scan_kwargs["ExclusiveStartKey"] = exclusive_start_key
        result = table.scan(**scan_kwargs)

    return {
        "items": result.get("Items", []),
        "nextCursor": _encode_cursor(result.get("LastEvaluatedKey")),
    }
