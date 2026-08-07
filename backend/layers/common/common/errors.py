"""Application-level exceptions.

Handlers raise these for expected failure cases (bad input, missing
resource, business-rule conflict) and let the `api_handler` middleware
(see middleware.py) translate them into the right HTTP status code.
Anything that is *not* one of these is treated as a bug and returns 500.
"""
from __future__ import annotations

from typing import Any


class AppError(Exception):
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str,
        *,
        error_code: str | None = None,
        status_code: int | None = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        if error_code is not None:
            self.error_code = error_code
        if status_code is not None:
            self.status_code = status_code
        self.details = details


class ValidationAppError(AppError):
    status_code = 400
    error_code = "VALIDATION_ERROR"


class NotFoundError(AppError):
    status_code = 404
    error_code = "NOT_FOUND"


class ConflictError(AppError):
    """A business-rule conflict, e.g. duplicate registration or sold-out event.

    Callers should pass a specific `error_code` (DUPLICATE_REGISTRATION,
    EVENT_SOLD_OUT, EVENT_NOT_PUBLISHED, ALREADY_CANCELLED) so the frontend
    and the RegistrationFailed metric can distinguish failure reasons.
    """

    status_code = 409
    error_code = "CONFLICT"


class ForbiddenError(AppError):
    status_code = 403
    error_code = "FORBIDDEN"
