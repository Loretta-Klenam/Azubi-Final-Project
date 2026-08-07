"""Shared boto3 client/resource factory with explicit network timeouts.

Lambda applies no default timeout to a boto3 call; without one, a stalled
downstream dependency (S3, SES, SNS, DynamoDB) can hang until the *entire*
Lambda invocation times out, instead of failing fast so the caller gets a
clean error and the retry/DLQ machinery (where configured) can take over.
"""
import boto3
from botocore.config import Config

BOTO_CONFIG = Config(
    connect_timeout=5,
    read_timeout=10,
    retries={"max_attempts": 3, "mode": "standard"},
)


def client(service_name: str):
    return boto3.client(service_name, config=BOTO_CONFIG)


def resource(service_name: str):
    return boto3.resource(service_name, config=BOTO_CONFIG)
