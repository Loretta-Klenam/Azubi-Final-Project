"""Cognito User Pools for admin and attendee authentication.

Admin pool: chosen over a shared API key (see docs/adr/0002-cognito-admin-auth.md)
because it gives named accounts, revocable per-user, with a real login flow
-- appropriate for a tool that manages event data, even at small scale.

Self-sign-up is intentionally disabled on the admin pool: administrators are
provisioned only via `scripts/bootstrap-admin.sh` (documented in
docs/deployment.md). There is no public "become an admin" path.

Attendee pool: a second, entirely separate User Pool for regular users who
want to sign up, log in, and have their registrations linked to an account
("My tickets"). It is deliberately its own pool -- not just a group in the
admin pool -- so that self-service sign-up can never grant admin access:
an attendee account has no way to end up in the `Admins` group because it
isn't even in the same user pool.
"""
from __future__ import annotations

from aws_cdk import CfnOutput, RemovalPolicy, Stack
from aws_cdk import aws_cognito as cognito
from constructs import Construct

ADMIN_GROUP_NAME = "Admins"


class AuthStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.user_pool = cognito.UserPool(
            self,
            "AdminUserPool",
            user_pool_name="event-ticketing-admins",
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(email=True, username=False),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=False),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=12,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # Public SPA client: no client secret (a browser can't keep one),
        # SRP auth only (password never leaves the browser in plaintext).
        self.user_pool_client = self.user_pool.add_client(
            "AdminSpaClient",
            auth_flows=cognito.AuthFlow(user_srp=True),
            generate_secret=False,
            access_token_validity=None,
            prevent_user_existence_errors=True,
        )

        cognito.CfnUserPoolGroup(
            self,
            "AdminsGroup",
            user_pool_id=self.user_pool.user_pool_id,
            group_name=ADMIN_GROUP_NAME,
            description="Members can create/edit events and manage registrations.",
        )

        # --- Attendee pool: self-service sign-up, no group/admin concept ---
        self.attendee_user_pool = cognito.UserPool(
            self,
            "AttendeeUserPool",
            user_pool_name="event-ticketing-attendees",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True, username=False),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=False),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=12,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=RemovalPolicy.RETAIN,
        )

        self.attendee_user_pool_client = self.attendee_user_pool.add_client(
            "AttendeeSpaClient",
            auth_flows=cognito.AuthFlow(user_srp=True),
            generate_secret=False,
            access_token_validity=None,
            prevent_user_existence_errors=True,
        )

        # Consumed by the frontend build step in .github/workflows/deploy.yml
        # to populate VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID, and
        # by scripts/bootstrap-admin.sh to create the first admin user.
        CfnOutput(self, "UserPoolId", value=self.user_pool.user_pool_id)
        CfnOutput(self, "UserPoolClientId", value=self.user_pool_client.user_pool_client_id)
        CfnOutput(self, "AttendeeUserPoolId", value=self.attendee_user_pool.user_pool_id)
        CfnOutput(
            self, "AttendeeUserPoolClientId", value=self.attendee_user_pool_client.user_pool_client_id
        )
