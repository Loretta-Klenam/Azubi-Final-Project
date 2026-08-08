"""Builds every stack once per test session and hands back the constructs so
individual test modules can run `Template.from_stack(...)` against them.
Synthesizing (via PythonLayerVersion) needs Docker, same as a real
`cdk synth` -- these tests are the CDK-native replacement for hand-running
`cdk synth` to eyeball the template.
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import aws_cdk as cdk
import pytest

INFRA_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(INFRA_ROOT))

from stacks.api_stack import ApiStack  # noqa: E402
from stacks.auth_stack import AuthStack  # noqa: E402
from stacks.data_stack import DataStack  # noqa: E402
from stacks.frontend_stack import FrontendStack  # noqa: E402
from stacks.monitoring_stack import MonitoringStack  # noqa: E402
from stacks.notifications_stack import NotificationsStack  # noqa: E402
from stacks.storage_stack import StorageStack  # noqa: E402

FAKE_CONFIG = SimpleNamespace(
    project_name="event-ticketing-test",
    region="us-east-1",
    account="123456789012",
    budget_limit_usd="5",
    admin_alert_email="ops@example.com",
    ses_sender_email="noreply@example.com",
)


@pytest.fixture(scope="session")
def stacks() -> dict:
    app = cdk.App()
    env = cdk.Environment(account=FAKE_CONFIG.account, region=FAKE_CONFIG.region)

    data_stack = DataStack(app, "TestDataStack", env=env)
    auth_stack = AuthStack(app, "TestAuthStack", env=env)
    storage_stack = StorageStack(app, "TestStorageStack", env=env)
    notifications_stack = NotificationsStack(app, "TestNotificationsStack", config=FAKE_CONFIG, env=env)
    frontend_stack = FrontendStack(app, "TestFrontendStack", env=env)

    api_stack = ApiStack(
        app,
        "TestApiStack",
        config=FAKE_CONFIG,
        events_table=data_stack.events_table,
        registrations_table=data_stack.registrations_table,
        user_pool=auth_stack.user_pool,
        attendee_user_pool=auth_stack.attendee_user_pool,
        tickets_bucket=storage_stack.tickets_bucket,
        ops_topic=notifications_stack.ops_topic,
        sender_identity=notifications_stack.sender_identity,
        frontend_domain_name=frontend_stack.distribution.distribution_domain_name,
        env=env,
    )

    monitoring_stack = MonitoringStack(
        app,
        "TestMonitoringStack",
        config=FAKE_CONFIG,
        api=api_stack.api,
        lambda_functions=api_stack.all_functions,
        events_table=data_stack.events_table,
        registrations_table=data_stack.registrations_table,
        alert_topic=notifications_stack.ops_topic,
        env=env,
    )

    return {
        "data": data_stack,
        "auth": auth_stack,
        "storage": storage_stack,
        "notifications": notifications_stack,
        "frontend": frontend_stack,
        "api": api_stack,
        "monitoring": monitoring_stack,
    }
