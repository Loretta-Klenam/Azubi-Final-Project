from aws_cdk.assertions import Match, Template


def test_admin_routes_require_cognito_authorization(stacks):
    template = Template.from_stack(stacks["api"])
    template.has_resource_properties(
        "AWS::ApiGateway::Method", {"AuthorizationType": "COGNITO_USER_POOLS"}
    )


def test_public_routes_have_no_authorization(stacks):
    template = Template.from_stack(stacks["api"])
    template.has_resource_properties(
        "AWS::ApiGateway::Method", {"HttpMethod": "GET", "AuthorizationType": "NONE"}
    )


def test_ten_lambda_functions(stacks):
    template = Template.from_stack(stacks["api"])
    template.resource_count_is("AWS::Lambda::Function", 10)


def test_two_shared_layers(stacks):
    template = Template.from_stack(stacks["api"])
    template.resource_count_is("AWS::Lambda::LayerVersion", 2)


def test_all_functions_use_arm64_python312(stacks):
    template = Template.from_stack(stacks["api"])
    template.all_resources_properties(
        "AWS::Lambda::Function",
        {"Runtime": "python3.12", "Architectures": ["arm64"]},
    )


def test_stream_mapping_reports_batch_item_failures_and_has_dlq(stacks):
    template = Template.from_stack(stacks["api"])
    template.has_resource_properties(
        "AWS::Lambda::EventSourceMapping",
        {
            "FunctionResponseTypes": ["ReportBatchItemFailures"],
            "DestinationConfig": {"OnFailure": {"Destination": Match.any_value()}},
        },
    )


def test_no_iam_wildcard_resources_outside_xray_and_streams(stacks):
    """Every IAM policy statement must target a specific resource, except
    the handful of AWS actions (X-Ray telemetry, DynamoDB stream discovery)
    that AWS itself does not support scoping to a specific ARN for."""
    template = Template.from_stack(stacks["api"])
    policies = template.find_resources("AWS::IAM::Policy")

    allowed_wildcard_actions = {
        "xray:puttelemetryrecords",
        "xray:puttracesegments",
        "dynamodb:liststreams",
    }

    offending = []
    for name, policy in policies.items():
        for statement in policy["Properties"]["PolicyDocument"]["Statement"]:
            resource = statement.get("Resource")
            is_wildcard = resource == "*" or (isinstance(resource, list) and "*" in resource)
            if not is_wildcard:
                continue
            actions = statement.get("Action")
            actions = [actions] if isinstance(actions, str) else (actions or [])
            unexpected = [a for a in actions if a.lower() not in allowed_wildcard_actions]
            if unexpected:
                offending.append((name, unexpected))

    assert not offending, f"Unexpected wildcard-resource IAM statements: {offending}"
