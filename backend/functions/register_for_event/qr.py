"""QR code generation, local to this function (needs the `ticketing` layer:
qrcode + Pillow -- kept out of the shared `common` layer so every other,
lighter-weight function isn't forced to load an imaging library on cold start).
"""
from __future__ import annotations

import io

import qrcode


def generate_qr_png(data: str) -> bytes:
    image = qrcode.make(data)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
