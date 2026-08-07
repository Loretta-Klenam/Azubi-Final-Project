import json

from conftest import FAKE_CONTEXT, admin_claims, api_event, load_function_module

create_event = load_function_module("create_event")
update_event = load_function_module("update_event")
delete_event = load_function_module("delete_event")
list_events = load_function_module("list_events")
get_event = load_function_module("get_event")


def _create(aws_stack, **overrides):
    body = {
        "title": "AWS Community Day",
        "venue": "Accra Digital Centre",
        "startDateTime": "2026-12-01T09:00:00+00:00",
        "endDateTime": "2026-12-01T17:00:00+00:00",
        "capacity": 2,
        "status": "PUBLISHED",
    }
    body.update(overrides)
    event = api_event(body=json.dumps(body), claims=admin_claims())
    response = create_event.lambda_handler(event, FAKE_CONTEXT)
    return json.loads(response["body"]), response


def test_create_event_requires_admin(aws_stack):
    event = api_event(body=json.dumps({"title": "x"}))
    response = create_event.lambda_handler(event, FAKE_CONTEXT)
    assert response["statusCode"] == 403


def test_create_event_validates_dates(aws_stack):
    event = api_event(
        body=json.dumps(
            {
                "title": "Bad Event",
                "venue": "Somewhere",
                "startDateTime": "2026-12-01T17:00:00+00:00",
                "endDateTime": "2026-12-01T09:00:00+00:00",
                "capacity": 10,
            }
        ),
        claims=admin_claims(),
    )
    response = create_event.lambda_handler(event, FAKE_CONTEXT)
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert body["errorCode"] == "VALIDATION_ERROR"


def test_create_then_get_event(aws_stack):
    created, response = _create(aws_stack)
    assert response["statusCode"] == 201
    assert created["status"] == "PUBLISHED"
    assert created["registeredCount"] == 0

    public_get = get_event.lambda_handler(api_event(path_params={"eventId": created["eventId"]}), FAKE_CONTEXT)
    assert public_get["statusCode"] == 200
    assert json.loads(public_get["body"])["eventId"] == created["eventId"]


def test_public_get_hides_draft_events(aws_stack):
    created, _ = _create(aws_stack, status="DRAFT")

    public_get = get_event.lambda_handler(api_event(path_params={"eventId": created["eventId"]}), FAKE_CONTEXT)
    assert public_get["statusCode"] == 404

    admin_get = get_event.lambda_handler(
        api_event(path_params={"eventId": created["eventId"]}, claims=admin_claims()), FAKE_CONTEXT
    )
    assert admin_get["statusCode"] == 200


def test_public_list_only_returns_published(aws_stack):
    _create(aws_stack, title="Published One")
    _create(aws_stack, title="Draft One", status="DRAFT")

    public_list = list_events.lambda_handler(api_event(), FAKE_CONTEXT)
    items = json.loads(public_list["body"])["items"]
    assert len(items) == 1
    assert items[0]["title"] == "Published One"

    admin_list = list_events.lambda_handler(api_event(claims=admin_claims()), FAKE_CONTEXT)
    admin_items = json.loads(admin_list["body"])["items"]
    assert len(admin_items) == 2


def test_update_event_partial(aws_stack):
    created, _ = _create(aws_stack)
    event = api_event(
        path_params={"eventId": created["eventId"]},
        body=json.dumps({"capacity": 500}),
        claims=admin_claims(),
    )
    response = update_event.lambda_handler(event, FAKE_CONTEXT)
    assert response["statusCode"] == 200
    updated = json.loads(response["body"])
    assert updated["capacity"] == 500
    assert updated["title"] == created["title"]


def test_update_missing_event_returns_404(aws_stack):
    event = api_event(
        path_params={"eventId": "does-not-exist"},
        body=json.dumps({"capacity": 500}),
        claims=admin_claims(),
    )
    response = update_event.lambda_handler(event, FAKE_CONTEXT)
    assert response["statusCode"] == 404


def test_delete_event_blocks_when_registrants_present(aws_stack):
    created, _ = _create(aws_stack)
    aws_stack["dynamodb"].update_item(
        TableName="events-test",
        Key={"eventId": {"S": created["eventId"]}},
        UpdateExpression="SET registeredCount = :one",
        ExpressionAttributeValues={":one": {"N": "1"}},
    )
    response = delete_event.lambda_handler(
        api_event(path_params={"eventId": created["eventId"]}, claims=admin_claims()), FAKE_CONTEXT
    )
    assert response["statusCode"] == 409
    assert json.loads(response["body"])["errorCode"] == "EVENT_HAS_REGISTRANTS"


def test_delete_event_succeeds_when_empty(aws_stack):
    created, _ = _create(aws_stack)
    response = delete_event.lambda_handler(
        api_event(path_params={"eventId": created["eventId"]}, claims=admin_claims()), FAKE_CONTEXT
    )
    assert response["statusCode"] == 200
