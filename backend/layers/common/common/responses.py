"""API Gateway (Lambda proxy integration) response helpers."""
from __future__ import annotations

import json
import os
from decimal import Decimal
from typing import Any

# Set per-function by CDK to the deployed CloudFront domain. Defaults to "*"
# for local/unit-test runs. Wildcard is safe here because the API uses
# bearer-token (Cognito JWT) auth for admin routes, never cookies -- there is
# no ambient credential for a wildcard origin to leak.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")


def _json_default(value: Any) -> Any:
    """DynamoDB returns numbers as Decimal; json.dumps doesn't know them."""
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def build_response(status_code: int, body: Any, *, headers: dict | None = None) -> dict:
    response_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    }
    if headers:
        response_headers.update(headers)
    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body, default=_json_default),
    }
