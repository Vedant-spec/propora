from datetime import date

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Lease, Payment, Property, Tenant
from ..utils import (
    field_errors,
    log_activity,
    notify,
    parse_date,
    parse_decimal,
    staff_required,
)

bp = Blueprint("payments", __name__, url_prefix="/api/payments")

METHODS = ("upi", "bank_transfer", "cash", "cheque", "online")
UNSETTLED = ("pending", "overdue", "partial")


def refresh_overdue():
    """Flip pending invoices past their due date to overdue."""
    stale = Payment.query.filter(
        Payment.status == "pending", Payment.due_date < date.today()
    ).all()
    for payment in stale:
        payment.refresh_status()
    if stale:
        db.session.commit()


def _filtered(args):
    query = Payment.query.join(Lease)

    status = args.get("status")
    if status == "unsettled":
        query = query.filter(Payment.status.in_(UNSETTLED))
    elif status and status != "all":
        query = query.filter(Payment.status == status)

    if args.get("lease_id"):
        query = query.filter(Payment.lease_id == int(args["lease_id"]))
    if args.get("tenant_id"):
        query = query.filter(Lease.tenant_id == int(args["tenant_id"]))
    if args.get("property_id"):
        query = query.filter(Lease.property_id == int(args["property_id"]))
    if args.get("period"):
        query = query.filter(Payment.period == args["period"])
    if args.get("method") and args["method"] != "all":
        query = query.filter(Payment.method == args["method"])
    if args.get("start_date"):
        query = query.filter(Payment.due_date >= parse_date(args["start_date"], "start_date"))
    if args.get("end_date"):
        query = query.filter(Payment.due_date <= parse_date(args["end_date"], "end_date"))

    search = (args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = (
            query.join(Tenant, Lease.tenant_id == Tenant.id)
            .join(Property, Lease.property_id == Property.id)
            .filter(
                db.or_(
                    Tenant.full_name.ilike(like),
                    Property.name.ilike(like),
                    Payment.reference.ilike(like),
                    Payment.payment_code.ilike(like),
                )
            )
        )

    return query


@bp.get("")
@staff_required
def list_payments():
    refresh_overdue()
    try:
        query = _filtered(request.args)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    items = query.order_by(Payment.due_date.desc()).all()
    return jsonify([p.to_dict() for p in items])


@bp.get("/dashboard")
@staff_required
def dashboard():
    """Payment Dashboard — collection overview across the portfolio."""
    refresh_overdue()
    today = date.today()
    period = today.strftime("%Y-%m")

    def totals(query):
        row = query.with_entities(
            db.func.coalesce(db.func.sum(Payment.amount), 0),
            db.func.coalesce(db.func.sum(Payment.amount_paid), 0),
            db.func.count(Payment.id),
        ).one()
        return {"billed": float(row[0] or 0), "collected": float(row[1] or 0), "count": row[2]}

    this_month = totals(Payment.query.filter(Payment.period == period))
    all_time = totals(Payment.query.filter(Payment.due_date <= today))

    pending = Payment.query.filter(
        Payment.status.in_(("pending", "partial")), Payment.due_date >= today
    ).all()
    overdue = Payment.query.filter(
        Payment.status.in_(UNSETTLED), Payment.due_date < today
    ).order_by(Payment.due_date).all()

    by_method = [
        {"method": method or "unrecorded", "amount": float(amount or 0), "count": count}
        for method, amount, count in db.session.query(
            Payment.method,
            db.func.coalesce(db.func.sum(Payment.amount_paid), 0),
            db.func.count(Payment.id),
        )
        .filter(Payment.amount_paid > 0)
        .group_by(Payment.method)
        .all()
    ]

    status_counts = {
        status: count
        for status, count in db.session.query(Payment.status, db.func.count(Payment.id))
        .group_by(Payment.status)
        .all()
    }

    # Six-month collection trend.
    trend = []
    year, month = today.year, today.month
    keys = []
    for _ in range(6):
        keys.append(date(year, month, 1))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    for first in reversed(keys):
        key = first.strftime("%Y-%m")
        row = totals(Payment.query.filter(Payment.period == key))
        trend.append(
            {
                "period": key,
                "label": first.strftime("%b"),
                "billed": row["billed"],
                "collected": row["collected"],
            }
        )

    collected_all = all_time["collected"]
    billed_all = all_time["billed"]

    return jsonify(
        {
            "stats": {
                "billed_this_month": this_month["billed"],
                "collected_this_month": this_month["collected"],
                "invoices_this_month": this_month["count"],
                "collection_rate": round(collected_all / billed_all * 100, 1) if billed_all else 0.0,
                "pending_amount": sum(float(p.amount or 0) - float(p.amount_paid or 0) for p in pending),
                "pending_count": len(pending),
                "overdue_amount": sum(float(p.amount or 0) - float(p.amount_paid or 0) for p in overdue),
                "overdue_count": len(overdue),
                "paid_count": status_counts.get("paid", 0),
                "partial_count": status_counts.get("partial", 0),
            },
            "trend": trend,
            "by_method": sorted(by_method, key=lambda row: row["amount"], reverse=True),
            "status_counts": status_counts,
            "overdue": [p.to_dict() for p in overdue[:8]],
            "upcoming": [
                p.to_dict()
                for p in sorted(pending, key=lambda p: p.due_date or date.max)[:8]
            ],
        }
    )


@bp.get("/<int:payment_id>")
@staff_required
def get_payment(payment_id):
    payment = Payment.query.get_or_404(payment_id)
    data = payment.to_dict()
    # Sibling invoices give the details screen a mini payment history.
    siblings = (
        Payment.query.filter(Payment.lease_id == payment.lease_id)
        .order_by(Payment.due_date.desc())
        .limit(12)
        .all()
    )
    data["lease_history"] = [p.to_dict() for p in siblings]
    data["lease"] = payment.lease.to_dict() if payment.lease else None
    return jsonify(data)


@bp.post("")
@staff_required
def create_payment():
    data = request.get_json(silent=True) or {}
    errors = {}
    if not data.get("lease_id"):
        errors["lease_id"] = "Choose a lease"
    if not data.get("due_date"):
        errors["due_date"] = "Due date is required"
    try:
        amount = parse_decimal(data.get("amount"), "amount")
        if amount <= 0:
            errors["amount"] = "Enter an amount greater than zero"
    except ValueError:
        errors["amount"] = "Enter a valid number"
    if errors:
        return field_errors(errors)

    try:
        due = parse_date(data["due_date"], "due_date", required=True)
        paid = parse_decimal(data.get("amount_paid"), "amount_paid")
        paid_date = parse_date(data.get("paid_date"), "paid_date")
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    Lease.query.get_or_404(int(data["lease_id"]))

    payment = Payment(
        lease_id=int(data["lease_id"]),
        amount=amount,
        amount_paid=paid,
        due_date=due,
        paid_date=paid_date,
        period=data.get("period") or due.strftime("%Y-%m"),
        method=data.get("method"),
        reference=data.get("reference"),
        notes=data.get("notes"),
    )
    payment.refresh_status()
    db.session.add(payment)
    db.session.flush()
    payment.payment_code = f"PY-{payment.id:05d}"
    log_activity("created", "payment", payment.id, f"Invoice raised: {payment.payment_code}")
    db.session.commit()
    return jsonify(payment.to_dict()), 201


@bp.put("/<int:payment_id>")
@staff_required
def update_payment(payment_id):
    payment = Payment.query.get_or_404(payment_id)
    data = request.get_json(silent=True) or {}
    try:
        if "amount" in data:
            payment.amount = parse_decimal(data["amount"], "amount")
        if "amount_paid" in data:
            payment.amount_paid = parse_decimal(data["amount_paid"], "amount_paid")
        if data.get("due_date"):
            payment.due_date = parse_date(data["due_date"], "due_date")
        if "paid_date" in data:
            payment.paid_date = parse_date(data["paid_date"], "paid_date")
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    for field in ("method", "reference", "notes", "period"):
        if field in data:
            setattr(payment, field, data[field])

    payment.refresh_status()
    log_activity("updated", "payment", payment.id, f"Invoice updated: {payment.payment_code}")
    db.session.commit()
    return jsonify(payment.to_dict())


@bp.post("/<int:payment_id>/record")
@staff_required
def record_payment(payment_id):
    """Record Payment — full or partial settlement of an invoice."""
    payment = Payment.query.get_or_404(payment_id)
    data = request.get_json(silent=True) or {}

    errors = {}
    try:
        amount = parse_decimal(data.get("amount"), "amount", default=float(payment.amount or 0))
        if amount <= 0:
            errors["amount"] = "Enter an amount greater than zero"
        elif amount > float(payment.amount or 0) - float(payment.amount_paid or 0) + 0.01:
            errors["amount"] = "That is more than the outstanding balance"
    except ValueError:
        errors["amount"] = "Enter a valid number"

    if data.get("method") and data["method"] not in METHODS:
        errors["method"] = "Choose a valid payment method"
    if errors:
        return field_errors(errors)

    try:
        paid_date = parse_date(data.get("paid_date"), "paid_date") or date.today()
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    payment.amount_paid = float(payment.amount_paid or 0) + amount
    payment.paid_date = paid_date
    payment.method = data.get("method", payment.method)
    payment.reference = data.get("reference", payment.reference)
    if data.get("notes"):
        payment.notes = data["notes"]
    payment.refresh_status()

    tenant_name = payment.lease.tenant.full_name if payment.lease and payment.lease.tenant else "Tenant"
    log_activity("paid", "payment", payment.id, f"Payment recorded from {tenant_name}")
    if payment.lease and payment.lease.tenant and payment.lease.tenant.user_id:
        notify(
            "Payment received",
            f"We received ₹{amount:,.0f} for {payment.period}. Thank you.",
            kind="rent",
            link="/portal/payments",
            user_id=payment.lease.tenant.user_id,
        )
    db.session.commit()
    return jsonify(payment.to_dict())


@bp.delete("/<int:payment_id>")
@staff_required
def delete_payment(payment_id):
    payment = Payment.query.get_or_404(payment_id)
    code = payment.payment_code
    db.session.delete(payment)
    log_activity("deleted", "payment", payment_id, f"Invoice deleted: {code}")
    db.session.commit()
    return jsonify({"message": "Payment deleted"})
