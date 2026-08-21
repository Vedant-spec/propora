from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import EXPIRING_WINDOW_DAYS, Lease, Payment, Property, Tenant
from ..utils import (
    field_errors,
    log_activity,
    notify,
    parse_date,
    parse_decimal,
    staff_required,
)

bp = Blueprint("leases", __name__, url_prefix="/api/leases")


def _month_starts(start: date, end: date):
    """Yield the first day of every month covered by the lease."""
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        yield date(year, month, 1)
        month += 1
        if month > 12:
            month, year = 1, year + 1


def generate_schedule(lease: Lease):
    """Create one pending rent invoice per month of the lease term."""
    existing = {p.period for p in lease.payments}
    created = []
    for first in _month_starts(lease.start_date, lease.end_date):
        period = first.strftime("%Y-%m")
        if period in existing:
            continue
        day = min(lease.rent_due_day or 5, 28)
        payment = Payment(
            lease_id=lease.id,
            amount=lease.rent_amount,
            due_date=date(first.year, first.month, day),
            period=period,
        )
        payment.refresh_status()
        db.session.add(payment)
        db.session.flush()
        payment.payment_code = f"PY-{payment.id:05d}"
        created.append(payment)
    return created


def validate(data, existing=None):
    errors = {}
    if not existing:
        if not data.get("property_id"):
            errors["property_id"] = "Choose a property"
        if not data.get("tenant_id"):
            errors["tenant_id"] = "Choose a tenant"

    start = end = None
    try:
        start = parse_date(data.get("start_date"), "start_date")
    except ValueError:
        errors["start_date"] = "Enter a valid date"
    try:
        end = parse_date(data.get("end_date"), "end_date")
    except ValueError:
        errors["end_date"] = "Enter a valid date"

    if not existing and not start:
        errors["start_date"] = "Start date is required"
    if not existing and not end:
        errors["end_date"] = "End date is required"

    start = start or (existing.start_date if existing else None)
    end = end or (existing.end_date if existing else None)
    if start and end and end <= start:
        errors["end_date"] = "End date must be after the start date"

    if data.get("rent_due_day") not in (None, ""):
        try:
            day = int(data["rent_due_day"])
            if not 1 <= day <= 28:
                errors["rent_due_day"] = "Pick a day between 1 and 28"
        except (TypeError, ValueError):
            errors["rent_due_day"] = "Pick a day between 1 and 28"

    for field in ("rent_amount", "deposit_amount"):
        if field in data:
            try:
                if parse_decimal(data[field], field) < 0:
                    errors[field] = "Cannot be negative"
            except ValueError:
                errors[field] = "Enter a valid number"

    return errors


@bp.get("")
@staff_required
def list_leases():
    query = Lease.query
    if request.args.get("property_id"):
        query = query.filter(Lease.property_id == int(request.args["property_id"]))
    if request.args.get("tenant_id"):
        query = query.filter(Lease.tenant_id == int(request.args["tenant_id"]))

    items = query.order_by(Lease.start_date.desc()).all()

    # lease_state is derived, so filter in Python rather than SQL.
    state = request.args.get("status")
    if state and state != "all":
        items = [l for l in items if l.lease_state == state]

    return jsonify([l.to_dict() for l in items])


@bp.get("/summary")
@staff_required
def summary():
    """Counts and rent roll behind the Lease Expiry / Status screen."""
    leases = Lease.query.all()
    active = [l for l in leases if l.lease_state == "active"]
    expiring = sorted(
        [l for l in leases if l.lease_state == "expiring_soon"],
        key=lambda l: l.end_date or date.max,
    )
    expired = [l for l in leases if l.lease_state == "expired"]
    terminated = [l for l in leases if l.status == "terminated"]

    return jsonify(
        {
            "total": len(leases),
            "active": len(active),
            "expiring_soon": len(expiring),
            "expired": len(expired),
            "terminated": len(terminated),
            "expiring_window_days": EXPIRING_WINDOW_DAYS,
            "monthly_rent_roll": sum(
                float(l.rent_amount or 0) for l in leases if l.status == "active"
            ),
            "deposits_held": sum(
                float(l.deposit_amount or 0) for l in leases if l.status == "active"
            ),
            "expiring_leases": [l.to_dict() for l in expiring],
        }
    )


@bp.get("/<int:lease_id>")
@staff_required
def get_lease(lease_id):
    lease = Lease.query.get_or_404(lease_id)
    return jsonify(lease.to_dict(deep=True))


