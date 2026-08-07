"""DynamoDB table accessors and a TransactWriteItems helper.

Reads use the high-level `boto3.resource` Table API (native Python types).
Writes that need `TransactWriteItems` must go through the low-level client,
which speaks DynamoDB's `{"S": "..."}` attribute-value format -- `to_dynamo_item`
bridges that gap so handler code can keep building plain Python dicts.
"""
from __future__ import annotations

import os
from typing import Optional

from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from . import aws_clients
from .errors import AppError, ConflictError

_resource = aws_clients.resource("dynamodb")
_client = aws_clients.client("dynamodb")
_serializer = TypeSerializer()


def events_table():
    return _resource.Table(os.environ["EVENTS_TABLE_NAME"])


def registrations_table():
    return _resource.Table(os.environ["REGISTRATIONS_TABLE_NAME"])


def dynamo_client():
    return _client


def to_dynamo_item(item: dict) -> dict:
    """Convert a plain Python dict to DynamoDB's low-level AttributeValue map."""
    return {key: _serializer.serialize(value) for key, value in item.items()}


def transact_write(transact_items: list[dict], failure_map: Optional[dict] = None) -> None:
    """Run a TransactWriteItems call, translating a failed condition on a
    specific item (by index) into the caller-supplied AppError, so e.g. a
    failed uniqueness check and a failed capacity check can return distinct,
    actionable error codes instead of one generic 409.
    """
    try:
        _client.transact_write_items(TransactItems=transact_items)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "TransactionCanceledException":
            raise
        reasons = exc.response.get("CancellationReasons", [])
        if failure_map:
            for index, reason in enumerate(reasons):
                if reason.get("Code") == "ConditionalCheckFailed" and index in failure_map:
                    raise failure_map[index] from exc
        raise ConflictError(
            "The operation could not be completed due to a conflicting change.",
        ) from exc
