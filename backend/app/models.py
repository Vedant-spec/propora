import secrets
from datetime import date, datetime, timedelta

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db

ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_TENANT = "tenant"
STAFF_ROLES = (ROLE_ADMIN, ROLE_MANAGER)

# Maintenance workflow: open → assigned → in_progress → completed → closed
MAINTENANCE_FLOW = ("open", "assigned", "in_progress", "completed", "closed")
MAINTENANCE_OPEN = ("open", "assigned", "in_progress")

EXPIRING_WINDOW_DAYS = 60


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30))
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default=ROLE_TENANT)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    # Preferences (drive the Settings screens)
    theme = db.Column(db.String(10), nullable=False, default="system")
    density = db.Column(db.String(10), nullable=False, default="comfortable")
    notify_email = db.Column(db.Boolean, nullable=False, default=True)
    notify_rent = db.Column(db.Boolean, nullable=False, default=True)
    notify_maintenance = db.Column(db.Boolean, nullable=False, default=True)
    notify_lease = db.Column(db.Boolean, nullable=False, default=True)

    # Security
    token_version = db.Column(db.Integer, nullable=False, default=0)
    last_login_at = db.Column(db.DateTime)
    password_changed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tenant_profile = db.relationship(
        "Tenant", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    def set_password(self, raw: str) -> None:
        self.password_hash = generate_password_hash(raw)
        self.password_changed_at = datetime.utcnow()

    def check_password(self, raw: str) -> bool:
        return check_password_hash(self.password_hash, raw)

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "is_active": self.is_active,
            "theme": self.theme,
            "density": self.density,
            "notify_email": self.notify_email,
            "notify_rent": self.notify_rent,
            "notify_maintenance": self.notify_maintenance,
            "notify_lease": self.notify_lease,
            "tenant_id": self.tenant_profile.id if self.tenant_profile else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "password_changed_at": (
                self.password_changed_at.isoformat() if self.password_changed_at else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Property(db.Model):
    __tablename__ = "properties"

    id = db.Column(db.Integer, primary_key=True)
    property_code = db.Column(db.String(30), unique=True, index=True)
    name = db.Column(db.String(160), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(80))
    state = db.Column(db.String(80))
    zip_code = db.Column(db.String(20))
    property_type = db.Column(db.String(30), nullable=False, default="residential")
    unit_label = db.Column(db.String(40))
    floor = db.Column(db.String(20))
    furnishing = db.Column(db.String(30), default="unfurnished")
    bedrooms = db.Column(db.Integer, default=0)
    bathrooms = db.Column(db.Integer, default=0)
    area_sqft = db.Column(db.Integer, default=0)
    rent_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    security_deposit = db.Column(db.Numeric(12, 2), default=0)
    maintenance_charge = db.Column(db.Numeric(12, 2), default=0)
    status = db.Column(db.String(20), nullable=False, default="available")
    description = db.Column(db.Text)
    manager_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    manager = db.relationship("User", foreign_keys=[manager_id])
    leases = db.relationship("Lease", back_populates="property", cascade="all, delete-orphan")
    maintenance_requests = db.relationship(
        "MaintenanceRequest", back_populates="property", cascade="all, delete-orphan"
    )

    @property
    def active_lease(self):
        return next((l for l in self.leases if l.status == "active"), None)

    def to_dict(self, deep=False):
        lease = self.active_lease
        data = {
            "id": self.id,
            "property_code": self.property_code or f"PR-{self.id:04d}",
            "name": self.name,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "zip_code": self.zip_code,
            "property_type": self.property_type,
            "unit_label": self.unit_label,
            "floor": self.floor,
            "furnishing": self.furnishing,
            "bedrooms": self.bedrooms,
            "bathrooms": self.bathrooms,
            "area_sqft": self.area_sqft,
            "rent_amount": float(self.rent_amount or 0),
            "security_deposit": float(self.security_deposit or 0),
            "maintenance_charge": float(self.maintenance_charge or 0),
            "status": self.status,
            "description": self.description,
            "manager_id": self.manager_id,
            "manager_name": self.manager.name if self.manager else None,
            "current_tenant": lease.tenant.full_name if lease and lease.tenant else None,
            "current_tenant_id": lease.tenant_id if lease else None,
            "current_lease_id": lease.id if lease else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if deep:
            data["leases"] = [l.to_dict() for l in sorted(
                self.leases, key=lambda l: l.start_date or date.min, reverse=True
            )]
            data["maintenance_requests"] = [
                m.to_dict() for m in sorted(
                    self.maintenance_requests,
                    key=lambda m: m.created_at or datetime.min,
                    reverse=True,
                )
            ]
            data["current_lease"] = lease.to_dict(deep=True) if lease else None
        return data


class Tenant(db.Model):
    __tablename__ = "tenants"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True)
    full_name = db.Column(db.String(160), nullable=False)
    email = db.Column(db.String(160), nullable=False, index=True)
    phone = db.Column(db.String(30))
    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(20))

    # Identification
    id_proof_type = db.Column(db.String(40))
    id_number = db.Column(db.String(60))
    document_name = db.Column(db.String(255))

    occupation = db.Column(db.String(120))
    unit_room = db.Column(db.String(40))

    # Emergency contact
    emergency_name = db.Column(db.String(120))
    emergency_relationship = db.Column(db.String(60))
    emergency_phone = db.Column(db.String(30))

    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="tenant_profile")
    leases = db.relationship("Lease", back_populates="tenant", cascade="all, delete-orphan")
    maintenance_requests = db.relationship("MaintenanceRequest", back_populates="tenant")

    @property
    def active_lease(self):
        return next((l for l in self.leases if l.status == "active"), None)

    def to_dict(self, deep=False):
        lease = self.active_lease
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "gender": self.gender,
            "id_proof_type": self.id_proof_type,
            "id_number": self.id_number,
            "document_name": self.document_name,
            "occupation": self.occupation,
            "unit_room": self.unit_room,
            "emergency_name": self.emergency_name,
            "emergency_relationship": self.emergency_relationship,
            "emergency_phone": self.emergency_phone,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "current_property": lease.property.name if lease and lease.property else None,
            "current_property_id": lease.property_id if lease else None,
            "lease_status": lease.lease_state if lease else "none",
            "has_login": self.user_id is not None,
        }
        if deep:
            data["leases"] = [
                l.to_dict() for l in sorted(
                    self.leases, key=lambda l: l.start_date or date.min, reverse=True
                )
            ]
            data["current_lease"] = lease.to_dict(deep=True) if lease else None
            data["maintenance_requests"] = [
                m.to_dict() for m in sorted(
                    self.maintenance_requests,
                    key=lambda m: m.created_at or datetime.min,
                    reverse=True,
                )
            ]
        return data


