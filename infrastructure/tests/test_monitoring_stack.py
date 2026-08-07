from aws_cdk.assertions import Template


def test_api_error_rate_alarm_exists(stacks):
    template = Template.from_stack(stacks["monitoring"])
    template.has_resource_properties(
        "AWS::CloudWatch::Alarm",
        {
            "Threshold": 5,
            "DatapointsToAlarm": 2,
            "EvaluationPeriods": 3,
            "TreatMissingData": "notBreaching",
        },
    )


def test_budget_uses_configured_limit(stacks):
    template = Template.from_stack(stacks["monitoring"])
    template.has_resource_properties(
        "AWS::Budgets::Budget",
        {
            "Budget": {
                "BudgetType": "COST",
                "TimeUnit": "MONTHLY",
                "BudgetLimit": {"Amount": 5, "Unit": "USD"},
            }
        },
    )


def test_dashboard_created(stacks):
    template = Template.from_stack(stacks["monitoring"])
    template.resource_count_is("AWS::CloudWatch::Dashboard", 1)
