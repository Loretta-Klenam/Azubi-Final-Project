"""Shared pytest fixtures for backend unit tests.

Every Lambda function lives in its own `backend/functions/<name>/` folder
and each defines `handler.py` -- a plain `import handler` would collide
across tests, so `load_function_module` loads each one under a unique
module name via importlib, the same way a Lambda layer + function bundle
combine at runtime (the shared `common` package on sys.path, the function's
own folder on sys.path for any function-local modules like `qr.py`).
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

BACKEND_ROOT = Path(__file__).resolve().parents[1]
COMMON_LAYER_ROOT = BACKEND_ROOT / "layers" / "common"
TICKETING_LAYER_ROOT = BACKEND_ROOT / "layers" / "ticketing"
FUNCTIONS_ROOT = BACKEND_ROOT / "functions"

sys.path.insert(0, str(COMMON_LAYER_ROOT))

REGION = "us-east-1"
EVENTS_TABLE_NAME = "events-test"
REGISTRATIONS_TABLE_NAME = "registrations-test"
TICKETS_BUCKET_NAME = "tickets-test-bucket"

# Handler modules create their boto3 clients/resources at *import* time (as
# they would under a real Lambda cold start), and test modules import them at
# collection time via `load_function_module` -- before any per-test fixture
# has run. These process-wide defaults just need to exist so client
# construction doesn't blow up on a missing region; moto intercepts the
# actual API calls regardless of when the client object was created.
os.environ.setdefault("AWS_DEFAULT_REGION", REGION)
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("EVENTS_TABLE_NAME", EVENTS_TABLE_NAME)
os.environ.setdefault("REGISTRATIONS_TABLE_NAME", REGISTRATIONS_TABLE_NAME)
os.environ.setdefault("TICKETS_BUCKET_NAME", TICKETS_BUCKET_NAME)
os.environ.setdefault("SES_SENDER_EMAIL", "noreply@example.com")
os.environ.setdefault("SNS_OPS_TOPIC_ARN", f"arn:aws:sns:{REGION}:123456789012:ops-topic")
os.environ.setdefault("FRONTEND_BASE_URL", "https://tickets.example.com")
os.environ.setdefault("ALLOWED_ORIGIN", "*")
os.environ.setdefault("POWERTOOLS_METRICS_NAMESPACE", "EventTicketing")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "event-ticketing-test")
os.environ.setdefault("POWERTOOLS_TRACE_DISABLED", "true")


def load_function_module(function_name: str, module_filename: str = "handler.py"):
    function_dir = FUNCTIONS_ROOT / function_name
    if str(function_dir) not in sys.path:
        sys.path.insert(0, str(function_dir))

    module_path = function_dir / module_filename
    module_name = f"{function_name}__{module_filename.removesuffix('.py')}"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(autouse=True)
def _lambda_environment(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", REGION)

    monkeypatch.setenv("EVENTS_TABLE_NAME", EVENTS_TABLE_NAME)
    monkeypatch.setenv("REGISTRATIONS_TABLE_NAME", REGISTRATIONS_TABLE_NAME)
    monkeypatch.setenv("TICKETS_BUCKET_NAME", TICKETS_BUCKET_NAME)
    monkeypatch.setenv("SES_SENDER_EMAIL", "noreply@example.com")
    monkeypatch.setenv("SNS_OPS_TOPIC_ARN", f"arn:aws:sns:{REGION}:123456789012:ops-topic")
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://tickets.example.com")
    monkeypatch.setenv("ALLOWED_ORIGIN", "*")

    monkeypatch.setenv("POWERTOOLS_METRICS_NAMESPACE", "EventTicketing")
    monkeypatch.setenv("POWERTOOLS_SERVICE_NAME", "event-ticketing-test")
    monkeypatch.setenv("POWERTOOLS_TRACE_DISABLED", "true")


@pytest.fixture
def aws_stack(_lambda_environment):
    """A moto-mocked AWS account with both tables and the tickets bucket."""
    with mock_aws():
        ddb = boto3.client("dynamodb", region_name=REGION)
        ddb.create_table(
            TableName=EVENTS_TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            KeySchema=[{"AttributeName": "eventId", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "eventId", "AttributeType": "S"},
                {"AttributeName": "status", "AttributeType": "S"},
                {"AttributeName": "startDateTime", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "StatusStartDateIndex",
                    "KeySchema": [
                        {"AttributeName": "status", "KeyType": "HASH"},
                        {"AttributeName": "startDateTime", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        )
        ddb.create_table(
            TableName=REGISTRATIONS_TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "eventId", "AttributeType": "S"},
                {"AttributeName": "registeredAt", "AttributeType": "S"},
                {"AttributeName": "attendeeEmail", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "EventIndex",
                    "KeySchema": [
                        {"AttributeName": "eventId", "KeyType": "HASH"},
                        {"AttributeName": "registeredAt", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
                {
                    "IndexName": "EmailIndex",
                    "KeySchema": [
                        {"AttributeName": "attendeeEmail", "KeyType": "HASH"},
                        {"AttributeName": "registeredAt", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
            ],
        )

        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(Bucket=TICKETS_BUCKET_NAME)

        sns = boto3.client("sns", region_name=REGION)
        sns.create_topic(Name="ops-topic")

        ses = boto3.client("ses", region_name=REGION)
        ses.verify_email_identity(EmailAddress="noreply@example.com")

        yield {"dynamodb": ddb, "s3": s3, "sns": sns, "ses": ses}


def api_event(
    *,
    path_params: dict | None = None,
    query_params: dict | None = None,
    body: str | None = None,
    claims: dict | None = None,
) -> dict:
    """Build a minimal API Gateway REST (Lambda proxy) event."""
    event: dict = {
        "pathParameters": path_params,
        "queryStringParameters": query_params,
        "body": body,
        "isBase64Encoded": False,
        "requestContext": {},
    }
    if claims:
        event["requestContext"]["authorizer"] = {"claims": claims}
    return event


def admin_claims(sub: str = "admin-sub-123") -> dict:
    return {"sub": sub, "cognito:groups": "Admins"}


class FakeLambdaContext:
    """Minimal stand-in for the real Lambda context object -- Powertools'
    logging/tracing decorators read a few attributes off it even outside a
    real Lambda runtime."""

    function_name = "test-function"
    memory_limit_in_mb = 128
    invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:test-function"
    aws_request_id = "test-request-id"


FAKE_CONTEXT = FakeLambdaContext()
