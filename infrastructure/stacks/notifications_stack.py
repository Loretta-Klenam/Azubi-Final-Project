"""SNS (ops alerting) and SES (attendee-facing email) -- two different jobs,
two different services. See docs/adr/0003-notification-architecture.md for
why this split exists instead of using one service for both.
"""
from __future__ import annotations

from aws_cdk import Stack
from aws_cdk import aws_ses as ses
from aws_cdk import aws_sns as sns
from aws_cdk import aws_sns_subscriptions as subscriptions
from constructs import Construct

from config import AppConfig


class NotificationsStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, *, config: AppConfig, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Ops channel: CloudWatch alarms and "new registration" pings land
        # here, for the team running the event -- not attendees.
        self.ops_topic = sns.Topic(
            self,
            "OpsTopic",
            topic_name="event-ticketing-ops-alerts",
            display_name="Event Ticketing Ops Alerts",
        )
        self.ops_topic.add_subscription(subscriptions.EmailSubscription(config.admin_alert_email))

        # Attendee-facing channel: SES is the correct AWS service for
        # sending a one-off transactional email to an arbitrary address (SNS
        # email subscriptions require the recipient to confirm a
        # subscription first, which doesn't fit a one-time ticket email).
        #
        # New SES accounts start in the sandbox: only verified identities
        # can send, and mail can only be received by other verified
        # identities, until production access is requested. CDK creates the
        # identity resource, but the verification step (AWS emails a link to
        # this address) is manual -- see docs/deployment.md.
        self.sender_identity = ses.EmailIdentity(
            self,
            "SenderIdentity",
            identity=ses.Identity.email(config.ses_sender_email),
        )