@bp.post("")
@staff_required
def create_lease():
    data = request.get_json(silent=True) or {}
    errors = validate(data)
    if errors:
        return field_errors(errors)

    prop = Property.query.get_or_404(int(data["property_id"]))
    tenant = Tenant.query.get_or_404(int(data["tenant_id"]))

    if prop.active_lease:
        return field_errors({"property_id": f"{prop.name} already has an active lease"})
    if tenant.active_lease:
        return field_errors({"tenant_id": f"{tenant.full_name} already has an active lease"})

    lease = Lease(
        property_id=prop.id,
        tenant_id=tenant.id,
        start_date=parse_date(data["start_date"], "start_date"),
        end_date=parse_date(data["end_date"], "end_date"),
        rent_amount=parse_decimal(data.get("rent_amount"), "rent_amount") or float(prop.rent_amount or 0),
        deposit_amount=parse_decimal(data.get("deposit_amount"), "deposit_amount"),
        rent_due_day=int(data.get("rent_due_day") or 5),
        status=data.get("status", "active"),
        terms=data.get("terms"),
    )
    db.session.add(lease)
    db.session.flush()
    lease.lease_code = f"LS-{lease.id:04d}"

    if lease.status == "active":
        prop.status = "occupied"
    if data.get("generate_schedule", True):
        generate_schedule(lease)

    log_activity("created", "lease", lease.id, f"Lease created: {tenant.full_name} at {prop.name}")
    if tenant.user_id:
        notify(
            "Your lease is active",
            f"Your lease for {prop.name} runs to {lease.end_date:%d %b %Y}.",
            kind="lease",
            link="/portal/lease",
            user_id=tenant.user_id,
        )
    db.session.commit()
    return jsonify(lease.to_dict(deep=True)), 201


@bp.put("/<int:lease_id>")
@staff_required
def update_lease(lease_id):
    lease = Lease.query.get_or_404(lease_id)
    data = request.get_json(silent=True) or {}
    errors = validate(data, existing=lease)
    if errors:
        return field_errors(errors)

    if data.get("start_date"):
        lease.start_date = parse_date(data["start_date"], "start_date")
    if data.get("end_date"):
        lease.end_date = parse_date(data["end_date"], "end_date")
    if "rent_amount" in data:
        lease.rent_amount = parse_decimal(data["rent_amount"], "rent_amount")
    if "deposit_amount" in data:
        lease.deposit_amount = parse_decimal(data["deposit_amount"], "deposit_amount")
    if data.get("rent_due_day"):
        lease.rent_due_day = int(data["rent_due_day"])
    if "terms" in data:
        lease.terms = data["terms"]
    if "status" in data:
        lease.status = data["status"]
        # Free the property back up when a lease is no longer running.
        lease.property.status = "occupied" if lease.status == "active" else "available"

    log_activity("updated", "lease", lease.id, f"Lease updated: {lease.lease_code}")
    db.session.commit()
    return jsonify(lease.to_dict())


@bp.post("/<int:lease_id>/renew")
@staff_required
def renew_lease(lease_id):
    """Extend a lease by a number of months and top up its rent schedule."""
    lease = Lease.query.get_or_404(lease_id)
    data = request.get_json(silent=True) or {}
    months = int(data.get("months") or 12)
    if not 1 <= months <= 60:
        return field_errors({"months": "Choose between 1 and 60 months"})

    lease.end_date = lease.end_date + timedelta(days=months * 30)
    lease.status = "active"
    lease.property.status = "occupied"
    if data.get("rent_amount") not in (None, ""):
        lease.rent_amount = parse_decimal(data["rent_amount"], "rent_amount")

    created = generate_schedule(lease)
    log_activity("updated", "lease", lease.id, f"Lease renewed by {months} months: {lease.lease_code}")
    db.session.commit()
    return jsonify({"lease": lease.to_dict(), "invoices_created": len(created)})


@bp.post("/<int:lease_id>/schedule")
@staff_required
def regenerate_schedule(lease_id):
    lease = Lease.query.get_or_404(lease_id)
    created = generate_schedule(lease)
    db.session.commit()
    return jsonify({"message": f"{len(created)} invoice(s) generated", "count": len(created)})


@bp.delete("/<int:lease_id>")
@staff_required
def delete_lease(lease_id):
    lease = Lease.query.get_or_404(lease_id)
    prop = lease.property
    code = lease.lease_code
    db.session.delete(lease)
    db.session.flush()
    if prop and not prop.active_lease:
        prop.status = "available"
    log_activity("deleted", "lease", lease_id, f"Lease deleted: {code}")
    db.session.commit()
    return jsonify({"message": "Lease deleted"})
