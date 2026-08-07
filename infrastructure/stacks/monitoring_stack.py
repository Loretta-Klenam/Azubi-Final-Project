"""CloudWatch alarms/dashboard and AWS Budgets cost tracking.

Deliberately NOT alarmed on: DynamoDB "conditional check failed" requests.
Those are triggered by completely normal business outcomes in this system
(someone tries to register twice, an event sells out) -- alarming on them
would page someone every time an event is popular, which is the opposite of
useful. What's alarmed instead is the explicit `RegistrationFailed` EMF
metric the handlers emit, which carries a `reason` dimension.
"""
from __future__ import annotations

from aws_cdk import Duration, Stack
from aws_cdk import aws_apigateway as apigateway
from aws_cdk import aws_budgets as budgets
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as cloudwatch_actions
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_sns as sns

from config import AppConfig
from constructs import Construct

API_ERROR_RATE_THRESHOLD_PERCENT = 5


class MonitoringStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        config: AppConfig,
        api: apigateway.RestApi,
        lambda_functions: list[lambda_.Function],
        events_table: dynamodb.Table,
        registrations_table: dynamodb.Table,
        alert_topic: sns.Topic,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        alarm_action = cloudwatch_actions.SnsAction(alert_topic)
        widgets: list[cloudwatch.IWidget] = []

        # --- API Gateway: request count + 5xx error rate -------------------
        request_count = api.metric_count(period=Duration.minutes(5), statistic="Sum")
        server_errors = api.metric_server_error(period=Duration.minutes(5), statistic="Sum")
        client_errors = api.metric_client_error(period=Duration.minutes(5), statistic="Sum")

        error_rate = cloudwatch.MathExpression(
            expression="IF(requests > 0, (errors / requests) * 100, 0)",
            using_metrics={"errors": server_errors, "requests": request_count},
            period=Duration.minutes(5),
            label="5xx error rate (%)",
        )
        error_rate_alarm = cloudwatch.Alarm(
            self,
            "ApiErrorRateAlarm",
            metric=error_rate,
            threshold=API_ERROR_RATE_THRESHOLD_PERCENT,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluation_periods=3,
            datapoints_to_alarm=2,
            # A single failed request against near-zero traffic would
            # otherwise register as a "100% error rate" -- requiring 2 of 3
            # breaching 5-minute periods, and treating "no data" as healthy
            # rather than breaching, keeps this alarm meaningful at low
            # volume instead of flapping on every cold start hiccup.
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description="API 5xx error rate exceeded 5% across 2 of the last 3 five-minute periods.",
        )
        error_rate_alarm.add_alarm_action(alarm_action)

        widgets.append(
            cloudwatch.GraphWidget(
                title="API request volume",
                left=[request_count, client_errors, server_errors],
                width=24,
            )
        )
        widgets.append(cloudwatch.GraphWidget(title="API 5xx error rate (%)", left=[error_rate], width=24))

        # --- Per-function Lambda alarms -------------------------------------
        duration_widgets = []
        invocation_widgets = []
        for fn in lambda_functions:
            name = fn.node.id

            errors_metric = fn.metric_errors(period=Duration.minutes(5), statistic="Sum")
            errors_alarm = errors_metric.create_alarm(
                self,
                f"{name}ErrorsAlarm",
                threshold=1,
                comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                evaluation_periods=2,
                datapoints_to_alarm=1,
                treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
                alarm_description=f"{name} raised at least one unhandled error.",
            )
            errors_alarm.add_alarm_action(alarm_action)

            timeout_ms = fn.timeout.to_milliseconds() if fn.timeout else 10_000
            duration_metric = fn.metric_duration(period=Duration.minutes(5), statistic="p99")
            duration_alarm = duration_metric.create_alarm(
                self,
                f"{name}DurationAlarm",
                threshold=timeout_ms * 0.8,
                comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                evaluation_periods=3,
                datapoints_to_alarm=2,
                treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
                alarm_description=f"{name} p99 duration is approaching its configured timeout.",
            )
            duration_alarm.add_alarm_action(alarm_action)

            invocation_widgets.append(fn.metric_invocations(period=Duration.minutes(5), statistic="Sum"))
            duration_widgets.append(duration_metric)

        widgets.append(
            cloudwatch.GraphWidget(title="Lambda invocations by function", left=invocation_widgets, width=24)
        )
        widgets.append(
            cloudwatch.GraphWidget(title="Lambda p99 duration by function (ms)", left=duration_widgets, width=24)
        )

        # --- DynamoDB throttling ---------------------------------------------
        table_operations = [
            dynamodb.Operation.GET_ITEM,
            dynamodb.Operation.PUT_ITEM,
            dynamodb.Operation.UPDATE_ITEM,
            dynamodb.Operation.DELETE_ITEM,
            dynamodb.Operation.QUERY,
            dynamodb.Operation.SCAN,
            dynamodb.Operation.TRANSACT_WRITE_ITEMS,
        ]
        for label, table in (("Events", events_table), ("Registrations", registrations_table)):
            throttle_metric = table.metric_throttled_requests_for_operations(
                operations=table_operations, period=Duration.minutes(5), statistic="Sum"
            )
            throttle_alarm = throttle_metric.create_alarm(
                self,
                f"{label}TableThrottleAlarm",
                threshold=0,
                comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                evaluation_periods=1,
                treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
                alarm_description=f"The {label} table is being throttled.",
            )
            throttle_alarm.add_alarm_action(alarm_action)

        # --- Application-level registration outcome metrics -------------------
        registration_succeeded = cloudwatch.Metric(
            namespace="EventTicketing",
            metric_name="RegistrationSucceeded",
            statistic="Sum",
            period=Duration.minutes(5),
        )
        registration_failed = cloudwatch.Metric(
            namespace="EventTicketing",
            metric_name="RegistrationFailed",
            statistic="Sum",
            period=Duration.minutes(5),
        )
        registration_failed_alarm = registration_failed.create_alarm(
            self,
            "RegistrationFailedSpikeAlarm",
            threshold=5,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluation_periods=2,
            datapoints_to_alarm=2,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description="More than 5 registration attempts failed in a 5-minute period.",
        )
        registration_failed_alarm.add_alarm_action(alarm_action)

        widgets.append(
            cloudwatch.GraphWidget(
                title="Registrations: succeeded vs failed",
                left=[registration_succeeded],
                right=[registration_failed],
                width=24,
            )
        )

        cloudwatch.Dashboard(
            self,
            "OperationsDashboard",
            dashboard_name="event-ticketing-operations",
            widgets=[[w] for w in widgets],
        )

        # --- AWS Budgets: stay inside the Free Tier ---------------------------
        # This is a cost-threshold budget (email at 80% actual / 100%
        # forecasted). It does NOT replace the AWS "Free Tier usage alerts"
        # account preference, which isn't a CloudFormation resource and must
        # be enabled once, manually, in Billing Preferences -- see
        # docs/cost-and-free-tier.md.
        budgets.CfnBudget(
            self,
            "MonthlyCostBudget",
            budget=budgets.CfnBudget.BudgetDataProperty(
                budget_type="COST",
                time_unit="MONTHLY",
                budget_limit=budgets.CfnBudget.SpendProperty(
                    amount=float(config.budget_limit_usd), unit="USD"
                ),
            ),
            notifications_with_subscribers=[
                budgets.CfnBudget.NotificationWithSubscribersProperty(
                    notification=budgets.CfnBudget.NotificationProperty(
                        notification_type="ACTUAL",
                        comparison_operator="GREATER_THAN",
                        threshold=80,
                        threshold_type="PERCENTAGE",
                    ),
                    subscribers=[
                        budgets.CfnBudget.SubscriberProperty(
                            subscription_type="EMAIL", address=config.admin_alert_email
                        )
                    ],
                ),
                budgets.CfnBudget.NotificationWithSubscribersProperty(
                    notification=budgets.CfnBudget.NotificationProperty(
                        notification_type="FORECASTED",
                        comparison_operator="GREATER_THAN",
                        threshold=100,
                        threshold_type="PERCENTAGE",
                    ),
                    subscribers=[
                        budgets.CfnBudget.SubscriberProperty(
                            subscription_type="EMAIL", address=config.admin_alert_email
                        )
                    ],
                ),
            ],
        )
