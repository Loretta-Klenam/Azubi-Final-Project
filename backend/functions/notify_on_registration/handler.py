"""DynamoDB Stream trigger on the `registrations` table (INSERT only).

Decoupled from register_for_event on purpose: sending email/SNS involves
network calls to external services (SES, SNS) that can be slow or briefly
unavailable (e.g. a brand-new SES account still in sandbox mode rejecting an
unverified recipient). None of that should ever block or fail the attendee's
registration request. The event source mapping (see infrastructure/stacks/
api_stack.py) already filters to `type = REGISTRATION` INSERT records, but
this handler re-checks defensively rather than trusting the filter alone.

Uses Powertools' BatchProcessor with `report_batch_item_failures` so a
failure in ONE record (e.g. one bad email address) only causes that record
to be retried/DLQ'd, not the whole batch.
"""
from __future__ import annotations

import os
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType, process_partial_response
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.types import TypeDeserializer

from common import aws_clients
from common.dynamo import events_table
from common.observability import logger, metrics, tracer

_s3 = aws_clients.client("s3")
_ses = aws_clients.client("ses")
_sns = aws_clients.client("sns")
_deserializer = TypeDeserializer()

TICKETS_BUCKET_NAME = os.environ["TICKETS_BUCKET_NAME"]
SES_SENDER_EMAIL = os.environ["SES_SENDER_EMAIL"]
SNS_OPS_TOPIC_ARN = os.environ["SNS_OPS_TOPIC_ARN"]
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "https://example.invalid")

processor = BatchProcessor(event_type=EventType.DynamoDBStreams)


def _deserialize_image(image: dict) -> dict:
    return {key: _deserializer.deserialize(value) for key, value in image.items()}


def _build_confirmation_email(registration: dict, event_item: dict, qr_bytes: bytes) -> bytes:
    ticket_url = (
        f"{FRONTEND_BASE_URL}/tickets/{registration['registrationId']}"
        f"?code={registration['confirmationCode']}"
    )
    message = MIMEMultipart("related")
    message["Subject"] = f"You're registered: {event_item.get('title', 'Upcoming event')}"
    message["From"] = SES_SENDER_EMAIL
    message["To"] = registration["attendeeEmail"]

    html_body = f"""
    <html>
      <body style="font-family: sans-serif;">
        <h2>You're confirmed!</h2>
        <p>Hi {registration['attendeeName']}, your spot for
           <strong>{event_item.get('title', 'this event')}</strong> is booked.</p>
        <ul>
          <li><strong>Venue:</strong> {event_item.get('venue', 'TBA')}</li>
          <li><strong>Starts:</strong> {event_item.get('startDateTime', 'TBA')}</li>
          <li><strong>Confirmation code:</strong> {registration['confirmationCode']}</li>
        </ul>
        <p>Show the QR code below at check-in, or view your ticket online:<br/>
           <a href="{ticket_url}">{ticket_url}</a></p>
        <img src="cid:ticket-qr" alt="Ticket QR code" width="220" height="220" />
      </body>
    </html>
    """
    message.attach(MIMEText(html_body, "html"))

    image = MIMEImage(qr_bytes, name="ticket-qr.png")
    image.add_header("Content-ID", "<ticket-qr>")
    image.add_header("Content-Disposition", "inline", filename="ticket-qr.png")
    message.attach(image)

    return message.as_bytes()


def _notify(registration: dict) -> None:
    event_item = events_table().get_item(Key={"eventId": registration["eventId"]}).get("Item", {})

    qr_object = _s3.get_object(Bucket=TICKETS_BUCKET_NAME, Key=registration["ticketS3Key"])
    qr_bytes = qr_object["Body"].read()

    raw_email = _build_confirmation_email(registration, event_item, qr_bytes)
    _ses.send_raw_email(
        Source=SES_SENDER_EMAIL,
        Destinations=[registration["attendeeEmail"]],
        RawMessage={"Data": raw_email},
    )
    logger.info("confirmation_email_sent", registration_id=registration["registrationId"])

    _sns.publish(
        TopicArn=SNS_OPS_TOPIC_ARN,
        Subject="New event registration",
        Message=(
            f"{registration['attendeeName']} ({registration['attendeeEmail']}) registered for "
            f"'{event_item.get('title', registration['eventId'])}'. "
            f"registrationId={registration['registrationId']}"
        ),
    )
    metrics.add_metric(name="NotificationSent", value=1, unit="Count")


def record_handler(record: dict) -> None:
    if record.get("eventName") != "INSERT":
        return
    new_image = record.get("dynamodb", {}).get("NewImage")
    if not new_image:
        return

    registration = _deserialize_image(new_image)
    if registration.get("type") != "REGISTRATION":
        return

    _notify(registration)


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
@metrics.log_metrics(capture_cold_start_metric=True)
def lambda_handler(event: dict, context: LambdaContext):
    return process_partial_response(
        event=event,
        record_handler=record_handler,
        processor=processor,
        context=context,
    )
