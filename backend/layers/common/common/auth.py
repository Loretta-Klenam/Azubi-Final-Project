"""Cognito claim helpers for admin-authorized handlers.

API Gateway's CognitoUserPoolsAuthorizer only proves the caller has a valid
JWT from *our* user pool -- it does not by itself enforce group membership.
`require_admin_group` is the actual authorization check (defense in depth:
even if the `/admin` resource policy were ever misconfigured, handlers still
refuse non-admins).
"""
from __future__ import annotations

from typing import Optional

from .errors import ForbiddenError

ADMIN_GROUP = "Admins"


def get_claims(event: dict) -> dict:
    return event.get("requestContext", {}).get("authorizer", {}).get("claims", {}) or {}


def get_cognito_sub(event: dict) -> Optional[str]:
    return get_claims(event).get("sub")


def require_admin_group(event: dict) -> dict:
    claims = get_claims(event)
    groups_claim = claims.get("cognito:groups", "")
    groups = groups_claim.split(",") if isinstance(groups_claim, str) else groups_claim
    if ADMIN_GROUP not in groups:
        raise ForbiddenError("This action requires an administrator account.")
    return claims


def is_admin_request(event: dict) -> bool:
    """True if the request carries a Cognito-authorized admin identity.

    Used by the dual-path `cancel_registration` handler to decide whether to
    trust the caller's Cognito identity (admin path) or require a matching
    confirmation code (public self-service path).
    """
    claims = get_claims(event)
    if not claims:
        return False
    groups_claim = claims.get("cognito:groups", "")
    groups = groups_claim.split(",") if isinstance(groups_claim, str) else groups_claim
    return ADMIN_GROUP in groups
