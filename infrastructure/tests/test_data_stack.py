from aws_cdk.assertions import Template


def test_events_table_schema(stacks):
    template = Template.from_stack(stacks["data"])
    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {
            "KeySchema": [{"AttributeName": "eventId", "KeyType": "HASH"}],
            "BillingMode": "PAY_PER_REQUEST",
        },
    )


def test_registrations_table_has_stream_and_pk(stacks):
    template = Template.from_stack(stacks["data"])
    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {
            "KeySchema": [{"AttributeName": "PK", "KeyType": "HASH"}],
            "StreamSpecification": {"StreamViewType": "NEW_IMAGE"},
        },
    )


def test_exactly_two_tables(stacks):
    template = Template.from_stack(stacks["data"])
    template.resource_count_is("AWS::DynamoDB::Table", 2)


def test_tables_are_retained_not_destroyed(stacks):
    # Real registrant data: an accidental `cdk destroy` must not delete it.
    template = Template.from_stack(stacks["data"])
    template.has_resource("AWS::DynamoDB::Table", {"DeletionPolicy": "Retain"})


def test_registrations_table_gsis(stacks):
    template = Template.from_stack(stacks["data"])
    template.has_resource_properties(
        "AWS::DynamoDB::Table",
        {
            "KeySchema": [{"AttributeName": "PK", "KeyType": "HASH"}],
            "GlobalSecondaryIndexes": [
                {
                    "IndexName": "EventIndex",
                    "KeySchema": [
                        {"AttributeName": "eventId", "KeyType": "HASH"},
                        {"AttributeName": "registeredAt", "KeyType": "RANGE"},
                    ],
                },
                {
                    "IndexName": "EmailIndex",
                    "KeySchema": [
                        {"AttributeName": "attendeeEmail", "KeyType": "HASH"},
                        {"AttributeName": "registeredAt", "KeyType": "RANGE"},
                    ],
                },
            ],
        },
    )
