#!/usr/bin/env python3
"""CDK app entrypoint.

Stacks are instantiated in dependency order because later stacks need
concrete references (table objects, the user pool, the CloudFront domain
name) from earlier ones -- CDK resolves the actual deploy order from these
references automatically, this ordering just has to satisfy Python's normal
"define before use" rule.

FrontendStack is created before ApiStack (even though, conceptually, "the
API" feels more foundational than "the frontend") specifically so ApiStack
can inject the real CloudFront domain into Lambda environment variables
(ALLOWED_ORIGIN, FRONTEND_BASE_URL) instead of a placeholder.
"""
import aws_cdk as cdk

from config import AppConfig
from stacks.api_stack import ApiStack
from stacks.auth_stack import AuthStack
from stacks.data_stack import DataStack
from stacks.frontend_stack import FrontendStack
from stacks.monitoring_stack import MonitoringStack
from stacks.notifications_stack import NotificationsStack
from stacks.storage_stack import StorageStack

app = cdk.App()
config = AppConfig(app)

env = cdk.Environment(account=config.account, region=config.region)
tags = {"project": config.project_name, "managed-by": "cdk"}


def stack_name(suffix: str) -> str:
    return f"{config.project_name}-{suffix}"


data_stack = DataStack(app, stack_name("data"), env=env, tags=tags)
auth_stack = AuthStack(app, stack_name("auth"), env=env, tags=tags)
storage_stack = StorageStack(app, stack_name("storage"), env=env, tags=tags)
notifications_stack = NotificationsStack(
    app, stack_name("notifications"), config=config, env=env, tags=tags
)
frontend_stack = FrontendStack(app, stack_name("frontend"), env=env, tags=tags)

api_stack = ApiStack(
    app,
    stack_name("api"),
    config=config,
    events_table=data_stack.events_table,
    registrations_table=data_stack.registrations_table,
    user_pool=auth_stack.user_pool,
    tickets_bucket=storage_stack.tickets_bucket,
    ops_topic=notifications_stack.ops_topic,
    sender_identity=notifications_stack.sender_identity,
    frontend_domain_name=frontend_stack.distribution.distribution_domain_name,
    env=env,
    tags=tags,
)
for dependency in (data_stack, auth_stack, storage_stack, notifications_stack, frontend_stack):
    api_stack.add_stack_dependency(dependency)

monitoring_stack = MonitoringStack(
    app,
    stack_name("monitoring"),
    config=config,
    api=api_stack.api,
    lambda_functions=api_stack.all_functions,
    events_table=data_stack.events_table,
    registrations_table=data_stack.registrations_table,
    alert_topic=notifications_stack.ops_topic,
    env=env,
    tags=tags,
)
monitoring_stack.add_stack_dependency(api_stack)

# cdk-nag (AwsSolutionsChecks) was evaluated for automated security-best-
# practice linting on every synth, but cdk-nag 3.0.2's published jsii
# assembly is incompatible with this aws-cdk-lib release (an IAspect.visit
# signature mismatch surfaces as a jsii RuntimeError at synth time) -- see
# docs/adr/0005-compute-and-cost-choices.md for the full note. Tracked as a
# follow-up to re-enable once the two libraries' releases catch up to each
# other; least-privilege IAM and other AwsSolutions-style checks are
# currently enforced by hand and via the CDK assertion tests instead.

app.synth()
