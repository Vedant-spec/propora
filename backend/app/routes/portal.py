from datetime import date

from flask import Blueprint, jsonify

from ..models import MAINTENANCE_OPEN, Payment
from ..utils import current_user, tenant_required

bp = Blueprint("portal", __name__, url_prefix="/api/portal")


def _profile_or_error():
    user = current_user()
    if user.tenant_profile is None:
        return None, (jsonify({"message": "No tenant profile linked to this account"}), 404)
    return user.tenant_profile, None


def _sorted_payments(lease):
    if lease is None:
        return []
    return sorted(lease.payments, key=lambda p: p.due_date or date.min, reverse=True)


@bp.get("/overview")
@tenant_required
def overview():
    profile, error = _profile_or_error()
    if error:
        return error

    lease = profile.active_lease
    payments = _sorted_payments(lease)
    for payment in payments:
        payment.refresh_status()

    today = date.today()
    outstanding = sum(
        float(p.amount or 0) - float(p.amount_paid or 0)
        for p in payments
        if p.status in ("pending", "overdue", "partial") and p.due_date and p.due_date <= today
    )
    next_due = next(
        (
            p
            for p in sorted(payments, key=lambda x: x.due_date or date.max)
            if p.status in ("pending", "overdue", "partial")
        ),
        None,
    )
    open_requests = [m for m in profile.maintenance_requests if m.status in MAINTENANCE_OPEN]

    # "Recent" means the latest invoices already due — not the far end of the
    # generated schedule, which would show next year's pending rows first.
    due_so_far = [p for p in payments if p.due_date and p.due_date <= today]
    recent = (due_so_far or payments)[:5]

    return jsonify(
        {
            "tenant": profile.to_dict(),
            "lease": lease.to_dict() if lease else None,
            "property": lease.property.to_dict() if lease and lease.property else None,
            "stats": {
                "outstanding": round(outstanding, 2),
                "rent_amount": float(lease.rent_amount or 0) if lease else 0,
                "deposit_amount": float(lease.deposit_amount or 0) if lease else 0,
                "next_due_date": next_due.due_date.isoformat() if next_due and next_due.due_date else None,
                "next_due_amount": (
                    float(next_due.amount or 0) - float(next_due.amount_paid or 0)
                ) if next_due else 0,
                "payment_status": next_due.status if next_due else "paid",
                "lease_status": lease.lease_state if lease else "none",
                "days_remaining": lease.days_remaining if lease else None,
                "open_requests": len(open_requests),
                "paid_invoices": sum(1 for p in payments if p.status == "paid"),
                "total_paid": sum(float(p.amount_paid or 0) for p in payments),
            },
            "recent_payments": [p.to_dict() for p in recent],
            "open_requests": [m.to_dict() for m in open_requests[:5]],
            "recent_updates": [
                m.to_dict()
                for m in sorted(
                    profile.maintenance_requests,
                    key=lambda m: m.updated_at or m.created_at,
                    reverse=True,
                )[:5]
            ],
        }
    )


@bp.get("/property")
@tenant_required
def my_property():
    """My Property — the unit the tenant currently occupies."""
    profile, error = _profile_or_error()
    if error:
        return error

    lease = profile.active_lease
    if lease is None or lease.property is None:
        return jsonify({"property": None, "lease": None, "manager": None})

    prop = lease.property
    manager = prop.manager
    return jsonify(
        {
            "property": prop.to_dict(),
            "lease": lease.to_dict(),
            "unit_room": profile.unit_room,
            "manager": {
                "name": manager.name,
                "email": manager.email,
                "phone": manager.phone,
            }
            if manager
            else None,
            "open_requests": [
                m.to_dict()
                for m in profile.maintenance_requests
                if m.status in MAINTENANCE_OPEN
            ],
        }
    )


@bp.get("/lease")
@tenant_required
def lease_detail():
    profile, error = _profile_or_error()
    if error:
        return error
    leases = sorted(profile.leases, key=lambda l: l.start_date or date.min, reverse=True)
    return jsonify([l.to_dict() for l in leases])


@bp.get("/payments")
@tenant_required
def payment_history():
    profile, error = _profile_or_error()
    if error:
        return error
    lease_ids = [l.id for l in profile.leases]
    if not lease_ids:
        return jsonify([])
    payments = (
        Payment.query.filter(Payment.lease_id.in_(lease_ids))
        .order_by(Payment.due_date.desc())
        .all()
    )
    for payment in payments:
        payment.refresh_status()
    return jsonify([p.to_dict() for p in payments])
