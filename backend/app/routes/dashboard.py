from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import (
    Activity,
    Lease,
    MAINTENANCE_OPEN,
    MaintenanceRequest,
    Notification,
    Payment,
    Property,
    Tenant,
)
from ..utils import any_user_required, current_user, staff_required

bp = Blueprint("dashboard", __name__, url_prefix="/api")

UNSETTLED = ("pending", "overdue", "partial")


def _recent_months(count=6):
    today = date.today().replace(day=1)
    keys = []
    year, month = today.year, today.month
    for _ in range(count):
        keys.append(date(year, month, 1))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(keys))


@bp.get("/dashboard")
@staff_required
def summary():
    today = date.today()

    total_properties = Property.query.count()
    occupied = Property.query.filter(Property.status == "occupied").count()
    available = Property.query.filter(Property.status == "available").count()
    under_maintenance = Property.query.filter(Property.status == "maintenance").count()
    total_tenants = Tenant.query.count()

    leases = Lease.query.all()
    active_leases = sum(1 for l in leases if l.status == "active")
    expiring_soon = sum(1 for l in leases if l.lease_state == "expiring_soon")

    period = today.strftime("%Y-%m")
    collected = (
        db.session.query(db.func.coalesce(db.func.sum(Payment.amount_paid), 0))
        .filter(Payment.period == period)
        .scalar()
    )
    billed = (
        db.session.query(db.func.coalesce(db.func.sum(Payment.amount), 0))
        .filter(Payment.period == period)
        .scalar()
    )

    # Pending = due but not yet late. Overdue = past the due date.
    pending_amount = (
        db.session.query(db.func.coalesce(db.func.sum(Payment.amount - Payment.amount_paid), 0))
        .filter(Payment.status.in_(("pending", "partial")), Payment.due_date >= today)
        .scalar()
    )
    overdue_amount = (
        db.session.query(db.func.coalesce(db.func.sum(Payment.amount - Payment.amount_paid), 0))
        .filter(Payment.status.in_(UNSETTLED), Payment.due_date < today)
        .scalar()
    )
    overdue_count = Payment.query.filter(
        Payment.status.in_(UNSETTLED), Payment.due_date < today
    ).count()

    open_maintenance = MaintenanceRequest.query.filter(
        MaintenanceRequest.status.in_(MAINTENANCE_OPEN)
    ).count()
    urgent_maintenance = MaintenanceRequest.query.filter(
        MaintenanceRequest.status.in_(MAINTENANCE_OPEN), MaintenanceRequest.priority == "urgent"
    ).count()

    trend = []
    for first in _recent_months(6):
        key = first.strftime("%Y-%m")
        row = (
            db.session.query(
                db.func.coalesce(db.func.sum(Payment.amount), 0),
                db.func.coalesce(db.func.sum(Payment.amount_paid), 0),
            )
            .filter(Payment.period == key)
            .one()
        )
        trend.append(
            {
                "period": key,
                "label": first.strftime("%b"),
                "billed": float(row[0] or 0),
                "collected": float(row[1] or 0),
            }
        )

    expiring = sorted(
        [l for l in leases if l.lease_state == "expiring_soon"],
        key=lambda l: l.end_date or date.max,
    )[:5]

    return jsonify(
        {
            "stats": {
                "total_properties": total_properties,
                "occupied": occupied,
                "available": available,
                "under_maintenance": under_maintenance,
                "occupancy_rate": round(occupied / total_properties * 100, 1) if total_properties else 0.0,
                "total_tenants": total_tenants,
                "active_leases": active_leases,
                "expiring_soon": expiring_soon,
                "monthly_revenue": float(collected or 0),
                "billed_this_month": float(billed or 0),
                "pending_rent": float(pending_amount or 0),
                "overdue_rent": float(overdue_amount or 0),
                "overdue_count": overdue_count,
                "open_maintenance": open_maintenance,
                "urgent_maintenance": urgent_maintenance,
                "monthly_rent_roll": sum(
                    float(l.rent_amount or 0) for l in leases if l.status == "active"
                ),
            },
            "trend": trend,
            "occupancy": [
                {"name": "Occupied", "value": occupied},
                {"name": "Available", "value": available},
                {"name": "Maintenance", "value": under_maintenance},
            ],
            "expiring_leases": [l.to_dict() for l in expiring],
            "recent_maintenance": [
                m.to_dict()
                for m in MaintenanceRequest.query.order_by(MaintenanceRequest.created_at.desc())
                .limit(5)
                .all()
            ],
            "recent_payments": [
                p.to_dict()
                for p in Payment.query.filter(Payment.status == "paid")
                .order_by(Payment.paid_date.desc())
                .limit(5)
                .all()
            ],
        }
    )


@bp.get("/activity")
@staff_required
def activity_feed():
    """Recent Activity — payments, tenants and maintenance events."""
    limit = min(int(request.args.get("limit", 30)), 100)
    query = Activity.query
    entity = request.args.get("entity")
    if entity and entity != "all":
        query = query.filter(Activity.entity_type == entity)
    items = query.order_by(Activity.created_at.desc()).limit(limit).all()
    return jsonify([a.to_dict() for a in items])


# --------------------------------------------------------------------------
# Notifications
# --------------------------------------------------------------------------


def _notification_query(user):
    scope = [Notification.user_id == user.id]
    if user.is_staff:
        scope.append(Notification.audience == "staff")
    return Notification.query.filter(db.or_(*scope))


@bp.get("/notifications")
@any_user_required
def list_notifications():
    user = current_user()
    query = _notification_query(user)
    if request.args.get("unread") == "true":
        query = query.filter(Notification.is_read.is_(False))
    items = query.order_by(Notification.created_at.desc()).limit(50).all()
    unread = _notification_query(user).filter(Notification.is_read.is_(False)).count()
    return jsonify({"items": [n.to_dict() for n in items], "unread": unread})


@bp.post("/notifications/<int:notification_id>/read")
@any_user_required
def mark_read(notification_id):
    user = current_user()
    note = _notification_query(user).filter(Notification.id == notification_id).first()
    if note is None:
        return jsonify({"message": "Notification not found"}), 404
    note.is_read = True
    db.session.commit()
    return jsonify(note.to_dict())


@bp.post("/notifications/read-all")
@any_user_required
def mark_all_read():
    user = current_user()
    updated = 0
    for note in _notification_query(user).filter(Notification.is_read.is_(False)).all():
        note.is_read = True
        updated += 1
    db.session.commit()
    return jsonify({"message": f"{updated} notification(s) marked as read", "count": updated})


@bp.delete("/notifications/<int:notification_id>")
@any_user_required
def delete_notification(notification_id):
    user = current_user()
    note = _notification_query(user).filter(Notification.id == notification_id).first()
    if note is None:
        return jsonify({"message": "Notification not found"}), 404
    db.session.delete(note)
    db.session.commit()
    return jsonify({"message": "Notification dismissed"})
