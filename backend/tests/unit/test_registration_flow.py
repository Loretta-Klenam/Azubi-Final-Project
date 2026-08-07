import json

from conftest import FAKE_CONTEXT, admin_claims, api_event, load_function_module

create_event = load_function_module("create_event")
register_for_event = load_function_module("register_for_event", "handler.py")
get_registration = load_function_module("get_registration")
cancel_registration = load_function_module("cancel_registration")


def _create_published_event(capacity: int = 1, **overrides) -> dict:
    body = {
        "title": "Cloud Bootcamp",
        "venue": "Innovation Hub",
        "startDateTime": "2026-12-01T09:00:00+00:00",
        "endDateTime": "2026-12-01T17:00:00+00:00",
        "capacity": capacity,
        "status": "PUBLISHED",
    }
    body.update(overrides)
    response = create_event.lambda_handler(
        api_event(body=json.dumps(body), claims=admin_claims()), FAKE_CONTEXT
    )
    return json.loads(response["body"])


def _register(event_id: str, name: str = "Ama Serwaa", email: str = "ama@example.com"):
    body = {"attendeeName": name, "attendeeEmail": email}
    return register_for_event.lambda_handler(
        api_event(path_params={"eventId": event_id}, body=json.dumps(body)), FAKE_CONTEXT
    )


def test_register_success_returns_ticket(aws_stack):
    event_item = _create_published_event(capacity=5)
    response = _register(event_item["eventId"])
    assert response["statusCode"] == 201
    body = json.loads(response["body"])
    assert body["confirmationCode"]
    assert body["ticketQrUrl"].startswith("https://")


def test_register_rejects_duplicate_email(aws_stack):
    event_item = _create_published_event(capacity=5)
    first = _register(event_item["eventId"])
    assert first["statusCode"] == 201

    second = _register(event_item["eventId"])
    assert second["statusCode"] == 409
    assert json.loads(second["body"])["errorCode"] == "DUPLICATE_REGISTRATION"


def test_register_rejects_when_sold_out(aws_stack):
    event_item = _create_published_event(capacity=1)
    first = _register(event_item["eventId"], email="one@example.com")
    assert first["statusCode"] == 201

    second = _register(event_item["eventId"], email="two@example.com")
    assert second["statusCode"] == 409
    assert json.loads(second["body"])["errorCode"] == "EVENT_SOLD_OUT"


def test_register_rejects_unpublished_event(aws_stack):
    event_item = _create_published_event(capacity=5, status="DRAFT")
    response = _register(event_item["eventId"])
    assert response["statusCode"] == 409
    assert json.loads(response["body"])["errorCode"] == "EVENT_NOT_PUBLISHED"


def test_register_validates_email_format(aws_stack):
    event_item = _create_published_event(capacity=5)
    response = register_for_event.lambda_handler(
        api_event(
            path_params={"eventId": event_item["eventId"]},
            body=json.dumps({"attendeeName": "Someone", "attendeeEmail": "not-an-email"}),
        ),
        FAKE_CONTEXT,
    )
    assert response["statusCode"] == 400


def test_get_registration_requires_matching_code(aws_stack):
    event_item = _create_published_event(capacity=5)
    registration = json.loads(_register(event_item["eventId"])["body"])

    wrong_code = get_registration.lambda_handler(
        api_event(
            path_params={"registrationId": registration["registrationId"]},
            query_params={"code": "WRONGCODE"},
        ),
        FAKE_CONTEXT,
    )
    assert wrong_code["statusCode"] == 404

    right_code = get_registration.lambda_handler(
        api_event(
            path_params={"registrationId": registration["registrationId"]},
            query_params={"code": registration["confirmationCode"]},
        ),
        FAKE_CONTEXT,
    )
    assert right_code["statusCode"] == 200
    body = json.loads(right_code["body"])
    assert body["status"] == "CONFIRMED"
    assert body["event"]["title"] == "Cloud Bootcamp"


def test_cancel_then_reregister_same_email(aws_stack):
    event_item = _create_published_event(capacity=1)
    registration = json.loads(_register(event_item["eventId"], email="ama@example.com")["body"])

    cancel_response = cancel_registration.lambda_handler(
        api_event(
            path_params={"registrationId": registration["registrationId"]},
            query_params={"code": registration["confirmationCode"]},
        ),
        FAKE_CONTEXT,
    )
    assert cancel_response["statusCode"] == 200
    assert json.loads(cancel_response["body"])["status"] == "CANCELLED"

    # Capacity was freed and the uniqueness lock was released, so the same
    # email can register again -- this is the exact bug the design review
    # caught in the first draft (cancel never released the lock item).
    second_attempt = _register(event_item["eventId"], email="ama@example.com")
    assert second_attempt["statusCode"] == 201


def test_cancel_twice_is_rejected(aws_stack):
    event_item = _create_published_event(capacity=5)
    registration = json.loads(_register(event_item["eventId"])["body"])
    path_and_query = {
        "path_params": {"registrationId": registration["registrationId"]},
        "query_params": {"code": registration["confirmationCode"]},
    }

    first_cancel = cancel_registration.lambda_handler(api_event(**path_and_query), FAKE_CONTEXT)
    assert first_cancel["statusCode"] == 200

    second_cancel = cancel_registration.lambda_handler(api_event(**path_and_query), FAKE_CONTEXT)
    assert second_cancel["statusCode"] == 409
    assert json.loads(second_cancel["body"])["errorCode"] == "ALREADY_CANCELLED"


def test_admin_can_cancel_without_code(aws_stack):
    event_item = _create_published_event(capacity=5)
    registration = json.loads(_register(event_item["eventId"])["body"])

    response = cancel_registration.lambda_handler(
        api_event(path_params={"registrationId": registration["registrationId"]}, claims=admin_claims()),
        FAKE_CONTEXT,
    )
    assert response["statusCode"] == 200
