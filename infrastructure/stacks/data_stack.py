"""DynamoDB tables: the system of record, replacing the Excel sheet.

Two tables, on-demand billing (no capacity planning for a workload this
spiky -- idle between events, bursty during registration windows -- and it
keeps this comfortably inside the DynamoDB free tier).

`registrations` also holds short-lived "lock" items (see
docs/adr/0001-dynamodb-transactional-integrity.md) used to make duplicate
registration and overbooking impossible under concurrent requests -- the one
thing an Excel sheet structurally cannot guarantee.

RemovalPolicy.RETAIN on both tables is deliberate: this is real registrant
data, and an accidental `cdk destroy` should not silently delete it. Tearing
the project down for real requires deleting the tables manually (documented
in docs/deployment.md).
"""
from __future__ import annotations

from aws_cdk import RemovalPolicy, Stack
from aws_cdk import aws_dynamodb as dynamodb
from constructs import Construct


class DataStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.events_table = dynamodb.Table(
            self,
            "EventsTable",
            partition_key=dynamodb.Attribute(name="eventId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )
        # Public "list published events, soonest first" query, and the
        # admin dashboard's per-status filter -- both without a table Scan.
        self.events_table.add_global_secondary_index(
            index_name="StatusStartDateIndex",
            partition_key=dynamodb.Attribute(name="status", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="startDateTime", type=dynamodb.AttributeType.STRING),
        )

        self.registrations_table = dynamodb.Table(
            self,
            "RegistrationsTable",
            # PK holds either a real registrationId (UUID) for REGISTRATION
            # items, or a "LOCK#{eventId}#{email}" string for the uniqueness
            # lock items used by the registration transaction.
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            removal_policy=RemovalPolicy.RETAIN,
            # Feeds notify_on_registration asynchronously (see api_stack.py).
            # NEW_IMAGE is enough: the notification function only needs the
            # post-write state, never the pre-write state.
            stream=dynamodb.StreamViewType.NEW_IMAGE,
        )
        # Admin "registrants for this event" list. LOCK items never appear
        # here: they have no `registeredAt` attribute, so DynamoDB excludes
        # them from this index's projection automatically.
        self.registrations_table.add_global_secondary_index(
            index_name="EventIndex",
            partition_key=dynamodb.Attribute(name="eventId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="registeredAt", type=dynamodb.AttributeType.STRING),
        )
        # Support/admin "find this attendee's registrations by email" --
        # NOT used for duplicate-registration prevention (that's the lock
        # item transaction); this is a separate, legitimate access pattern.
        self.registrations_table.add_global_secondary_index(
            index_name="EmailIndex",
            partition_key=dynamodb.Attribute(name="attendeeEmail", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="registeredAt", type=dynamodb.AttributeType.STRING),
        )
        # "My tickets": an authenticated attendee's own registrations.
        # Populated only for registrations made through the authenticated
        # POST /me/events/{eventId}/registrations route -- anonymous
        # registrations have no userId attribute and simply never appear in
        # this index (DynamoDB omits items missing the GSI's key attribute).
        self.registrations_table.add_global_secondary_index(
            index_name="UserIndex",
            partition_key=dynamodb.Attribute(name="userId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="registeredAt", type=dynamodb.AttributeType.STRING),
        )
