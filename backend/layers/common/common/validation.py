"""Request-body parsing shared by every handler that accepts a body."""
from __future__ import annotations

import base64
import json
from typing import TypeVar

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError

from .errors import ValidationAppError

ModelT = TypeVar("ModelT", bound=BaseModel)


def parse_json_body(event: dict, model_cls: type[ModelT]) -> ModelT:
    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    try:
        data = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise ValidationAppError("Request body must be valid JSON.") from exc

    try:
        return model_cls.model_validate(data)
    except PydanticValidationError as exc:
        details = [
            {"field": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
            for error in exc.errors()
        ]
        raise ValidationAppError("Request validation failed.", details=details) from exc
