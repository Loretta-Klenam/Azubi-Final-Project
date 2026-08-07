import json

from conftest import FAKE_CONTEXT, admin_claims, api_event, load_function_module

create_event = load_function_module("create_event")
register_for_event = load_function_module("register_for_event", "handler.py")
list_registrations_for_event = load_function_module("list_registrations_for_event")


def _create_published_event(**overrides) -> dict:
    body = {
        "title": "Cloud Bootcamp",
        "venue": "Innovation Hub",
        "startDateTime": "2026-12-01T09:00:00+00:00",
        "endDateTime": "2026-12-01T17:00:00+00:00",
        "capacity": 10,
        "status": "PUBLISHED",
    }
    body.update(overrides)
    response = create_event.lambda_handler(
        api_event(body=json.dumps(body), claims=admin_claims()), FAKE_CONTEXT
    )
    return json.loads(response["body"])


def _register(event_id: str, email: str) -> None:
    body = {"attendeeName": "Attendee", "attendeeEmail": email}
    response = register_for_event.lambda_handler(
        api_event(path_params={"eventId": event_id}, body=json.dumps(body)), FAKE_CONTEXT
    )
    assert response["statusCode"] == 201


def test_list_registrations_requires_admin(aws_stack):
    event_item = _create_published_event()
    response = list_registrations_for_event.lambda_handler(
        api_event(path_params={"eventId": event_item["eventId"]}), FAKE_CONTEXT
    )
    assert response["statusCode"] == 403


def test_list_registrations_only_returns_this_event(aws_stack):
    event_a = _create_published_event(title="Event A")
    event_b = _create_published_event(title="Event B")
    _register(event_a["eventId"], "a1@example.com")
    _register(event_a["eventId"], "a2@example.com")
    _register(event_b["eventId"], "b1@example.com")

    response = list_registrations_for_event.lambda_handler(
        api_event(path_params={"eventId": event_a["eventId"]}, claims=admin_claims()), FAKE_CONTEXT
    )
    assert response["statusCode"] == 200
    items = json.loads(response["body"])["items"]
    assert len(items) == 2
    assert {item["attendeeEmail"] for item in items} == {"a1@example.com", "a2@example.com"}
    # Lock items must never leak into the registrant list.
    assert all(item["type"] == "REGISTRATION" for item in items)


def test_register_rejects_after_event_has_started(aws_stack):
    past_event = _create_published_event(
        startDateTime="2020-01-01T09:00:00+00:00", endDateTime="2020-01-01T17:00:00+00:00"
    )
    response = register_for_event.lambda_handler(
        api_event(
            path_params={"eventId": past_event["eventId"]},
            body=json.dumps({"attendeeName": "Late Comer", "attendeeEmail": "late@example.com"}),
        ),
        FAKE_CONTEXT,
    )
    assert response["statusCode"] == 409
    assert json.loads(response["body"])["errorCode"] == "REGISTRATION_CLOSED"
