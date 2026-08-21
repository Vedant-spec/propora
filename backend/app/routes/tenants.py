import os
import re
import uuid

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import Lease, Property, ROLE_TENANT, Tenant, User
from ..utils import (
    field_errors,
    log_activity,
    parse_date,
    parse_decimal,
    staff_required,
)

bp = Blueprint("tenants", __name__, url_prefix="/api/tenants")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_DOCS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

TEXT_FIELDS = (
    "full_name",
    "phone",
    "gender",
    "id_proof_type",
    "id_number",
    "occupation",
    "unit_room",
    "emergency_name",
    "emergency_relationship",
    "emergency_phone",
    "notes",
)


def validate(data, existing=None):
    errors = {}
    if not (data.get("full_name") or (existing and existing.full_name)):
        errors["full_name"] = "Full name is required"

    email = (data.get("email") or "").strip()
    if not existing and not email:
        errors["email"] = "Email is required"
    elif email and not EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address"

    phone = (data.get("phone") or "").strip()
    if phone and len(re.sub(r"\D", "", phone)) < 7:
        errors["phone"] = "Enter a valid phone number"

    if data.get("date_of_birth"):
        try:
            parse_date(data["date_of_birth"], "date_of_birth")
        except ValueError:
            errors["date_of_birth"] = "Enter a valid date"

    return errors


@bp.get("")
@staff_required
def list_tenants():
    query = Tenant.query
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(Tenant.full_name.ilike(like), Tenant.email.ilike(like), Tenant.phone.ilike(like))
        )

    items = query.order_by(Tenant.full_name).all()

    status = request.args.get("lease_status")
    if status and status != "all":
        if status == "unassigned":
            items = [t for t in items if not t.active_lease]
        else:
            items = [t for t in items if t.active_lease and t.active_lease.lease_state == status]

    return jsonify([t.to_dict() for t in items])


@bp.get("/<int:tenant_id>")
@staff_required
def get_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    return jsonify(tenant.to_dict(deep=True))


@bp.post("")
@staff_required
def create_tenant():
    data = request.get_json(silent=True) or {}
    errors = validate(data)
    if errors:
        return field_errors(errors)

    email = data["email"].strip().lower()
    tenant = Tenant(full_name=data["full_name"].strip(), email=email)
    for field in TEXT_FIELDS:
        if field in data:
            setattr(tenant, field, data[field])
    tenant.date_of_birth = parse_date(data.get("date_of_birth"), "date_of_birth")

    if data.get("create_login"):
        if User.query.filter(db.func.lower(User.email) == email).first():
            return field_errors({"email": "A user account with that email already exists"})
        password = data.get("password") or "tenant123"
        if len(password) < 6:
            return field_errors({"password": "Use at least 6 characters"})
        user = User(name=tenant.full_name, email=email, phone=tenant.phone, role=ROLE_TENANT)
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        tenant.user_id = user.id

    db.session.add(tenant)
    db.session.flush()
    log_activity("created", "tenant", tenant.id, f"Tenant added: {tenant.full_name}")
    db.session.commit()
    return jsonify(tenant.to_dict()), 201


@bp.put("/<int:tenant_id>")
@staff_required
def update_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    data = request.get_json(silent=True) or {}
    errors = validate(data, existing=tenant)
    if errors:
        return field_errors(errors)

    for field in TEXT_FIELDS:
        if field in data:
            setattr(tenant, field, data[field])
    if "date_of_birth" in data:
        tenant.date_of_birth = parse_date(data["date_of_birth"], "date_of_birth")

    if tenant.user:
        tenant.user.name = tenant.full_name
        tenant.user.phone = tenant.phone

    log_activity("updated", "tenant", tenant.id, f"Tenant updated: {tenant.full_name}")
    db.session.commit()
    return jsonify(tenant.to_dict())


