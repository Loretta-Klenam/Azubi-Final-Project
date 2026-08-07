"""GET /events/{eventId} (public) and GET /admin/events/{eventId} (admin).

Public callers get a 404 for anything that isn't PUBLISHED (drafts and
cancelled events don't exist as far as the public API is concerned).
"""
from __future__ import annotations

from common.auth import is_admin_request
from common.dynamo import events_table
from common.errors import NotFoundError, ValidationAppError
from common.middleware import api_handler


@api_handler
def lambda_handler(event: dict, _context) -> dict:
    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        raise ValidationAppError("eventId path parameter is required.")

    item = events_table().get_item(Key={"eventId": event_id}).get("Item")
    if not item:
        raise NotFoundError(f"Event '{event_id}' was not found.")

    if not is_admin_request(event) and item.get("status") != "PUBLISHED":
        raise NotFoundError(f"Event '{event_id}' was not found.")

    return item
