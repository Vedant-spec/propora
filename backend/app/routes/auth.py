from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token

from ..extensions import db
from ..mailer import send_password_reset
from ..models import PasswordResetToken, ROLE_ADMIN, ROLE_TENANT, Tenant, User
from ..utils import (
    any_user_required,
    current_user,
    field_errors,
    log_activity,
    require_fields,
    roles_required,
    staff_required,
)

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

PREFERENCE_FIELDS = (
    "theme",
    "density",
    "notify_email",
    "notify_rent",
    "notify_maintenance",
    "notify_lease",
)


def issue_token(user):
    return create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "tv": user.token_version},
    )


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    errors = {}
    if not data.get("email"):
        errors["email"] = "Enter your email address"
    if not data.get("password"):
        errors["password"] = "Enter your password"
    if errors:
        return field_errors(errors)

    user = User.query.filter(db.func.lower(User.email) == data["email"].strip().lower()).first()
    if user is None or not user.check_password(data["password"]):
        return jsonify({"message": "Invalid email or password"}), 401
    if not user.is_active:
        return jsonify({"message": "This account has been disabled. Contact an administrator."}), 403

    user.last_login_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"access_token": issue_token(user), "user": user.to_dict()})


@bp.get("/me")
@any_user_required
def me():
    return jsonify(current_user().to_dict())


@bp.put("/me")
@any_user_required
def update_me():
    user = current_user()
    data = request.get_json(silent=True) or {}

    if "name" in data and not str(data["name"]).strip():
        return field_errors({"name": "Name cannot be empty"})

    user.name = data.get("name", user.name)
    user.phone = data.get("phone", user.phone)

    profile = user.tenant_profile
    if profile:
        profile.full_name = user.name
        profile.phone = user.phone
        for field in (
            "occupation",
            "date_of_birth",
            "gender",
            "emergency_name",
            "emergency_relationship",
            "emergency_phone",
        ):
            if field in data and field != "date_of_birth":
                setattr(profile, field, data[field])

    db.session.commit()
    return jsonify(user.to_dict())


@bp.put("/preferences")
@any_user_required
def update_preferences():
    """Theme, density and notification toggles — the Settings screens."""
    user = current_user()
    data = request.get_json(silent=True) or {}

    if data.get("theme") and data["theme"] not in ("light", "dark", "system"):
        return field_errors({"theme": "Theme must be light, dark or system"})

    for field in PREFERENCE_FIELDS:
        if field in data:
            setattr(user, field, data[field])

    db.session.commit()
    return jsonify(user.to_dict())


@bp.post("/change-password")
@any_user_required
def change_password():
    user = current_user()
    data = request.get_json(silent=True) or {}
    errors = {}

    if not data.get("current_password"):
        errors["current_password"] = "Enter your current password"
    elif not user.check_password(data["current_password"]):
        errors["current_password"] = "That password is not correct"

    new_password = data.get("new_password") or ""
    if len(new_password) < 6:
        errors["new_password"] = "Use at least 6 characters"
    if errors:
        return field_errors(errors)

    user.set_password(new_password)
    log_activity("updated", "account", user.id, f"{user.name} changed their password")
    db.session.commit()
    return jsonify({"message": "Password updated"})


@bp.post("/sign-out-everywhere")
@any_user_required
def sign_out_everywhere():
    """Invalidate every issued token, then hand back a fresh one for this device."""
    user = current_user()
    user.token_version += 1
    log_activity("updated", "account", user.id, f"{user.name} signed out of all devices")
    db.session.commit()
    return jsonify({"message": "Signed out of all other devices", "access_token": issue_token(user)})


# --------------------------------------------------------------------------
# Password reset
# --------------------------------------------------------------------------


@bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    if not data.get("email"):
        return field_errors({"email": "Enter your email address"})

    user = User.query.filter(db.func.lower(User.email) == data["email"].strip().lower()).first()
    ttl = current_app.config["PASSWORD_RESET_TTL_MINUTES"]

    if user and user.is_active:
        # Retire any earlier unused link so only the newest one works.
        PasswordResetToken.query.filter_by(user_id=user.id, used_at=None).update(
            {"used_at": datetime.utcnow()}
        )
        reset = PasswordResetToken.issue(user, ttl_minutes=ttl)
        db.session.commit()

        reset_url = f"{current_app.config['APP_BASE_URL']}/reset-password?token={reset.token}"
        send_password_reset(user, reset_url, ttl_minutes=ttl)

    # Always the same answer, whether or not the address exists — otherwise this
    # endpoint becomes a way to discover which emails have accounts.
    return jsonify(
        {
            "message": "If that email is registered, a reset link is on its way.",
            "expires_in_minutes": ttl,
        }
    )


@bp.get("/reset-password/<token>")
def check_reset_token(token):
    reset = PasswordResetToken.query.filter_by(token=token).first()
    if reset is None or not reset.is_valid:
        return jsonify({"valid": False, "message": "This reset link is invalid or has expired"}), 400
    return jsonify({"valid": True, "email": reset.user.email, "name": reset.user.name})


@bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    errors = {}
    if not data.get("token"):
        errors["token"] = "Reset link is missing"
    if len(data.get("new_password") or "") < 6:
        errors["new_password"] = "Use at least 6 characters"
    if data.get("new_password") != data.get("confirm_password"):
        errors["confirm_password"] = "Passwords do not match"
    if errors:
        return field_errors(errors)

    reset = PasswordResetToken.query.filter_by(token=data["token"]).first()
    if reset is None or not reset.is_valid:
        return jsonify({"message": "This reset link is invalid or has expired"}), 400

    user = reset.user
    user.set_password(data["new_password"])
    user.token_version += 1  # any existing session is now stale
    reset.used_at = datetime.utcnow()
    log_activity("updated", "account", user.id, f"{user.name} reset their password", actor=user)
    db.session.commit()

    return jsonify({"message": "Password reset. You can sign in now."})


# --------------------------------------------------------------------------
# User accounts (admin)
# --------------------------------------------------------------------------


@bp.get("/users")
@staff_required  # managers need the staff list to assign maintenance work
def list_users():
    query = User.query
    role = request.args.get("role")
    if role and role != "all":
        query = query.filter(User.role == role)
    return jsonify([u.to_dict() for u in query.order_by(User.name).all()])


@bp.post("/users")
@roles_required(ROLE_ADMIN)
def create_user():
    data = request.get_json(silent=True) or {}
    errors = {}
    for field, label in (("name", "Name"), ("email", "Email"), ("password", "Password"), ("role", "Role")):
        if not data.get(field):
            errors[field] = f"{label} is required"
    if data.get("password") and len(data["password"]) < 6:
        errors["password"] = "Use at least 6 characters"
    if errors:
        return field_errors(errors)

    email = data["email"].strip().lower()
    if User.query.filter(db.func.lower(User.email) == email).first():
        return field_errors({"email": "A user with that email already exists"})

    user = User(
        name=data["name"].strip(),
        email=email,
        phone=data.get("phone"),
        role=data["role"],
        is_active=data.get("is_active", True),
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    # A tenant login always gets a matching tenant record.
    if user.role == ROLE_TENANT:
        db.session.add(
            Tenant(user_id=user.id, full_name=user.name, email=user.email, phone=user.phone)
        )

    log_activity("created", "user", user.id, f"Account created for {user.name} ({user.role})")
    db.session.commit()
    return jsonify(user.to_dict()), 201


@bp.put("/users/<int:user_id>")
@roles_required(ROLE_ADMIN)
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if data.get("password") and len(data["password"]) < 6:
        return field_errors({"password": "Use at least 6 characters"})

    user.name = data.get("name", user.name)
    user.phone = data.get("phone", user.phone)
    user.role = data.get("role", user.role)
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if data.get("password"):
        user.set_password(data["password"])
        user.token_version += 1

    log_activity("updated", "user", user.id, f"Account updated for {user.name}")
    db.session.commit()
    return jsonify(user.to_dict())


@bp.delete("/users/<int:user_id>")
@roles_required(ROLE_ADMIN)
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user().id:
        return jsonify({"message": "You cannot delete your own account"}), 400
    name = user.name
    db.session.delete(user)
    log_activity("deleted", "user", user_id, f"Account deleted for {name}")
    db.session.commit()
    return jsonify({"message": "User deleted"})
