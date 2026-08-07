"""Deployment configuration, sourced from CDK context (`-c key=value` on the
CLI, or the `context` block in cdk.json). Kept separate from the stacks so
every stack that needs a config value reads it the same way, and so the
"you forgot to set this" errors surface once, early, with an actionable
message instead of failing deep inside a stack with a cryptic CFN error.
"""
from __future__ import annotations

from aws_cdk import App

DEFAULT_PROJECT_NAME = "event-ticketing"
DEFAULT_BUDGET_LIMIT_USD = "5"
DEFAULT_REGION = "us-east-1"


class AppConfig:
    def __init__(self, app: App) -> None:
        self.project_name: str = app.node.try_get_context("projectName") or DEFAULT_PROJECT_NAME
        self.region: str = app.node.try_get_context("region") or DEFAULT_REGION
        self.account: str | None = app.node.try_get_context("account")
        self.budget_limit_usd: str = (
            app.node.try_get_context("budgetLimitUsd") or DEFAULT_BUDGET_LIMIT_USD
        )

        self.admin_alert_email: str | None = app.node.try_get_context("adminAlertEmail")
        self.ses_sender_email: str | None = app.node.try_get_context("sesSenderEmail")

        if not self.admin_alert_email:
            raise ValueError(
                "Missing required CDK context 'adminAlertEmail' (where CloudWatch alarm and "
                "budget notifications are sent). Pass it with "
                "`cdk deploy -c adminAlertEmail=you@example.com`, or add it to cdk.json. "
                "See docs/deployment.md."
            )
        if not self.ses_sender_email:
            raise ValueError(
                "Missing required CDK context 'sesSenderEmail' (the 'From' address for "
                "attendee confirmation emails -- must be verified in SES before it can send). "
                "Pass it with `cdk deploy -c sesSenderEmail=noreply@example.com`. "
                "See docs/deployment.md."
            )
