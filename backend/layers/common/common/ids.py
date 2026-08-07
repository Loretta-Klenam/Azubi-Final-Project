"""ID and human-facing code generation."""
import secrets
import uuid

# Excludes visually ambiguous characters (0/O, 1/I/L) so a confirmation code
# read off a phone screen at check-in can be typed back in without errors.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_id() -> str:
    return str(uuid.uuid4())


def generate_confirmation_code(length: int = 8) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))
