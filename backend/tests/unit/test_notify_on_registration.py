"""Tests for the DynamoDB Stream -> SES/SNS notification handler.

SES and SNS calls are replaced with mocks so assertions can check exactly
what was sent (recipient, subject, that the QR is embedded) without fighting
moto's SES raw-email simulation fidelity. DynamoDB and S3 stay real
(moto-backed) since those interactions -- reading the event and fetching the
QR bytes -- are the part worth testing end-to-end.
"""
import json
from unittest.mock import MagicMock

from conftest import FAKE_CONTEXT, admin_claims, api_event, load_function_module

create_event = load_function_module("create_event")
register_for_event = load_function_module("register_for_event", "handler.py")
notify_module = load_function_module("notify_on_registration")


def _create_and_register(aws_stack) -> dict:
    event_item = json.loads(
        create_event.lambda_handler(
            api_event(
                body=json.dumps(
                    {
                        "title": "Cloud Bootcamp",
                        "venue": "Innovation Hub",
                        "startDateTime": "2026-12-01T09:00:00+00:00",
                        "endDateTime": "2026-12-01T17:00:00+00:00",
                        "capacity": 5,
                        "status": "PUBLISHED",
                    }
                ),
                claims=admin_claims(),
            ),
            FAKE_CONTEXT,
        )["body"]
    )
    return json.loads(
        register_for_event.lambda_handler(
            api_event(
                path_params={"eventId": event_item["eventId"]},
                body=json.dumps({"attendeeName": "Ama Serwaa", "attendeeEmail": "ama@example.com"}),
            ),
            FAKE_CONTEXT,
        )["body"]
    )


def test_notify_sends_email_and_publishes_ops_alert(aws_stack, monkeypatch):
    registration = _create_and_register(aws_stack)

    fake_ses = MagicMock()
    fake_sns = MagicMock()
    monkeypatch.setattr(notify_module, "_ses", fake_ses)
    monkeypatch.setattr(notify_module, "_sns", fake_sns)

    registration_item = aws_stack["dynamodb"].get_item(
        TableName="registrations-test", Key={"PK": {"S": registration["registrationId"]}}
    )["Item"]
    stream_event = {"Records": [{"eventName": "INSERT", "dynamodb": {"NewImage": registration_item}}]}

    notify_module.lambda_handler(stream_event, FAKE_CONTEXT)

    fake_ses.send_raw_email.assert_called_once()
    call_kwargs = fake_ses.send_raw_email.call_args.kwargs
    assert call_kwargs["Destinations"] == ["ama@example.com"]
    assert b"ticket-qr" in call_kwargs["RawMessage"]["Data"]

    fake_sns.publish.assert_called_once()
    assert "Ama Serwaa" in fake_sns.publish.call_args.kwargs["Message"]


def test_notify_ignores_lock_item_inserts(aws_stack, monkeypatch):
    fake_ses = MagicMock()
    fake_sns = MagicMock()
    monkeypatch.setattr(notify_module, "_ses", fake_ses)
    monkeypatch.setattr(notify_module, "_sns", fake_sns)

    lock_item = {
        "PK": {"S": "LOCK#event-1#someone@example.com"},
        "type": {"S": "LOCK"},
        "eventId": {"S": "event-1"},
    }
    stream_event = {"Records": [{"eventName": "INSERT", "dynamodb": {"NewImage": lock_item}}]}

    notify_module.lambda_handler(stream_event, FAKE_CONTEXT)

    fake_ses.send_raw_email.assert_not_called()
    fake_sns.publish.assert_not_called()


def test_notify_ignores_non_insert_events(aws_stack, monkeypatch):
    fake_ses = MagicMock()
    fake_sns = MagicMock()
    monkeypatch.setattr(notify_module, "_ses", fake_ses)
    monkeypatch.setattr(notify_module, "_sns", fake_sns)

    registration = _create_and_register(aws_stack)
    registration_item = aws_stack["dynamodb"].get_item(
        TableName="registrations-test", Key={"PK": {"S": registration["registrationId"]}}
    )["Item"]
    stream_event = {"Records": [{"eventName": "MODIFY", "dynamodb": {"NewImage": registration_item}}]}

    notify_module.lambda_handler(stream_event, FAKE_CONTEXT)

    fake_ses.send_raw_email.assert_not_called()
