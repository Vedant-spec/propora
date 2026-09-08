"""Outbound email.

Uses the standard library so there is no extra dependency. Messages are sent on
a background thread: a slow or unreachable SMTP host must never hold up an HTTP
response, and a delivery failure must never turn a successful password reset
into a 500.
"""
import html
import logging
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formataddr

from flask import current_app

logger = logging.getLogger(__name__)


def is_configured(config=None) -> bool:
    config = config or current_app.config
    return bool(config.get("MAIL_SERVER"))


def _build(config, to_address, subject, text_body, html_body=None):
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((config["MAIL_FROM_NAME"], config["MAIL_FROM"]))
    message["To"] = to_address
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
    return message


def _deliver(config, message, to_address):
    host = config["MAIL_SERVER"]
    port = int(config["MAIL_PORT"])
    username = config.get("MAIL_USERNAME")
    password = config.get("MAIL_PASSWORD")
    timeout = int(config.get("MAIL_TIMEOUT", 20))

    try:
        if config.get("MAIL_USE_SSL"):
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host, port, timeout=timeout, context=context)
        else:
            server = smtplib.SMTP(host, port, timeout=timeout)

        with server:
            server.ehlo()
            if config.get("MAIL_USE_TLS") and not config.get("MAIL_USE_SSL"):
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            if username:
                server.login(username, password or "")
            server.send_message(message)

        logger.info("Email sent to %s: %s", to_address, message["Subject"])
    except Exception:  # pragma: no cover - depends on the mail host
        logger.exception("Could not send email to %s", to_address)


def send_email(to_address, subject, text_body, html_body=None):
    """Queue an email. Returns True if it was handed to a mail server."""
    config = {key: current_app.config.get(key) for key in current_app.config}

    if not is_configured(config):
        # No SMTP host set (local development). Log it so the flow is still
        # testable, but never return the contents to the caller.
        logger.warning(
            "MAIL_SERVER is not configured — email to %s was not sent.\n"
            "Subject: %s\n%s",
            to_address,
            subject,
            text_body,
        )
        return False

    message = _build(config, to_address, subject, text_body, html_body)
    threading.Thread(
        target=_deliver, args=(config, message, to_address), daemon=True
    ).start()
    return True


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

BRAND = "#2549c9"


def _layout(heading, body_html, button=None, footer=None):
    button_html = ""
    if button:
        label, url = button
        button_html = f"""
        <tr><td style="padding:8px 0 24px;">
          <a href="{html.escape(url)}"
             style="background:{BRAND};color:#ffffff;text-decoration:none;
                    display:inline-block;padding:12px 24px;border-radius:8px;
                    font-weight:600;font-size:15px;">{html.escape(label)}</a>
        </td></tr>"""

    footer_html = ""
    if footer:
        footer_html = f"""
        <tr><td style="padding-top:20px;border-top:1px solid #dee3ec;color:#67748b;
                       font-size:13px;line-height:1.6;">{footer}</td></tr>"""

    return f"""<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f8fb;
                   font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;
                border:1px solid #dee3ec;">
    <tr><td style="padding:28px 32px 0;">
      <span style="display:inline-block;width:36px;height:36px;line-height:36px;
                   text-align:center;background:{BRAND};color:#fff;border-radius:8px;
                   font-weight:700;font-size:16px;">P</span>
      <span style="margin-left:10px;font-weight:600;font-size:17px;color:#121926;
                   letter-spacing:.04em;vertical-align:middle;">PROPORA</span>
    </td></tr>
    <tr><td style="padding:24px 32px 0;">
      <h1 style="margin:0 0 12px;font-size:21px;color:#121926;">{html.escape(heading)}</h1>
    </td></tr>
    <tr><td style="padding:0 32px 8px;color:#374255;font-size:15px;line-height:1.65;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:16px;">{body_html}</td></tr>
        {button_html}
        {footer_html}
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px 28px;color:#909db2;font-size:12px;">
      PROPORA — Property Management &amp; Tenant Portal
    </td></tr>
  </table>
</body></html>"""


def send_password_reset(user, reset_url, ttl_minutes=30):
    subject = "Reset your PROPORA password"

    text_body = (
        f"Hello {user.name},\n\n"
        f"We received a request to reset the password for your PROPORA account "
        f"({user.email}).\n\n"
        f"Open this link to choose a new password:\n{reset_url}\n\n"
        f"The link expires in {ttl_minutes} minutes and can only be used once.\n\n"
        f"If you did not request this, you can ignore this email — your password "
        f"will not change.\n"
    )

    html_body = _layout(
        heading="Reset your password",
        body_html=(
            f"<p style='margin:0 0 14px;'>Hello {html.escape(user.name)},</p>"
            f"<p style='margin:0;'>We received a request to reset the password for "
            f"<strong>{html.escape(user.email)}</strong>. Choose a new one using the "
            f"button below.</p>"
        ),
        button=("Reset my password", reset_url),
        footer=(
            f"This link expires in {ttl_minutes} minutes and can only be used once.<br>"
            f"If you did not request a reset, ignore this email — your password will "
            f"not change."
        ),
    )

    return send_email(user.email, subject, text_body, html_body)


def send_notification(user, title, message, link_url=None):
    """Mirror an in-app notification to email, when the user allows it."""
    if not user.notify_email:
        return False

    text_body = f"Hello {user.name},\n\n{title}\n\n{message}\n"
    if link_url:
        text_body += f"\nOpen PROPORA: {link_url}\n"

    html_body = _layout(
        heading=title,
        body_html=(
            f"<p style='margin:0 0 14px;'>Hello {html.escape(user.name)},</p>"
            f"<p style='margin:0;'>{html.escape(message)}</p>"
        ),
        button=("Open PROPORA", link_url) if link_url else None,
        footer="Manage which emails you receive in Settings → Notifications.",
    )

    return send_email(user.email, f"PROPORA — {title}", text_body, html_body)


def send_otp_email(user, code, minutes):
    """Deliver a sign-in code by email.

    A fallback for when no SMS gateway is configured but SMTP is — email is a
    real delivery channel, so the code must not also appear on screen.
    """
    subject = "Your PROPORA sign-in code"

    text_body = (
        f"Hello {user.name},\n\n"
        f"Your PROPORA sign-in code is {code}\n\n"
        f"It expires in {minutes} minutes and can only be used once.\n\n"
        f"If you did not try to sign in, you can ignore this email.\n"
    )

    html_body = _layout(
        heading="Your sign-in code",
        body_html=(
            f"<p style='margin:0 0 18px;'>Hello {html.escape(user.name)},</p>"
            f"<p style='margin:0 0 10px;'>Enter this code to finish signing in:</p>"
            f"<p style='margin:0;font-size:32px;font-weight:700;letter-spacing:8px;"
            f"font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:{BRAND};'>"
            f"{html.escape(code)}</p>"
        ),
        footer=(
            f"The code expires in {minutes} minutes and can only be used once.<br>"
            f"If you did not try to sign in, ignore this email."
        ),
    )

    return send_email(user.email, subject, text_body, html_body)

