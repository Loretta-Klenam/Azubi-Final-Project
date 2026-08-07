"""Common Lambda entrypoint wrapper.

Every handler's `lambda_handler` is wrapped with `@api_handler`, which:
  1. Injects Powertools structured logging context + X-Ray tracing.
  2. Flushes EMF custom metrics on every invocation (including cold starts).
  3. Converts the handler's return value into a proper API Gateway proxy
     response.
  4. Catches `AppError` subclasses and converts them into the matching HTTP
     status code; catches anything else, logs the full traceback, and
     returns a generic 500 (never leaks internals to the caller).

Handlers stay small: they return either a plain dict (200 OK) or a
`(status_code, body)` tuple, and raise `common.errors.AppError` subclasses
for expected failures.
"""
from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any

from .errors import AppError
from .observability import logger, metrics, tracer
from .responses import build_response


def api_handler(func: Callable[[dict, Any], Any]) -> Callable[[dict, Any], dict]:
    @tracer.capture_lambda_handler
    @logger.inject_lambda_context(log_event=True)
    @metrics.log_metrics(capture_cold_start_metric=True)
    @wraps(func)
    def wrapper(event: dict, context: Any) -> dict:
        try:
            result = func(event, context)
            if isinstance(result, tuple) and len(result) == 2:
                status_code, body = result
            else:
                status_code, body = 200, result
            return build_response(status_code, body)
        except AppError as exc:
            logger.warning(
                "handled_application_error",
                error_code=exc.error_code,
                status_code=exc.status_code,
                error_message=str(exc),
            )
            return build_response(
                exc.status_code,
                {"errorCode": exc.error_code, "message": str(exc), "details": exc.details},
            )
        except Exception:  # noqa: BLE001 - deliberate catch-all boundary
            logger.exception("unhandled_error")
            return build_response(
                500,
                {"errorCode": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
            )

    return wrapper
