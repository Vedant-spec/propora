from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import MAINTENANCE_FLOW, MAINTENANCE_OPEN, MaintenanceRequest, Property, User
from ..utils import (
    any_user_required,
    current_user,
    field_errors,
    log_activity,
    notify,
    parse_date,
    parse_decimal,
    staff_required,
)

bp = Blueprint("maintenance", __name__, url_prefix="/api/maintenance")

CATEGORIES = ("plumbing", "electrical", "cleaning", "hvac", "security", "other")
PRIORITIES = ("low", "medium", "high", "urgent")
CLOSED_STATUSES = ("completed", "closed")


def _scope(query, user):
    """Tenants only ever see their own tickets."""
    if user.is_staff:
        return query
    if not user.tenant_profile:
        return query.filter(db.false())
    return query.filter(MaintenanceRequest.tenant_id == user.tenant_profile.id)


@bp.get("")
@any_user_required
def list_requests():
    user = current_user()
    query = _scope(MaintenanceRequest.query, user)

    if user.is_staff:
        if request.args.get("property_id"):
            query = query.filter(MaintenanceRequest.property_id == int(request.args["property_id"]))
        if request.args.get("tenant_id"):
            query = query.filter(MaintenanceRequest.tenant_id == int(request.args["tenant_id"]))
        if request.args.get("assigned_to"):
            query = query.filter(MaintenanceRequest.assigned_to == int(request.args["assigned_to"]))

    status = request.args.get("status")
    if status == "open":
        query = query.filter(MaintenanceRequest.status.in_(MAINTENANCE_OPEN))
    elif status == "history":
        query = query.filter(MaintenanceRequest.status.in_(CLOSED_STATUSES))
    elif status and status != "all":
        query = query.filter(MaintenanceRequest.status == status)

    for field, column in (
        ("priority", MaintenanceRequest.priority),
        ("category", MaintenanceRequest.category),
    ):
        value = request.args.get(field)
        if value and value != "all":
            query = query.filter(column == value)

    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                MaintenanceRequest.title.ilike(like),
                MaintenanceRequest.description.ilike(like),
                MaintenanceRequest.ticket_code.ilike(like),
            )
        )

    items = query.order_by(MaintenanceRequest.created_at.desc()).all()
    return jsonify([m.to_dict() for m in items])


@bp.get("/dashboard")
@staff_required
def dashboard():
    """Maintenance Dashboard — workload, ageing and category breakdown."""
    all_requests = MaintenanceRequest.query.all()
    open_requests = [m for m in all_requests if m.is_open]
    closed = [m for m in all_requests if m.status in CLOSED_STATUSES]

    by_status = {status: 0 for status in MAINTENANCE_FLOW}
    for item in all_requests:
        by_status[item.status] = by_status.get(item.status, 0) + 1

    by_category = [
        {"category": category, "count": count}
        for category, count in db.session.query(
            MaintenanceRequest.category, db.func.count(MaintenanceRequest.id)
        )
        .group_by(MaintenanceRequest.category)
        .all()
    ]

    by_priority = [
        {"priority": priority, "count": count}
        for priority, count in db.session.query(
            MaintenanceRequest.priority, db.func.count(MaintenanceRequest.id)
        )
        .group_by(MaintenanceRequest.priority)
        .all()
    ]

    resolved_times = [m.age_days for m in closed if m.created_at]
    avg_resolution = round(sum(resolved_times) / len(resolved_times), 1) if resolved_times else 0.0

    week_ago = datetime.utcnow() - timedelta(days=7)
    raised_this_week = sum(1 for m in all_requests if m.created_at and m.created_at >= week_ago)
    closed_this_week = sum(
        1 for m in closed if (m.completed_at or m.closed_at) and (m.completed_at or m.closed_at) >= week_ago
    )

    ageing = sorted(
        [m for m in open_requests if m.age_days >= 7],
        key=lambda m: m.age_days,
        reverse=True,
    )

    return jsonify(
        {
            "stats": {
                "total": len(all_requests),
                "open": len(open_requests),
                "urgent_open": sum(1 for m in open_requests if m.priority == "urgent"),
                "unassigned": sum(1 for m in open_requests if not m.assigned_to),
                "completed": by_status.get("completed", 0),
                "closed": by_status.get("closed", 0),
                "avg_resolution_days": avg_resolution,
                "raised_this_week": raised_this_week,
                "closed_this_week": closed_this_week,
                "total_cost": sum(float(m.cost or 0) for m in all_requests),
            },
            "by_status": [{"status": key, "count": by_status.get(key, 0)} for key in MAINTENANCE_FLOW],
            "by_category": by_category,
            "by_priority": by_priority,
            "ageing": [m.to_dict() for m in ageing[:8]],
            "recent": [m.to_dict() for m in sorted(
                all_requests, key=lambda m: m.created_at or datetime.min, reverse=True
            )[:8]],
        }
    )


@bp.get("/<int:request_id>")
@any_user_required
def get_request(request_id):
    user = current_user()
    req = _scope(MaintenanceRequest.query.filter(MaintenanceRequest.id == request_id), user).first()
    if req is None:
        return jsonify({"message": "Request not found"}), 404
    return jsonify(req.to_dict())