@bp.delete("/<int:tenant_id>")
@staff_required
def delete_tenant(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    if tenant.active_lease:
        return jsonify(
            {"message": "This tenant has an active lease. End the lease before deleting them."}
        ), 400
    name = tenant.full_name
    user = tenant.user
    db.session.delete(tenant)
    if user:
        db.session.delete(user)
    log_activity("deleted", "tenant", tenant_id, f"Tenant deleted: {name}")
    db.session.commit()
    return jsonify({"message": "Tenant deleted"})


@bp.post("/<int:tenant_id>/login")
@staff_required
def create_login(tenant_id):
    """Give an existing tenant record a portal login."""
    tenant = Tenant.query.get_or_404(tenant_id)
    if tenant.user_id:
        return jsonify({"message": "This tenant already has a login"}), 400

    data = request.get_json(silent=True) or {}
    password = data.get("password") or "tenant123"
    if len(password) < 6:
        return field_errors({"password": "Use at least 6 characters"})
    if User.query.filter(db.func.lower(User.email) == tenant.email.lower()).first():
        return field_errors({"email": "A user account with that email already exists"})

    user = User(name=tenant.full_name, email=tenant.email, phone=tenant.phone, role=ROLE_TENANT)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    tenant.user_id = user.id
    log_activity("created", "user", user.id, f"Portal login created for {tenant.full_name}")
    db.session.commit()
    return jsonify(tenant.to_dict())


@bp.post("/<int:tenant_id>/assign")
@staff_required
def assign_property(tenant_id):
    """Tenant Property Assignment — creates the lease that links the two."""
    from .leases import generate_schedule  # local import avoids a cycle

    tenant = Tenant.query.get_or_404(tenant_id)
    data = request.get_json(silent=True) or {}

    errors = {}
    if not data.get("property_id"):
        errors["property_id"] = "Choose a property"
    if not data.get("start_date"):
        errors["start_date"] = "Lease start date is required"
    if not data.get("end_date"):
        errors["end_date"] = "Lease end date is required"
    if errors:
        return field_errors(errors)

    if tenant.active_lease:
        return jsonify({"message": f"{tenant.full_name} already has an active lease"}), 409

    prop = Property.query.get_or_404(int(data["property_id"]))
    if prop.active_lease:
        return field_errors({"property_id": f"{prop.name} is already occupied"})

    try:
        start = parse_date(data["start_date"], "start_date", required=True)
        end = parse_date(data["end_date"], "end_date", required=True)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    if end <= start:
        return field_errors({"end_date": "End date must be after the start date"})

    lease = Lease(
        property_id=prop.id,
        tenant_id=tenant.id,
        start_date=start,
        end_date=end,
        rent_amount=parse_decimal(data.get("rent_amount"), "rent_amount") or float(prop.rent_amount or 0),
        deposit_amount=parse_decimal(data.get("deposit_amount"), "deposit_amount")
        or float(prop.security_deposit or 0),
        rent_due_day=int(data.get("rent_due_day") or 5),
        status="active",
        terms=data.get("terms"),
    )
    db.session.add(lease)
    db.session.flush()
    lease.lease_code = f"LS-{lease.id:04d}"
    prop.status = "occupied"
    if data.get("unit_room"):
        tenant.unit_room = data["unit_room"]
    if data.get("generate_schedule", True):
        generate_schedule(lease)

    log_activity(
        "created", "lease", lease.id, f"{tenant.full_name} assigned to {prop.name}"
    )
    db.session.commit()
    return jsonify(lease.to_dict(deep=True)), 201


@bp.post("/<int:tenant_id>/document")
@staff_required
def upload_document(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return field_errors({"document": "Choose a file to upload"})

    extension = os.path.splitext(uploaded.filename)[1].lower()
    if extension not in ALLOWED_DOCS:
        return field_errors({"document": "Upload a PDF or an image (PNG, JPG, WEBP)"})

    folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(folder, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{extension}"
    uploaded.save(os.path.join(folder, stored))

    tenant.document_name = f"{stored}|{secure_filename(uploaded.filename)}"
    log_activity("updated", "tenant", tenant.id, f"ID document uploaded for {tenant.full_name}")
    db.session.commit()
    return jsonify(tenant.to_dict())


@bp.get("/<int:tenant_id>/document")
@staff_required
def download_document(tenant_id):
    tenant = Tenant.query.get_or_404(tenant_id)
    if not tenant.document_name:
        return jsonify({"message": "No document on file"}), 404
    stored, _, original = tenant.document_name.partition("|")
    return send_from_directory(
        current_app.config["UPLOAD_FOLDER"],
        stored,
        as_attachment=True,
        download_name=original or stored,
    )
