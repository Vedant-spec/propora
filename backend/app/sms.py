"""Outbound SMS.

Kept deliberately small and provider-agnostic: Twilio is supported out of the
box because it is the most common, and any other gateway can be wired through
SMS_WEBHOOK_URL without touching this file.

Like email, sending happens on a background thread — a slow or unreachable
gateway must never hold up an HTTP response, and a delivery failure must never
turn a successful sign-in request into a 500.
"""
import base64
import json
import logging
import threading
import urllib.error
import urllib.parse
import urllib.request

from flask import current_app

logger = logging.getLogger(__name__)

TIMEOUT = 15


def provider(config=None) -> str:
    """Which gateway is configured: 'twilio', 'webhook' or 'none'."""
    config = config or current_app.config
    if config.get("TWILIO_ACCOUNT_SID") and config.get("TWILIO_AUTH_TOKEN"):
        return "twilio"
    if config.get("SMS_WEBHOOK_URL"):
        return "webhook"
    return "none"


def is_configured(config=None) -> bool:
    return provider(config) != "none"


def _post(url, data, headers):
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.status


def _send_twilio(config, to, body):
    sid = config["TWILIO_ACCOUNT_SID"]
    token = config["TWILIO_AUTH_TOKEN"]
    payload = urllib.parse.urlencode(
        {"To": to, "From": config.get("TWILIO_FROM_NUMBER", ""), "Body": body}
    ).encode()
    credentials = base64.b64encode(f"{sid}:{token}".encode()).decode()
    return _post(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
        payload,
        {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )


def _send_webhook(config, to, body):
    payload = json.dumps({"to": to, "message": body}).encode()
    headers = {"Content-Type": "application/json"}
    if config.get("SMS_WEBHOOK_TOKEN"):
        headers["Authorization"] = f"Bearer {config['SMS_WEBHOOK_TOKEN']}"
    return _post(config["SMS_WEBHOOK_URL"], payload, headers)


def _deliver(config, to, body):
    try:
        status = (
            _send_twilio(config, to, body)
            if provider(config) == "twilio"
            else _send_webhook(config, to, body)
        )
        logger.info("SMS sent to %s (status %s)", to, status)
    except urllib.error.HTTPError as exc:  # pragma: no cover - depends on gateway
        logger.error("SMS to %s rejected by gateway: %s %s", to, exc.code, exc.reason)
    except Exception:  # pragma: no cover - depends on gateway
        logger.exception("Could not send SMS to %s", to)


def send_sms(to: str, body: str) -> bool:
    """Queue an SMS. Returns True if it was handed to a gateway."""
    config = {key: current_app.config.get(key) for key in current_app.config}

    if not is_configured(config):
        # No gateway wired up. Log it so the flow stays testable locally, but
        # never return the contents to the caller.
        logger.warning("No SMS gateway configured — message to %s not sent:\n%s", to, body)
        return False

    threading.Thread(target=_deliver, args=(config, to, body), daemon=True).start()
    return True


def send_otp(phone: str, code: str, minutes: int) -> bool:
    return send_sms(
        phone,
        f"{code} is your PROPORA verification code. "
        f"It expires in {minutes} minutes. Do not share it with anyone.",
    )
