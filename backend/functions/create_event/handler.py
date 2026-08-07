"""POST /admin/events -- create a new event (DRAFT by default).

Admin-only (Cognito 'Admins' group, enforced both by the API Gateway
authorizer and again here in code -- see common.auth for why).
"""
from __future__ import annotations

from datetime import UTC, datetime

from common.auth import get_cognito_sub, require_admin_group
from common.dynamo import events_table
from common.ids import generate_id
from common.middleware import api_handler
from common.models import EventCreateRequest
from common.validation import parse_json_body


@api_handler
def lambda_handler(event: dict, _context) -> tuple[int, dict]:
    require_admin_group(event)
    payload = parse_json_body(event, EventCreateRequest)

    now = datetime.now(UTC).isoformat()
    item = {
        "eventId": generate_id(),
        "title": payload.title,
        "description": payload.description,
        "venue": payload.venue,
        "startDateTime": payload.startDateTime.isoformat(),
        "endDateTime": payload.endDateTime.isoformat(),
        "capacity": payload.capacity,
        "registeredCount": 0,
        "status": payload.status.value,
        "createdBy": get_cognito_sub(event) or "unknown",
        "createdAt": now,
        "updatedAt": now,
    }
    events_table().put_item(Item=item)
    return 201, item
