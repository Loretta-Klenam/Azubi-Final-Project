"""GET /registrations/{registrationId}?code=... -- public ticket lookup.

The confirmation code acts as a lightweight capability token: knowing the
registrationId alone is not enough. A wrong code returns the same 404 as a
non-existent registration, so the response never confirms whether a given
registrationId is real.
"""
from __future__ import annotations

import os

from common import aws_clients
from common.dynamo import events_table, registrations_table
from common.errors import NotFoundError, ValidationAppError
from common.middleware import api_handler

_s3 = aws_clients.client("s3")
TICKETS_BUCKET_NAME = os.environ.get("TICKETS_BUCKET_NAME", "")
PRESIGNED_URL_TTL_SECONDS = 15 * 60


@api_handler
def lambda_handler(event: dict, _context) -> dict:
    registration_id = (event.get("pathParameters") or {}).get("registrationId")
    code = (event.get("queryStringParameters") or {}).get("code")
    if not registration_id or not code:
        raise ValidationAppError("registrationId and code are required.")

    item = registrations_table().get_item(Key={"PK": registration_id}).get("Item")
    not_found = NotFoundError("Registration not found.")
    if not item or item.get("type") != "REGISTRATION":
        raise not_found
    if item.get("confirmationCode") != code:
        raise not_found

    event_item = events_table().get_item(Key={"eventId": item["eventId"]}).get("Item", {})

    ticket_qr_url = None
    if item.get("status") == "CONFIRMED" and item.get("ticketS3Key"):
        ticket_qr_url = _s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": TICKETS_BUCKET_NAME, "Key": item["ticketS3Key"]},
            ExpiresIn=PRESIGNED_URL_TTL_SECONDS,
        )

    return {
        "registrationId": item["registrationId"],
        "eventId": item["eventId"],
        "attendeeName": item["attendeeName"],
        "attendeeEmail": item["attendeeEmail"],
        "status": item["status"],
        "registeredAt": item["registeredAt"],
        "cancelledAt": item.get("cancelledAt"),
        "ticketQrUrl": ticket_qr_url,
        "event": {
            "title": event_item.get("title"),
            "venue": event_item.get("venue"),
            "startDateTime": event_item.get("startDateTime"),
            "endDateTime": event_item.get("endDateTime"),
        },
    }
