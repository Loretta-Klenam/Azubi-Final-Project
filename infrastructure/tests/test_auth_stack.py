from aws_cdk.assertions import Template


def test_self_signup_disabled(stacks):
    template = Template.from_stack(stacks["auth"])
    template.has_resource_properties(
        "AWS::Cognito::UserPool",
        {"AdminCreateUserConfig": {"AllowAdminCreateUserOnly": True}},
    )


def test_admins_group_exists(stacks):
    template = Template.from_stack(stacks["auth"])
    template.has_resource_properties("AWS::Cognito::UserPoolGroup", {"GroupName": "Admins"})


def test_spa_client_has_no_secret(stacks):
    template = Template.from_stack(stacks["auth"])
    template.has_resource_properties("AWS::Cognito::UserPoolClient", {"GenerateSecret": False})


def test_attendee_pool_allows_self_signup(stacks):
    template = Template.from_stack(stacks["auth"])
    template.has_resource_properties(
        "AWS::Cognito::UserPool",
        {"AdminCreateUserConfig": {"AllowAdminCreateUserOnly": False}},
    )


def test_exactly_two_user_pools(stacks):
    template = Template.from_stack(stacks["auth"])
    template.resource_count_is("AWS::Cognito::UserPool", 2)