@bp.post("")
@any_user_required
def create_request():
    user = current_user()
    data = request.get_json(silent=True) or {}

    errors = {}
    if not (data.get("title") or "").strip():
        errors["title"] = "Describe the problem in a few words"
    if data.get("category") and data["category"] not in CATEGORIES:
        errors["category"] = "Choose a valid category"
    if data.get("priority") and data["priority"] not in PRIORITIES:
        errors["priority"] = "Choose a valid priority"

    if user.is_staff:
        if not data.get("property_id"):
            errors["property_id"] = "Choose a property"
        if errors:
            return field_errors(errors)
        property_id = int(data["property_id"])
        tenant_id = int(data["tenant_id"]) if data.get("tenant_id") else None
    else:
        profile = user.tenant_profile
        lease = profile.active_lease if profile else None
        if lease is None:
            return jsonify(
                {"message": "You do not have an active lease to raise a request against"}
            ), 400
        if errors:
            return field_errors(errors)
        property_id = lease.property_id
        tenant_id = profile.id

    Property.query.get_or_404(property_id)

    req = MaintenanceRequest(
        property_id=property_id,
        tenant_id=tenant_id,
        title=data["title"].strip(),
        description=data.get("description"),
        category=data.get("category", "other"),
        priority=data.get("priority", "medium"),
    )
    db.session.add(req)
    db.session.flush()
    req.ticket_code = f"MR-{req.id:04d}"

    log_activity("created", "maintenance", req.id, f"Request raised: {req.title}")
    notify(
        "New maintenance request",
        f"{req.ticket_code} — {req.title} ({req.priority})",
        kind="maintenance",
        link="/maintenance",
        audience="staff",
    )
    db.session.commit()
    return jsonify(req.to_dict()), 201


@bp.put("/<int:request_id>")
@staff_required
def update_request(request_id):
    req = MaintenanceRequest.query.get_or_404(request_id)
    data = request.get_json(silent=True) or {}

    errors = {}
    if data.get("status") and data["status"] not in MAINTENANCE_FLOW:
        errors["status"] = "Choose a valid status"
    if data.get("priority") and data["priority"] not in PRIORITIES:
        errors["priority"] = "Choose a valid priority"
    if data.get("status") in CLOSED_STATUSES and not (
        data.get("resolution_notes") or req.resolution_notes
    ):
        errors["resolution_notes"] = "Add a note describing what was done"
    if errors:
        return field_errors(errors)

    for field in (
        "title",
        "description",
        "category",
        "priority",
        "resolution_notes",
        "technician_name",
        "technician_phone",
    ):
        if field in data:
            setattr(req, field, data[field])

    if "cost" in data:
        try:
            req.cost = parse_decimal(data["cost"], "cost")
        except ValueError:
            return field_errors({"cost": "Enter a valid amount"})

    if "scheduled_date" in data:
        try:
            req.scheduled_date = parse_date(data["scheduled_date"], "scheduled_date")
        except ValueError:
            return field_errors({"scheduled_date": "Enter a valid date"})

    if "assigned_to" in data:
        req.assigned_to = int(data["assigned_to"]) if data["assigned_to"] else None
        if req.assigned_to:
            req.assigned_at = req.assigned_at or datetime.utcnow()
            if req.status == "open":
                req.status = "assigned"

    previous = req.status
    if data.get("status"):
        req.status = data["status"]
        if req.status == "assigned" and not req.assigned_at:
            req.assigned_at = datetime.utcnow()
        req.completed_at = datetime.utcnow() if req.status == "completed" else req.completed_at
        req.closed_at = datetime.utcnow() if req.status == "closed" else None
        if req.status in MAINTENANCE_OPEN:
            req.completed_at = None

    req.updated_at = datetime.utcnow()

    log_activity("updated", "maintenance", req.id, f"{req.ticket_code} moved to {req.status}")
    if req.status != previous and req.tenant and req.tenant.user_id:
        notify(
            "Maintenance update",
            f"{req.ticket_code} — {req.title} is now {req.status.replace('_', ' ')}.",
            kind="maintenance",
            link="/portal/maintenance",
            user_id=req.tenant.user_id,
        )
    db.session.commit()
    return jsonify(req.to_dict())


@bp.post("/<int:request_id>/assign")
@staff_required
def assign_request(request_id):
    """Assign Maintenance Request — staff member and optional external technician."""
    req = MaintenanceRequest.query.get_or_404(request_id)
    data = request.get_json(silent=True) or {}

    if not data.get("assigned_to") and not data.get("technician_name"):
        return field_errors({"assigned_to": "Choose a staff member or name a technician"})

    if data.get("assigned_to"):
        User.query.get_or_404(int(data["assigned_to"]))
        req.assigned_to = int(data["assigned_to"])

    req.technician_name = data.get("technician_name", req.technician_name)
    req.technician_phone = data.get("technician_phone", req.technician_phone)
    if data.get("scheduled_date"):
        try:
            req.scheduled_date = parse_date(data["scheduled_date"], "scheduled_date")
        except ValueError:
            return field_errors({"scheduled_date": "Enter a valid date"})

    req.assigned_at = datetime.utcnow()
    if req.status == "open":
        req.status = "assigned"
    req.updated_at = datetime.utcnow()

    log_activity("updated", "maintenance", req.id, f"{req.ticket_code} assigned")
    if req.tenant and req.tenant.user_id:
        notify(
            "Your request has been assigned",
            f"{req.ticket_code} — {req.title} is being handled.",
            kind="maintenance",
            link="/portal/maintenance",
            user_id=req.tenant.user_id,
        )
    db.session.commit()
    return jsonify(req.to_dict())


@bp.delete("/<int:request_id>")
@staff_required
def delete_request(request_id):
    req = MaintenanceRequest.query.get_or_404(request_id)
    code = req.ticket_code
    db.session.delete(req)
    log_activity("deleted", "maintenance", request_id, f"Request deleted: {code}")
    db.session.commit()
    return jsonify({"message": "Request deleted"})
