import re
from datetime import datetime
from functools import wraps

from flask import current_app, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from .extensions import db
from .mailer import send_notification
from .models import Activity, Notification, ROLE_TENANT, STAFF_ROLES, User


def current_user():
    identity = get_jwt_identity()
    if identity is None:
        return None
    return User.query.get(int(identity))


def roles_required(*roles):
    """Guard a view so only the listed roles may call it."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = current_user()
            if user is None or not user.is_active:
                return jsonify({"message": "Account not found or disabled"}), 401
            # "Sign out everywhere" bumps token_version, retiring older tokens.
            if get_jwt().get("tv") != user.token_version:
                return jsonify({"message": "Session ended, please sign in again"}), 401
            if roles and user.role not in roles:
                return jsonify({"message": "You do not have access to this resource"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def any_user_required(fn):
    return roles_required()(fn)


def staff_required(fn):
    return roles_required(*STAFF_ROLES)(fn)


def tenant_required(fn):
    return roles_required(ROLE_TENANT)(fn)


def log_activity(action, entity_type, entity_id, summary, actor=None):
    """Record an audit-style entry for the Recent Activity feed."""
    db.session.add(
        Activity(
            actor_id=(actor or current_user()).id if (actor or current_user()) else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
        )
    )


def notify(title, message, kind="info", link=None, user_id=None, audience=None):
    """Create an in-app notification, and mirror it to email when allowed."""
    db.session.add(
        Notification(
            user_id=user_id,
            audience=audience,
            title=title,
            message=message,
            kind=kind,
            link=link,
        )
    )

    if user_id is None:
        return  # broadcast to a role — in-app only

    recipient = User.query.get(user_id)
    if recipient is None or not recipient.is_active:
        return

    # Respect the per-topic switches from Settings → Notifications.
    topic_allowed = {
        "rent": recipient.notify_rent,
        "maintenance": recipient.notify_maintenance,
        "lease": recipient.notify_lease,
    }.get(kind, True)
    if not topic_allowed:
        return

    link_url = f"{current_app.config['APP_BASE_URL']}{link}" if link else None
    send_notification(recipient, title, message, link_url)


def normalize_phone(value):
    """Reduce a phone number to comparable digits.

    People type +91 98200 41122, 09820041122 and 9820041122 for the same
    number, so match on the last 10 digits rather than the raw string.
    """
    digits = re.sub(r"\D", "", value or "")
    return digits[-10:] if len(digits) >= 10 else digits


def find_user_by_phone(phone):
    """Look a user up by phone, tolerating formatting differences."""
    target = normalize_phone(phone)
    if len(target) < 10:
        return None
    for user in User.query.filter(User.phone.isnot(None)).all():
        if normalize_phone(user.phone) == target:
            return user
    return None


def parse_date(value, field="date", required=False):
    """Parse an ISO date string; raises ValueError with a readable message."""
    if value in (None, ""):
        if required:
            raise ValueError(f"{field} is required")
        return None
    if isinstance(value, str):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"{field} must be in YYYY-MM-DD format")
    return value


def parse_decimal(value, field="amount", default=0.0):
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a number")


def parse_int(value, field="value", default=None):
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a whole number")


def require_fields(payload, fields):
    missing = [f for f in fields if not payload.get(f)]
    if missing:
        raise ValueError("Missing required field(s): " + ", ".join(missing))


def field_errors(errors):
    """Return a 422 with per-field messages the forms can render inline."""
    return jsonify({"message": "Please correct the highlighted fields", "errors": errors}), 422
