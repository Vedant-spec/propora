"""Self-service account routes: sign up, and sign in with a phone code.

Two deliberate constraints:

* Public sign-up only ever creates a **tenant**. Administrator and property
  manager accounts are created from inside the app by an administrator, so a
  stranger cannot register themselves into the management console.
* Sign-up links to an existing tenant record when the email already matches
  one, so somebody a manager has already added arrives to their real lease,
  invoices and maintenance history rather than an empty portal.
"""
import re
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request

from ..extensions import db
from ..models import OtpCode, ROLE_TENANT, Tenant, User
from ..mailer import is_configured as mail_configured
from ..mailer import send_otp_email
from ..sms import is_configured as sms_configured
from ..sms import send_otp
from ..utils import field_errors, find_user_by_phone, log_activity, normalize_phone

bp = Blueprint("accounts", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 6


def issue_token(user):
    from .auth import issue_token as _issue

    return _issue(user)


def _deliver_code(user, phone, code, ttl):
    """Send the code by the best channel available.

    SMS first, since that is what the user asked for; email second, because a
    real inbox still beats no delivery. Returns the channel used, or None.
    """
    if send_otp(phone, code, ttl):
        return "sms"
    if mail_configured() and user.email and send_otp_email(user, code, ttl):
        return "email"
    return None


def _reveal_code(code, channel):
    """Whether to hand the code back to the client.

    Only when nothing could deliver it — a code that went out over SMS or
    email must never also appear in an API response.
    """
    if channel is not None:
        return None
    if not current_app.config["SHOW_OTP_WITHOUT_GATEWAY"]:
        return None
    return code


# ---------------------------------------------------------------------------
# Sign up
# ---------------------------------------------------------------------------


@bp.get("/signup-enabled")
def signup_enabled():
    return jsonify(
        {
            "enabled": current_app.config["ALLOW_PUBLIC_SIGNUP"],
            "sms_configured": sms_configured(),
        }
    )


@bp.post("/register")
def register():
    if not current_app.config["ALLOW_PUBLIC_SIGNUP"]:
        return jsonify({"message": "Sign-up is closed. Ask your property manager for an account."}), 403

    data = request.get_json(silent=True) or {}
    errors = {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not name:
        errors["name"] = "Enter your full name"
    if not email:
        errors["email"] = "Enter your email address"
    elif not EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address"
    elif User.query.filter(db.func.lower(User.email) == email).first():
        errors["email"] = "An account with that email already exists. Try signing in."

    if phone:
        if len(normalize_phone(phone)) < 10:
            errors["phone"] = "Enter a valid 10-digit mobile number"
        elif find_user_by_phone(phone):
            errors["phone"] = "That mobile number is already registered"

    # Checked independently so a short *and* mismatched password reports both
    # at once, rather than making the user fix one to discover the other.
    if len(password) < MIN_PASSWORD:
        errors["password"] = f"Use at least {MIN_PASSWORD} characters"
    if password and password != data.get("confirm_password"):
        errors["confirm_password"] = "Passwords do not match"

    if errors:
        return field_errors(errors)

    user = User(name=name, email=email, phone=phone or None, role=ROLE_TENANT)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    # If a manager already created this person as a tenant, adopt that record
    # so their lease and payment history are there on first sign-in.
    profile = Tenant.query.filter(db.func.lower(Tenant.email) == email).first()
    if profile and profile.user_id is None:
        profile.user_id = user.id
        if phone and not profile.phone:
            profile.phone = phone
        linked = True
    elif profile and profile.user_id is not None:
        # An account already claims that tenant record — do not hijack it.
        db.session.rollback()
        return field_errors({"email": "An account with that email already exists. Try signing in."})
    else:
        db.session.add(
            Tenant(user_id=user.id, full_name=name, email=email, phone=phone or None)
        )
        linked = False

    log_activity(
        "created", "user", user.id,
        f"{name} signed up" + (" and was linked to an existing tenant record" if linked else ""),
        actor=user,
    )
    db.session.commit()

    return (
        jsonify(
            {
                "access_token": issue_token(user),
                "user": user.to_dict(),
                "linked_to_existing_tenant": linked,
            }
        ),
        201,
    )


# ---------------------------------------------------------------------------
# Phone sign-in
# ---------------------------------------------------------------------------


@bp.post("/otp/request")
def request_otp():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()

    if len(normalize_phone(phone)) < 10:
        return field_errors({"phone": "Enter a valid 10-digit mobile number"})

    user = find_user_by_phone(phone)
    ttl = OtpCode.TTL_MINUTES

    # Same answer whether or not the number is registered, so this endpoint
    # cannot be used to discover who has an account.
    response = {
        "message": f"If that number is registered, a {OtpCode.OTP_LENGTH}-digit code is on its way.",
        "expires_in_minutes": ttl,
        "resend_in_seconds": OtpCode.RESEND_SECONDS,
        "sms_configured": sms_configured(),
    }

    if user is None or not user.is_active:
        return jsonify(response)

    recent = (
        OtpCode.query.filter_by(user_id=user.id)
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if recent and recent.seconds_until_resend > 0:
        return jsonify(
            {
                "message": f"A code was just sent. Try again in {recent.seconds_until_resend} seconds.",
                "resend_in_seconds": recent.seconds_until_resend,
                "expires_in_minutes": ttl,
                "sms_configured": sms_configured(),
            }
        ), 429

    hour_ago = datetime.utcnow() - timedelta(hours=1)
    sent_recently = OtpCode.query.filter(
        OtpCode.user_id == user.id, OtpCode.created_at >= hour_ago
    ).count()
    if sent_recently >= OtpCode.HOURLY_LIMIT:
        return jsonify(
            {"message": "Too many codes requested. Try again later, or sign in with your password."}
        ), 429

    # Retire any code still outstanding so only the newest one works.
    for old in OtpCode.query.filter_by(user_id=user.id, consumed_at=None).all():
        old.consumed_at = datetime.utcnow()

    record, code = OtpCode.issue(user, phone)
    db.session.commit()

    channel = _deliver_code(user, phone, code, ttl)
    response["delivered_via"] = channel

    if channel == "sms":
        response["message"] = f"A {OtpCode.OTP_LENGTH}-digit code has been texted to {phone}."
    elif channel == "email":
        masked = user.email.split("@")[0][:2] + "•••@" + user.email.split("@")[-1]
        response["message"] = (
            f"No SMS gateway is connected, so the code was emailed to {masked} instead."
        )

    revealed = _reveal_code(code, channel)
    if revealed:
        response["demo_code"] = revealed
        response["message"] = (
            f"No SMS or email gateway is connected, so your "
            f"{OtpCode.OTP_LENGTH}-digit code is shown here."
        )
    return jsonify(response)


@bp.post("/otp/verify")
def verify_otp():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    code = (data.get("code") or "").strip()

    errors = {}
    if len(normalize_phone(phone)) < 10:
        errors["phone"] = "Enter a valid 10-digit mobile number"
    if not code:
        errors["code"] = "Enter the code you received"
    if errors:
        return field_errors(errors)

    user = find_user_by_phone(phone)
    generic = {"code": "That code is incorrect or has expired"}
    if user is None:
        return field_errors(generic)

    record = (
        OtpCode.query.filter_by(user_id=user.id, consumed_at=None)
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if record is None or not record.is_live:
        return field_errors({"code": "That code has expired. Request a new one."})

    if not record.verify(code):
        remaining = OtpCode.MAX_ATTEMPTS - record.attempts
        db.session.commit()
        if remaining <= 0:
            return field_errors({"code": "Too many incorrect attempts. Request a new code."})
        return field_errors(
            {"code": f"That code is incorrect. {remaining} attempt{'s' if remaining != 1 else ''} left."}
        )

    if not user.is_active:
        db.session.commit()
        return jsonify({"message": "This account has been disabled."}), 403

    user.phone_verified = True
    user.last_login_at = datetime.utcnow()
    log_activity("updated", "account", user.id, f"{user.name} signed in with a phone code", actor=user)
    db.session.commit()

    return jsonify({"access_token": issue_token(user), "user": user.to_dict()})
