"""S3 bucket for generated ticket QR codes.

Private end to end: register_for_event writes here, and reads only ever
happen through short-lived presigned URLs generated on demand (see
get_registration and notify_on_registration) -- nothing in this bucket is
ever public. See docs/adr/0004-qr-ticket-storage.md.
"""
from __future__ import annotations

from aws_cdk import Duration, RemovalPolicy, Stack
from aws_cdk import aws_s3 as s3

from constructs import Construct


class StorageStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.tickets_bucket = s3.Bucket(
            self,
            "TicketsBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.RETAIN,
            lifecycle_rules=[
                # Tickets are only useful around the event date; this bounds
                # storage cost/free-tier usage without needing manual cleanup.
                s3.LifecycleRule(id="ExpireTicketsAfterOneYear", expiration=Duration.days(365)),
            ],
        )
