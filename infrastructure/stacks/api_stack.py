"""REST API Gateway, all ten Lambda functions, and the Cognito authorizer.

This stack has the most moving parts, by design: it is where least-privilege
IAM actually gets enforced (every `.grant(...)` below is a specific action on
a specific resource, not a wildcard), where the two Lambda Layers get
attached, and where the DynamoDB Stream is wired to the async notification
function with retry/DLQ settings so a failing SES call can't stall it.

Lambda packaging strategy (see docs/adr/0005-compute-and-cost-choices.md):
  - `common` layer: aws-lambda-powertools + pydantic + our own shared
    `common/` package. Attached to every function.
  - `ticketing` layer: qrcode + Pillow. Attached ONLY to register_for_event,
    the one function that actually generates a QR image -- keeping every
    other function's cold start free of an imaging library it never uses.
  - Function code itself ships as a plain zip asset (no per-function Docker
    bundling): all its dependencies come from the layers, so there's nothing
    to `pip install` into the function's own package.
"""
from __future__ import annotations

from pathlib import Path

from aws_cdk import CfnOutput, Duration, Stack
from aws_cdk import aws_apigateway as apigateway
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_lambda_event_sources as lambda_event_sources
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_sns as sns
from aws_cdk import aws_sqs as sqs
from aws_cdk.aws_lambda_python_alpha import PythonLayerVersion
from aws_cdk.aws_ses import EmailIdentity
from constructs import Construct

from config import AppConfig

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
FUNCTIONS_ROOT = BACKEND_ROOT / "functions"
LAYERS_ROOT = BACKEND_ROOT / "layers"

TICKET_PREFIX = "tickets/*"


class ApiStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        config: AppConfig,
        events_table: dynamodb.Table,
        registrations_table: dynamodb.Table,
        user_pool: cognito.UserPool,
        attendee_user_pool: cognito.UserPool,
        tickets_bucket: s3.Bucket,
        ops_topic: sns.Topic,
        sender_identity: EmailIdentity,
        frontend_domain_name: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.events_table = events_table
        self.registrations_table = registrations_table
        self.tickets_bucket = tickets_bucket
        frontend_base_url = f"https://{frontend_domain_name}"

        common_env = {
            "EVENTS_TABLE_NAME": events_table.table_name,
            "REGISTRATIONS_TABLE_NAME": registrations_table.table_name,
            "ALLOWED_ORIGIN": frontend_base_url,
            "POWERTOOLS_SERVICE_NAME": "event-ticketing",
            "POWERTOOLS_METRICS_NAMESPACE": "EventTicketing",
            "POWERTOOLS_LOG_LEVEL": "INFO",
        }

        self.common_layer = PythonLayerVersion(
            self,
            "CommonLayer",
            entry=str(LAYERS_ROOT / "common"),
            compatible_runtimes=[lambda_.Runtime.PYTHON_3_12],
            compatible_architectures=[lambda_.Architecture.ARM_64],
            description="aws-lambda-powertools, pydantic, and shared application code.",
        )
        self.ticketing_layer = PythonLayerVersion(
            self,
            "TicketingLayer",
            entry=str(LAYERS_ROOT / "ticketing"),
            compatible_runtimes=[lambda_.Runtime.PYTHON_3_12],
            compatible_architectures=[lambda_.Architecture.ARM_64],
            description="qrcode + Pillow, used only by register_for_event.",
        )

        # --- Lambda functions --------------------------------------------
        self.create_event_fn = self._function("CreateEventFunction", "create_event")
        self.update_event_fn = self._function("UpdateEventFunction", "update_event")
        self.delete_event_fn = self._function("DeleteEventFunction", "delete_event")
        self.list_events_fn = self._function("ListEventsFunction", "list_events")
        self.get_event_fn = self._function("GetEventFunction", "get_event")
        self.list_registrations_fn = self._function(
            "ListRegistrationsFunction", "list_registrations_for_event"
        )
        self.get_registration_fn = self._function(
            "GetRegistrationFunction",
            "get_registration",
            extra_env={"TICKETS_BUCKET_NAME": tickets_bucket.bucket_name},
        )
        self.cancel_registration_fn = self._function("CancelRegistrationFunction", "cancel_registration")
        self.register_for_event_fn = self._function(
            "RegisterForEventFunction",
            "register_for_event",
            extra_layers=[self.ticketing_layer],
            timeout=Duration.seconds(20),
            extra_env={
                "TICKETS_BUCKET_NAME": tickets_bucket.bucket_name,
                "FRONTEND_BASE_URL": frontend_base_url,
            },
        )
        self.list_registrations_for_user_fn = self._function(
            "ListRegistrationsForUserFunction", "list_registrations_for_user"
        )

        notify_dlq = sqs.Queue(
            self,
            "NotifyOnRegistrationDlq",
            retention_period=Duration.days(14),
        )
        self.notify_on_registration_fn = self._function(
            "NotifyOnRegistrationFunction",
            "notify_on_registration",
            timeout=Duration.seconds(30),
            extra_env={
                "TICKETS_BUCKET_NAME": tickets_bucket.bucket_name,
                "SES_SENDER_EMAIL": config.ses_sender_email,
                "SNS_OPS_TOPIC_ARN": ops_topic.topic_arn,
                "FRONTEND_BASE_URL": frontend_base_url,
            },
        )

        self.all_functions = [
            self.create_event_fn,
            self.update_event_fn,
            self.delete_event_fn,
            self.list_events_fn,
            self.get_event_fn,
            self.list_registrations_fn,
            self.get_registration_fn,
            self.cancel_registration_fn,
            self.register_for_event_fn,
            self.list_registrations_for_user_fn,
            self.notify_on_registration_fn,
        ]
        for fn in self.all_functions:
            fn.add_environment("EVENTS_TABLE_NAME", common_env["EVENTS_TABLE_NAME"])

        # --- Least-privilege IAM grants -----------------------------------
        # Each function gets exactly the actions it performs -- see the
        # handler source for what each one actually does.
        events_table.grant(self.create_event_fn, "dynamodb:PutItem")
        events_table.grant(self.update_event_fn, "dynamodb:UpdateItem")
        events_table.grant(self.delete_event_fn, "dynamodb:GetItem", "dynamodb:DeleteItem")
        events_table.grant(self.list_events_fn, "dynamodb:Query", "dynamodb:Scan")
        events_table.grant(self.get_event_fn, "dynamodb:GetItem")
        events_table.grant(self.get_registration_fn, "dynamodb:GetItem")
        events_table.grant(self.notify_on_registration_fn, "dynamodb:GetItem")
        # register_for_event reads the event (capacity/status check) and
        # updates registeredCount as part of its TransactWriteItems call.
        events_table.grant(self.register_for_event_fn, "dynamodb:GetItem", "dynamodb:UpdateItem")
        # cancel_registration's transaction decrements registeredCount.
        events_table.grant(self.cancel_registration_fn, "dynamodb:UpdateItem")

        registrations_table.grant(self.get_registration_fn, "dynamodb:GetItem")
        registrations_table.grant(self.list_registrations_fn, "dynamodb:Query")
        registrations_table.grant(self.list_registrations_for_user_fn, "dynamodb:Query")
        # register_for_event's transaction Puts both the lock item and the
        # registration item.
        registrations_table.grant(self.register_for_event_fn, "dynamodb:PutItem")
        # cancel_registration's transaction updates the registration and
        # deletes its lock item.
        registrations_table.grant(
            self.cancel_registration_fn, "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"
        )

        tickets_bucket.grant_put(self.register_for_event_fn, TICKET_PREFIX)
        # The presigned GET URL register_for_event hands back to the caller
        # is signed with its own role, so it needs GetObject too.
        tickets_bucket.grant_read(self.register_for_event_fn, TICKET_PREFIX)
        tickets_bucket.grant_read(self.get_registration_fn, TICKET_PREFIX)
        tickets_bucket.grant_read(self.notify_on_registration_fn, TICKET_PREFIX)

        sender_identity.grant_send_email(self.notify_on_registration_fn)
        ops_topic.grant_publish(self.notify_on_registration_fn)

        # DynamoDB Stream -> notify_on_registration, filtered to real
        # registration inserts only (lock-item inserts and CANCELLED
        # updates are ignored at the source so the function is never even
        # invoked for them). Bounded retries + a DLQ mean a persistent SES
        # failure (e.g. sandbox-mode rejection) can't stall the stream.
        self.notify_on_registration_fn.add_event_source(
            lambda_event_sources.DynamoEventSource(
                registrations_table,
                starting_position=lambda_.StartingPosition.LATEST,
                batch_size=10,
                retry_attempts=3,
                bisect_batch_on_error=True,
                report_batch_item_failures=True,
                on_failure=lambda_event_sources.SqsDlq(notify_dlq),
                filters=[
                    lambda_.FilterCriteria.filter(
                        {
                            "eventName": lambda_.FilterRule.is_equal("INSERT"),
                            "dynamodb": {"NewImage": {"type": {"S": lambda_.FilterRule.is_equal("REGISTRATION")}}},
                        }
                    )
                ],
            )
        )

        # --- API Gateway ---------------------------------------------------
        self.api = apigateway.RestApi(
            self,
            "EventTicketingApi",
            rest_api_name="event-ticketing-api",
            description="Public + admin REST API for the event registration and ticketing system.",
            deploy_options=apigateway.StageOptions(
                stage_name="v1",
                metrics_enabled=True,
                logging_level=apigateway.MethodLoggingLevel.INFO,
                throttling_rate_limit=50,
                throttling_burst_limit=100,
            ),
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=[frontend_base_url, "http://localhost:5173"],
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        authorizer = apigateway.CognitoUserPoolsAuthorizer(
            self,
            "AdminAuthorizer",
            cognito_user_pools=[user_pool],
        )
        admin_auth = {
            "authorization_type": apigateway.AuthorizationType.COGNITO,
            "authorizer": authorizer,
        }

        # Separate authorizer bound to the attendee pool -- entirely
        # independent of admin_auth above, so a valid attendee JWT can never
        # satisfy an admin-authorized route and vice versa.
        attendee_authorizer = apigateway.CognitoUserPoolsAuthorizer(
            self,
            "AttendeeAuthorizer",
            cognito_user_pools=[attendee_user_pool],
        )
        attendee_auth = {
            "authorization_type": apigateway.AuthorizationType.COGNITO,
            "authorizer": attendee_authorizer,
        }

        events = self.api.root.add_resource("events")
        events.add_method("GET", apigateway.LambdaIntegration(self.list_events_fn))
        event_item = events.add_resource("{eventId}")
        event_item.add_method("GET", apigateway.LambdaIntegration(self.get_event_fn))
        registrations = event_item.add_resource("registrations")
        registrations.add_method("POST", apigateway.LambdaIntegration(self.register_for_event_fn))

        registrations_root = self.api.root.add_resource("registrations")
        registration_item = registrations_root.add_resource("{registrationId}")
        registration_item.add_method("GET", apigateway.LambdaIntegration(self.get_registration_fn))
        registration_item.add_method("DELETE", apigateway.LambdaIntegration(self.cancel_registration_fn))

        # Authenticated attendee routes. POST /me/events/{eventId}/registrations
        # reuses register_for_event_fn -- same handler, same business rules --
        # the only difference is the attendee authorizer lets the handler read
        # a `sub` claim (via common.auth.get_cognito_sub) and stamp the new
        # registration with a userId so it shows up in GET /me/registrations.
        me = self.api.root.add_resource("me")
        me_events = me.add_resource("events")
        me_event_item = me_events.add_resource("{eventId}")
        me_registrations = me_event_item.add_resource("registrations")
        me_registrations.add_method(
            "POST", apigateway.LambdaIntegration(self.register_for_event_fn), **attendee_auth
        )
        me_registrations_root = me.add_resource("registrations")
        me_registrations_root.add_method(
            "GET",
            apigateway.LambdaIntegration(self.list_registrations_for_user_fn),
            **attendee_auth,
        )

        admin = self.api.root.add_resource("admin")
        admin_events = admin.add_resource("events")
        admin_events.add_method(
            "GET", apigateway.LambdaIntegration(self.list_events_fn), **admin_auth
        )
        admin_events.add_method(
            "POST", apigateway.LambdaIntegration(self.create_event_fn), **admin_auth
        )
        admin_event_item = admin_events.add_resource("{eventId}")
        admin_event_item.add_method(
            "GET", apigateway.LambdaIntegration(self.get_event_fn), **admin_auth
        )
        admin_event_item.add_method(
            "PUT", apigateway.LambdaIntegration(self.update_event_fn), **admin_auth
        )
        admin_event_item.add_method(
            "DELETE", apigateway.LambdaIntegration(self.delete_event_fn), **admin_auth
        )
        admin_registrations = admin_event_item.add_resource("registrations")
        admin_registrations.add_method(
            "GET",
            apigateway.LambdaIntegration(self.list_registrations_fn),
            **admin_auth,
        )

        admin_registrations_root = admin.add_resource("registrations")
        admin_registration_item = admin_registrations_root.add_resource("{registrationId}")
        admin_registration_item.add_method(
            "DELETE",
            apigateway.LambdaIntegration(self.cancel_registration_fn),
            **admin_auth,
        )

        # Consumed by .github/workflows/deploy.yml to populate the
        # frontend's VITE_API_BASE_URL at build time.
        CfnOutput(self, "ApiEndpoint", value=self.api.url)

    def _function(
        self,
        construct_id: str,
        function_dir_name: str,
        *,
        extra_layers: list | None = None,
        extra_env: dict | None = None,
        timeout: Duration | None = None,
        memory_size: int = 256,
    ) -> lambda_.Function:
        environment = {
            "POWERTOOLS_SERVICE_NAME": "event-ticketing",
            "POWERTOOLS_METRICS_NAMESPACE": "EventTicketing",
        }
        if extra_env:
            environment.update(extra_env)

        log_group = logs.LogGroup(
            self,
            f"{construct_id}LogGroup",
            retention=logs.RetentionDays.TWO_WEEKS,
        )

        return lambda_.Function(
            self,
            construct_id,
            runtime=lambda_.Runtime.PYTHON_3_12,
            architecture=lambda_.Architecture.ARM_64,
            handler="handler.lambda_handler",
            code=lambda_.Code.from_asset(str(FUNCTIONS_ROOT / function_dir_name)),
            layers=[self.common_layer, *(extra_layers or [])],
            environment=environment,
            timeout=timeout or Duration.seconds(10),
            memory_size=memory_size,
            tracing=lambda_.Tracing.ACTIVE,
            log_group=log_group,
        )
