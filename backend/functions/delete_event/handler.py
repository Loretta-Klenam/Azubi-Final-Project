"""DELETE /admin/events/{eventId} -- remove an event.

Refuses to delete an event that still has active registrants (protects
against accidentally orphaning registration records); the admin must cancel
the event (PUT status=CANCELLED) first, which is a deliberate, reversible
step distinct from permanent deletion.
"""
from __future__ import annotations

from common.auth import require_admin_group
from common.dynamo import events_table
from common.errors import ConflictError, NotFoundError, ValidationAppError
from common.middleware import api_handler


@api_handler
def lambda_handler(event: dict, _context) -> tuple[int, dict]:
    require_admin_group(event)
    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        raise ValidationAppError("eventId path parameter is required.")

    existing = events_table().get_item(Key={"eventId": event_id}).get("Item")
    if not existing:
        raise NotFoundError(f"Event '{event_id}' was not found.")

    if existing.get("registeredCount", 0) > 0 and existing.get("status") != "CANCELLED":
        raise ConflictError(
            "This event has active registrants. Cancel it (set status to CANCELLED) "
            "before deleting it.",
            error_code="EVENT_HAS_REGISTRANTS",
        )

    events_table().delete_item(Key={"eventId": event_id})
    return 200, {"eventId": event_id, "deleted": True}
