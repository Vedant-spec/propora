from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import MaintenanceRequest, Property
from ..utils import field_errors, log_activity, parse_decimal, parse_int, staff_required

bp = Blueprint("properties", __name__, url_prefix="/api/properties")

TEXT_FIELDS = (
    "name",
    "address",
    "city",
    "state",
    "zip_code",
    "property_type",
    "unit_label",
    "floor",
    "furnishing",
    "status",
    "description",
    "property_code",
)
INT_FIELDS = ("bedrooms", "bathrooms", "area_sqft")
MONEY_FIELDS = ("rent_amount", "security_deposit", "maintenance_charge")


def validate(data, existing=None):
    errors = {}
    if not (data.get("name") or (existing and existing.name)):
        errors["name"] = "Property name is required"
    if not (data.get("address") or (existing and existing.address)):
        errors["address"] = "Address is required"

    for field in MONEY_FIELDS:
        if field in data:
            try:
                if parse_decimal(data[field], field) < 0:
                    errors[field] = "Cannot be negative"
            except ValueError:
                errors[field] = "Enter a valid number"

    code = (data.get("property_code") or "").strip()
    if code:
        clash = Property.query.filter(Property.property_code == code)
        if existing:
            clash = clash.filter(Property.id != existing.id)
        if clash.first():
            errors["property_code"] = "That property ID is already in use"

    return errors


def apply_fields(prop, data):
    for field in TEXT_FIELDS:
        if field in data:
            value = data[field]
            setattr(prop, field, value.strip() if isinstance(value, str) else value)
    for field in INT_FIELDS:
        if data.get(field) not in (None, ""):
            setattr(prop, field, parse_int(data[field], field, 0))
    for field in MONEY_FIELDS:
        if field in data:
            setattr(prop, field, parse_decimal(data[field], field))


@bp.get("")
@staff_required
def list_properties():
    query = Property.query

    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                Property.name.ilike(like),
                Property.address.ilike(like),
                Property.city.ilike(like),
                Property.property_code.ilike(like),
            )
        )

    status = request.args.get("status")
    if status and status != "all":
        query = query.filter(Property.status == status)

    ptype = request.args.get("type")
    if ptype and ptype != "all":
        query = query.filter(Property.property_type == ptype)

    furnishing = request.args.get("furnishing")
    if furnishing and furnishing != "all":
        query = query.filter(Property.furnishing == furnishing)

    sort = request.args.get("sort", "recent")
    order = {
        "recent": Property.created_at.desc(),
        "name": Property.name.asc(),
        "rent_high": Property.rent_amount.desc(),
        "rent_low": Property.rent_amount.asc(),
    }.get(sort, Property.created_at.desc())

    return jsonify([p.to_dict() for p in query.order_by(order).all()])


@bp.get("/summary")
@staff_required
def summary():
    """Counts behind the Property Availability screen."""
    rows = db.session.query(Property.status, db.func.count(Property.id)).group_by(Property.status).all()
    counts = {status: count for status, count in rows}
    total = sum(counts.values())
    return jsonify(
        {
            "total": total,
            "available": counts.get("available", 0),
            "occupied": counts.get("occupied", 0),
            "maintenance": counts.get("maintenance", 0),
            "occupancy_rate": round(counts.get("occupied", 0) / total * 100, 1) if total else 0.0,
        }
    )


@bp.get("/<int:property_id>")
@staff_required
def get_property(property_id):
    prop = Property.query.get_or_404(property_id)
    return jsonify(prop.to_dict(deep=True))


@bp.post("")
@staff_required
def create_property():
    data = request.get_json(silent=True) or {}
    errors = validate(data)
    if errors:
        return field_errors(errors)

    prop = Property()
    apply_fields(prop, data)
    db.session.add(prop)
    db.session.flush()
    if not prop.property_code:
        prop.property_code = f"PR-{prop.id:04d}"

    log_activity("created", "property", prop.id, f"Property added: {prop.name}")
    db.session.commit()
    return jsonify(prop.to_dict()), 201


@bp.put("/<int:property_id>")
@staff_required
def update_property(property_id):
    prop = Property.query.get_or_404(property_id)
    data = request.get_json(silent=True) or {}
    errors = validate(data, existing=prop)
    if errors:
        return field_errors(errors)

    # A unit with a live lease cannot be flipped back to available by hand.
    if data.get("status") == "available" and prop.active_lease:
        return field_errors({"status": "This unit has an active lease and cannot be marked available"})

    apply_fields(prop, data)
    log_activity("updated", "property", prop.id, f"Property updated: {prop.name}")
    db.session.commit()
    return jsonify(prop.to_dict())


@bp.delete("/<int:property_id>")
@staff_required
def delete_property(property_id):
    prop = Property.query.get_or_404(property_id)
    if prop.active_lease:
        return jsonify(
            {"message": "This property has an active lease. End the lease before deleting it."}
        ), 400
    name = prop.name
    db.session.delete(prop)
    log_activity("deleted", "property", property_id, f"Property deleted: {name}")
    db.session.commit()
    return jsonify({"message": "Property deleted"})


@bp.get("/<int:property_id>/maintenance")
@staff_required
def property_maintenance(property_id):
    Property.query.get_or_404(property_id)
    items = (
        MaintenanceRequest.query.filter_by(property_id=property_id)
        .order_by(MaintenanceRequest.created_at.desc())
        .all()
    )
    return jsonify([m.to_dict() for m in items])
