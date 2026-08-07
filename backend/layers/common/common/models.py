"""Request-body schemas.

These are the single source of truth for input validation and sanitization
across every handler (satisfies the "proper input validation" requirement).
Field length limits exist not just for correctness but to keep a single bad
actor from writing arbitrarily large items into DynamoDB.
"""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, model_validator


class EventStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"


class RegistrationStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class EventCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    venue: str = Field(min_length=1, max_length=200)
    startDateTime: datetime
    endDateTime: datetime
    capacity: int = Field(gt=0, le=100_000)
    status: EventStatus = EventStatus.DRAFT

    @model_validator(mode="after")
    def check_dates(self) -> EventCreateRequest:
        if self.endDateTime <= self.startDateTime:
            raise ValueError("endDateTime must be after startDateTime")
        return self


class EventUpdateRequest(BaseModel):
    """All fields optional: a handler only updates attributes that were sent."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    venue: str | None = Field(default=None, min_length=1, max_length=200)
    startDateTime: datetime | None = None
    endDateTime: datetime | None = None
    capacity: int | None = Field(default=None, gt=0, le=100_000)
    status: EventStatus | None = None

    @model_validator(mode="after")
    def check_dates(self) -> EventUpdateRequest:
        if self.startDateTime and self.endDateTime and self.endDateTime <= self.startDateTime:
            raise ValueError("endDateTime must be after startDateTime")
        return self


class RegistrationCreateRequest(BaseModel):
    attendeeName: str = Field(min_length=1, max_length=200)
    attendeeEmail: EmailStr