class Lease(db.Model):
    __tablename__ = "leases"

    id = db.Column(db.Integer, primary_key=True)
    lease_code = db.Column(db.String(30), index=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id"), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    rent_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    deposit_amount = db.Column(db.Numeric(12, 2), default=0)
    rent_due_day = db.Column(db.Integer, default=5)
    status = db.Column(db.String(20), nullable=False, default="active")
    terms = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def lease_state(self):
        """Display status: active leases near their end date read as 'expiring_soon'."""
        if self.status != "active":
            return self.status
        if self.end_date and self.end_date < date.today():
            return "expired"
        if self.end_date and self.end_date <= date.today() + timedelta(days=EXPIRING_WINDOW_DAYS):
            return "expiring_soon"
        return "active"

    @property
    def days_remaining(self):
        return (self.end_date - date.today()).days if self.end_date else None

    property = db.relationship("Property", back_populates="leases")
    tenant = db.relationship("Tenant", back_populates="leases")
    payments = db.relationship("Payment", back_populates="lease", cascade="all, delete-orphan")

    def to_dict(self, deep=False):
        data = {
            "id": self.id,
            "lease_code": self.lease_code or f"LS-{self.id:04d}",
            "property_id": self.property_id,
            "property_name": self.property.name if self.property else None,
            "property_address": self.property.address if self.property else None,
            "property_code": self.property.property_code if self.property else None,
            "tenant_id": self.tenant_id,
            "tenant_name": self.tenant.full_name if self.tenant else None,
            "tenant_email": self.tenant.email if self.tenant else None,
            "tenant_phone": self.tenant.phone if self.tenant else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "rent_amount": float(self.rent_amount or 0),
            "deposit_amount": float(self.deposit_amount or 0),
            "rent_due_day": self.rent_due_day,
            "status": self.status,
            "lease_state": self.lease_state,
            "days_remaining": self.days_remaining,
            "terms": self.terms,
        }
        if deep:
            payments = sorted(self.payments, key=lambda p: p.due_date or date.min, reverse=True)
            data["payments"] = [p.to_dict() for p in payments]
            billed = sum(float(p.amount or 0) for p in payments)
            paid = sum(float(p.amount_paid or 0) for p in payments)
            data["totals"] = {"billed": billed, "collected": paid, "outstanding": billed - paid}
        return data


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    payment_code = db.Column(db.String(30), index=True)
    lease_id = db.Column(db.Integer, db.ForeignKey("leases.id"), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    amount_paid = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    due_date = db.Column(db.Date, nullable=False)
    paid_date = db.Column(db.Date)
    period = db.Column(db.String(20))  # e.g. "2026-08"
    method = db.Column(db.String(30))
    reference = db.Column(db.String(80))
    status = db.Column(db.String(20), nullable=False, default="pending")
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    lease = db.relationship("Lease", back_populates="payments")

    def refresh_status(self):
        """Derive status from amounts and due date — never set by hand."""
        due = float(self.amount or 0)
        paid = float(self.amount_paid or 0)
        if due > 0 and paid >= due:
            self.status = "paid"
        elif 0 < paid < due:
            self.status = "partial"
        elif self.due_date and self.due_date < date.today():
            self.status = "overdue"
        else:
            self.status = "pending"
        return self.status

    @property
    def days_overdue(self):
        if self.status in ("paid",) or not self.due_date:
            return 0
        delta = (date.today() - self.due_date).days
        return max(delta, 0)

    def to_dict(self):
        lease = self.lease
        return {
            "id": self.id,
            "payment_code": self.payment_code or f"PY-{self.id:05d}",
            "lease_id": self.lease_id,
            "lease_code": lease.lease_code if lease else None,
            "tenant_id": lease.tenant_id if lease else None,
            "tenant_name": lease.tenant.full_name if lease and lease.tenant else None,
            "tenant_email": lease.tenant.email if lease and lease.tenant else None,
            "tenant_phone": lease.tenant.phone if lease and lease.tenant else None,
            "property_id": lease.property_id if lease else None,
            "property_name": lease.property.name if lease and lease.property else None,
            "property_address": lease.property.address if lease and lease.property else None,
            "amount": float(self.amount or 0),
            "amount_paid": float(self.amount_paid or 0),
            "balance": float(self.amount or 0) - float(self.amount_paid or 0),
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "paid_date": self.paid_date.isoformat() if self.paid_date else None,
            "period": self.period,
            "method": self.method,
            "reference": self.reference,
            "status": self.status,
            "days_overdue": self.days_overdue,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class MaintenanceRequest(db.Model):
    __tablename__ = "maintenance_requests"

    id = db.Column(db.Integer, primary_key=True)
    ticket_code = db.Column(db.String(30), index=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id"), nullable=False)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"))
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(40), default="other")
    priority = db.Column(db.String(20), nullable=False, default="medium")
    status = db.Column(db.String(20), nullable=False, default="open")
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"))
    technician_name = db.Column(db.String(120))
    technician_phone = db.Column(db.String(30))
    scheduled_date = db.Column(db.Date)
    cost = db.Column(db.Numeric(12, 2), default=0)
    resolution_notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assigned_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)

    @property
    def is_open(self):
        return self.status in MAINTENANCE_OPEN

    @property
    def age_days(self):
        if not self.created_at:
            return 0
        end = self.completed_at or self.closed_at or datetime.utcnow()
        return max((end - self.created_at).days, 0)

    property = db.relationship("Property", back_populates="maintenance_requests")
    tenant = db.relationship("Tenant", back_populates="maintenance_requests")
    assignee = db.relationship("User", foreign_keys=[assigned_to])

    def to_dict(self):
        return {
            "id": self.id,
            "ticket_code": self.ticket_code or f"MR-{self.id:04d}",
            "property_id": self.property_id,
            "property_name": self.property.name if self.property else None,
            "property_address": self.property.address if self.property else None,
            "tenant_id": self.tenant_id,
            "tenant_name": self.tenant.full_name if self.tenant else None,
            "tenant_phone": self.tenant.phone if self.tenant else None,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "priority": self.priority,
            "status": self.status,
            "assigned_to": self.assigned_to,
            "assignee_name": self.assignee.name if self.assignee else None,
            "technician_name": self.technician_name,
            "technician_phone": self.technician_phone,
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "cost": float(self.cost or 0),
            "resolution_notes": self.resolution_notes,
            "age_days": self.age_days,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    audience = db.Column(db.String(20))  # 'staff' broadcasts to admins + managers
    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.Text)
    kind = db.Column(db.String(30), default="info")  # info | rent | maintenance | lease
    link = db.Column(db.String(120))
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "kind": self.kind,
            "link": self.link,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Activity(db.Model):
    __tablename__ = "activities"

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(40), nullable=False)  # created | updated | deleted | paid …
    entity_type = db.Column(db.String(40), nullable=False)
    entity_id = db.Column(db.Integer)
    summary = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self):
        return {
            "id": self.id,
            "actor_name": self.actor.name if self.actor else "System",
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "summary": self.summary,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")

    @classmethod
    def issue(cls, user, ttl_minutes=30):
        token = cls(
            user_id=user.id,
            token=secrets.token_urlsafe(32),
            expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
        )
        db.session.add(token)
        return token

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > datetime.utcnow()
