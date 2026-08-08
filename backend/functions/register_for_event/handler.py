"""POST /events/{eventId}/registrations -- the core write path.

Overbooking and duplicate registrations are both prevented by a single
DynamoDB TransactWriteItems call (see common.dynamo.transact_write and
docs/adr/0001-dynamodb-transactional-integrity.md for the full reasoning):

  1. Put a uniqueness "lock" item keyed on eventId+email -- fails if this
     attendee already has a confirmed registration for this event.
  2. Put the registration record itself.
  3. Increment the event's registeredCount, but only if it is still below
     capacity and the event is still PUBLISHED -- this is what makes
     "sold out" race-proof under concurrent requests, something an Excel
     sheet fundamentally cannot do.

QR generation and the S3 upload happen synchronously (cheap, no external
service dependency beyond S3) so the API response can return a usable ticket
immediately. Sending the actual *email* is deliberately NOT done here -- it's
handled asynchronously by notify_on_registration via a DynamoDB Stream, so a
slow/unavailable SES doesn't block or fail this request.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from aws_lambda_powertools.metrics import MetricUnit
from qr import generate_qr_png

from common import aws_clients
from common.auth import get_cognito_sub
from common.dynamo import events_table, registrations_table, to_dynamo_item, transact_write
from common.errors import ConflictError, NotFoundError, ValidationAppError
from common.ids import generate_confirmation_code, generate_id
from common.middleware import api_handler
from common.models import RegistrationCreateRequest
from common.observability import metrics
from common.validation import parse_json_body

_s3 = aws_clients.client("s3")
TICKETS_BUCKET_NAME = os.environ.get("TICKETS_BUCKET_NAME", "")
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "https://example.invalid")
PRESIGNED_URL_TTL_SECONDS = 15 * 60


def _record_failure(reason: str) -> None:
    metrics.add_dimension(name="reason", value=reason)
    metrics.add_metric(name="RegistrationFailed", unit=MetricUnit.Count, value=1)


@api_handler
def lambda_handler(event: dict, _context) -> tuple[int, dict]:
    try:
        return _register(event)
    except (ConflictError, NotFoundError, ValidationAppError) as exc:
        _record_failure(exc.error_code)
        raise


def _register(event: dict) -> tuple[int, dict]:
    event_id = (event.get("pathParameters") or {}).get("eventId")
    if not event_id:
        raise ValidationAppError("eventId path parameter is required.")

    payload = parse_json_body(event, RegistrationCreateRequest)
    email_key = payload.attendeeEmail.lower()
    # Only present when this request came in through the authenticated
    # POST /me/events/{eventId}/registrations route (attendee Cognito
    # authorizer) -- absent entirely for the anonymous public route.
    user_id = get_cognito_sub(event)

    target_event = events_table().get_item(Key={"eventId": event_id}).get("Item")
    if not target_event:
        raise NotFoundError(f"Event '{event_id}' was not found.")

    if target_event.get("status") != "PUBLISHED":
        raise ConflictError("This event is not open for registration.", error_code="EVENT_NOT_PUBLISHED")

    start_time = datetime.fromisoformat(target_event["startDateTime"])
    if datetime.now(timezone.utc) >= start_time:
        raise ConflictError("Registration for this event has closed.", error_code="REGISTRATION_CLOSED")

    registration_id = generate_id()
    confirmation_code = generate_confirmation_code()
    now = datetime.now(timezone.utc).isoformat()
    ticket_key = f"tickets/{event_id}/{registration_id}.png"
    lock_key = f"LOCK#{event_id}#{email_key}"

    registrations_table_name = registrations_table().table_name
    events_table_name = events_table().table_name

    registration_item = {
        "PK": registration_id,
        "type": "REGISTRATION",
        "registrationId": registration_id,
        "eventId": event_id,
        "attendeeName": payload.attendeeName,
        "attendeeEmail": payload.attendeeEmail,
        "confirmationCode": confirmation_code,
        "status": "CONFIRMED",
        "ticketS3Key": ticket_key,
        "registeredAt": now,
    }
    if user_id:
        registration_item["userId"] = user_id

    transact_items = [
        {
            "Put": {
                "TableName": registrations_table_name,
                "Item": to_dynamo_item(
                    {
                        "PK": lock_key,
                        "type": "LOCK",
                        "eventId": event_id,
                        "attendeeEmail": email_key,
                        "registrationId": registration_id,
                        "createdAt": now,
                    }
                ),
                "ConditionExpression": "attribute_not_exists(PK)",
            }
        },
        {
            "Put": {
                "TableName": registrations_table_name,
                "Item": to_dynamo_item(registration_item),
                "ConditionExpression": "attribute_not_exists(PK)",
            }
        },
        {
            "Update": {
                "TableName": events_table_name,
                "Key": to_dynamo_item({"eventId": event_id}),
                "UpdateExpression": "SET registeredCount = registeredCount + :one",
                "ConditionExpression": "registeredCount < #capacity AND #status = :published",
                "ExpressionAttributeNames": {"#status": "status", "#capacity": "capacity"},
                "ExpressionAttributeValues": to_dynamo_item({":one": 1, ":published": "PUBLISHED"}),
            }
        },
    ]

    failure_map = {
        0: ConflictError(
            "You have already registered for this event with this email address.",
            error_code="DUPLICATE_REGISTRATION",
        ),
        2: ConflictError("This event is sold out.", error_code="EVENT_SOLD_OUT"),
    }

    try:
        transact_write(transact_items, failure_map)
    except ConflictError as exc:
        _record_failure(exc.error_code)
        raise

    ticket_url = f"{FRONTEND_BASE_URL}/tickets/{registration_id}?code={confirmation_code}"
    qr_bytes = generate_qr_png(ticket_url)
    _s3.put_object(Bucket=TICKETS_BUCKET_NAME, Key=ticket_key, Body=qr_bytes, ContentType="image/png")

    ticket_qr_url = _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": TICKETS_BUCKET_NAME, "Key": ticket_key},
        ExpiresIn=PRESIGNED_URL_TTL_SECONDS,
    )

    metrics.add_metric(name="RegistrationSucceeded", unit=MetricUnit.Count, value=1)

    return 201, {
        "registrationId": registration_id,
        "eventId": event_id,
        "attendeeName": payload.attendeeName,
        "attendeeEmail": payload.attendeeEmail,
        "confirmationCode": confirmation_code,
        "status": "CONFIRMED",
        "registeredAt": now,
        "ticketQrUrl": ticket_qr_url,
    }
