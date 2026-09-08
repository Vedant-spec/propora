"""Populate the database with a realistic demo dataset.

Usage:  python seed.py [--reset]
"""
import random
import sys
from datetime import date, datetime, timedelta

from app import create_app
from app.extensions import db
from app.models import (
    Activity,
    Lease,
    MaintenanceRequest,
    Notification,
    Payment,
    Property,
    ROLE_ADMIN,
    ROLE_MANAGER,
    ROLE_TENANT,
    Tenant,
    User,
)
from app.routes.leases import generate_schedule

# name, address, city, state, pin, type, unit, floor, furnishing, beds, baths, area, rent
PROPERTIES = [
    ("Riverstone Apartments 4B", "42 Riverstone Ave", "Pune", "MH", "411045", "residential", "4B", "4th", "semi_furnished", 2, 2, 1150, 28000),
    ("Maple Court Villa 12", "12 Maple Court", "Pune", "MH", "411021", "residential", "12", "Ground", "furnished", 3, 3, 2100, 46500),
    ("Harbour View 9A", "9 Harbour Road", "Mumbai", "MH", "400005", "residential", "9A", "9th", "furnished", 1, 1, 620, 34000),
    ("Lakeside Residency 3C", "3 Lakeside Blvd", "Pune", "MH", "411014", "residential", "3C", "3rd", "unfurnished", 2, 2, 980, 24500),
    ("Orchid Heights 21", "21 Orchid Lane", "Bengaluru", "KA", "560034", "residential", "21", "2nd", "semi_furnished", 3, 2, 1650, 52000),
    ("Nexus Business Suite 501", "501 Nexus Tower, MG Road", "Bengaluru", "KA", "560001", "commercial", "501", "5th", "furnished", 0, 2, 3200, 118000),
    ("Trade Hub Unit 7", "7 Trade Hub, Sector 18", "Noida", "UP", "201301", "commercial", "7", "1st", "unfurnished", 0, 1, 1400, 62000),
    ("Willow Park 6D", "6 Willow Park", "Pune", "MH", "411038", "residential", "6D", "6th", "semi_furnished", 2, 1, 900, 21000),
    ("Corner Retail Shop 2", "2 Market Street", "Pune", "MH", "411002", "commercial", "2", "Ground", "unfurnished", 0, 1, 480, 38000),
    ("Skyline Loft 15", "15 Skyline Residences", "Mumbai", "MH", "400076", "residential", "15", "15th", "furnished", 2, 2, 1080, 58000),
    ("Banyan Grove 8A", "8 Banyan Grove", "Bengaluru", "KA", "560076", "residential", "8A", "8th", "semi_furnished", 2, 2, 1240, 41000),
    ("Metro Plaza Office 302", "302 Metro Plaza", "Noida", "UP", "201309", "commercial", "302", "3rd", "furnished", 0, 2, 2200, 88000),
]

# name, email, phone, occupation, gender, dob, id type, id number
TENANTS = [
    ("Aarav Sharma", "aarav.sharma@example.com", "+91 98200 41122", "Software Engineer", "male", "1993-04-18", "Aadhaar", "4821 7736 9014"),
    ("Diya Patel", "diya.patel@example.com", "+91 98200 55310", "Architect", "female", "1990-11-02", "Aadhaar", "6134 8890 2245"),
    ("Rohan Mehta", "rohan.mehta@example.com", "+91 99300 71204", "Chartered Accountant", "male", "1988-07-25", "PAN", "AKJPM4471C"),
    ("Ishita Nair", "ishita.nair@example.com", "+91 90040 88213", "Doctor", "female", "1995-01-30", "Aadhaar", "7729 3345 8890"),
    ("Kabir Singh", "kabir.singh@example.com", "+91 97400 12098", "Product Designer", "male", "1992-09-14", "Passport", "M4471820"),
    ("Ananya Rao", "ananya.rao@example.com", "+91 98860 33441", "Marketing Lead", "female", "1991-03-08", "Aadhaar", "3390 1123 7756"),
    ("Vikram Desai", "vikram.desai@example.com", "+91 99870 20456", "Restaurateur", "male", "1985-12-11", "PAN", "BXQPD9923K"),
    ("Meera Joshi", "meera.joshi@example.com", "+91 98191 44502", "Data Analyst", "female", "1996-06-21", "Aadhaar", "8812 4467 3301"),
]

EMERGENCY = [
    ("Sunita Sharma", "Mother", "+91 98200 41100"),
    ("Nikhil Patel", "Spouse", "+91 98200 55300"),
    ("Priya Mehta", "Sister", "+91 99300 71200"),
    ("Rajan Nair", "Father", "+91 90040 88200"),
    ("Harleen Singh", "Spouse", "+91 97400 12000"),
    ("Suresh Rao", "Father", "+91 98860 33400"),
    ("Nisha Desai", "Spouse", "+91 99870 20400"),
    ("Anil Joshi", "Father", "+91 98191 44500"),
]

# title, category, priority, description
TICKETS = [
    ("Kitchen tap is leaking", "plumbing", "high", "Water pooling under the sink since Monday morning."),
    ("Bedroom AC not cooling", "hvac", "medium", "Blows air but no cooling. Filter was cleaned last month."),
    ("Main door lock jammed", "security", "urgent", "Key turns but the latch does not retract fully."),
    ("Balcony light fused", "electrical", "low", "Bulb replaced twice, fuses again within a day."),
    ("Seepage on living room wall", "other", "high", "Damp patch spreading near the window frame."),
    ("Lift making grinding noise", "other", "medium", "Noticeable between floors 3 and 5."),
    ("Geyser tripping the MCB", "electrical", "urgent", "Trips the whole bathroom circuit when switched on."),
    ("Broken window latch", "other", "low", "Second bedroom window will not stay shut."),
    ("Common corridor not cleaned", "cleaning", "low", "Missed for the last four days on our floor."),
    ("Bathroom drain blocked", "plumbing", "high", "Water drains very slowly in the guest bathroom."),
    ("CCTV camera offline", "security", "medium", "Lobby camera shows no feed since the power cut."),
    ("Deep clean before move-in", "cleaning", "medium", "Requested ahead of the new tenancy start date."),
]

TECHNICIANS = [
    ("Ramesh Plumbing Works", "+91 98220 11223"),
    ("Sparks Electrical", "+91 98220 44556"),
    ("CoolAir HVAC Services", "+91 98220 77889"),
    ("SecureFix Locksmiths", "+91 98220 33445"),
    ("BrightHome Cleaning", "+91 98220 66778"),
]


def reset():
    db.drop_all()
    db.create_all()


def seed():
    if User.query.count():
        print("Database already has data. Run with --reset to wipe and reseed.")
        return

    random.seed(11)
    today = date.today()

    # ---------------------------------------------------------------- staff
    admin = User(name="Priya Menon", email="admin@propora.app", phone="+91 98111 00001", role=ROLE_ADMIN)
    admin.set_password("admin123")
    admin.phone_verified = True
    manager = User(name="Arjun Kulkarni", email="manager@propora.app", phone="+91 98111 00002", role=ROLE_MANAGER)
    manager.set_password("manager123")
    manager.phone_verified = True
    manager2 = User(name="Sneha Iyer", email="sneha@propora.app", phone="+91 98111 00003", role=ROLE_MANAGER)
    manager2.set_password("manager123")

    db.session.add_all([admin, manager, manager2])
    db.session.flush()
    staff = [manager, manager2]

    # ----------------------------------------------------------- properties
    properties = []
    for index, row in enumerate(PROPERTIES):
        name, addr, city, state, pin, ptype, unit, floor, furnishing, beds, baths, area, rent = row
        prop = Property(
            property_code=f"PR-{index + 1:04d}",
            name=name, address=addr, city=city, state=state, zip_code=pin,
            property_type=ptype, unit_label=unit, floor=floor, furnishing=furnishing,
            bedrooms=beds, bathrooms=baths, area_sqft=area,
            rent_amount=rent, security_deposit=rent * 2, maintenance_charge=round(rent * 0.05),
            status="available", manager_id=staff[index % len(staff)].id,
            description=(
                f"{'Commercial unit' if ptype == 'commercial' else 'Residential unit'} "
                f"{unit} on the {floor} floor at {addr}, {city}."
            ),
        )
        db.session.add(prop)
        properties.append(prop)

    # One unit is deliberately out of service to exercise the third status.
    properties[-1].status = "maintenance"
    db.session.flush()

    # -------------------------------------------------------------- tenants
    tenants = []
    for index, row in enumerate(TENANTS):
        full_name, email, phone, occupation, gender, dob, id_type, id_number = row
        user = User(name=full_name, email=email, phone=phone, role=ROLE_TENANT)
        user.set_password("tenant123")
        user.phone_verified = True
        db.session.add(user)
        db.session.flush()

        emergency_name, relationship, emergency_phone = EMERGENCY[index]
        tenant = Tenant(
            user_id=user.id, full_name=full_name, email=email, phone=phone,
            occupation=occupation, gender=gender,
            date_of_birth=datetime.strptime(dob, "%Y-%m-%d").date(),
            id_proof_type=id_type, id_number=id_number,
            emergency_name=emergency_name, emergency_relationship=relationship,
            emergency_phone=emergency_phone,
        )
        db.session.add(tenant)
        tenants.append(tenant)

    db.session.flush()

    # --------------------------------------------------------------- leases
    # Seven tenanted units, with one lease deliberately close to expiry.
    lease_spans = [330, 300, 270, 240, 200, 150, 120]
    for index, (tenant, prop) in enumerate(zip(tenants[:7], properties[:7])):
        start = (today - timedelta(days=lease_spans[index])).replace(day=1)
        lease = Lease(
            property_id=prop.id, tenant_id=tenant.id,
            start_date=start, end_date=start + timedelta(days=365),
            rent_amount=prop.rent_amount, deposit_amount=prop.security_deposit,
            rent_due_day=5, status="active",
            terms=(
                "Standard 12-month agreement. Two months security deposit, one month notice "
                "period. Society maintenance billed separately. Interior repainting at the "
                "tenant's cost on exit."
            ),
        )
        db.session.add(lease)
        db.session.flush()
        lease.lease_code = f"LS-{lease.id:04d}"
        tenant.unit_room = prop.unit_label
        prop.status = "occupied"
        generate_schedule(lease)

    db.session.flush()

    # ------------------------------------------------------------- payments
    current_period = today.strftime("%Y-%m")
    for payment in Payment.query.all():
        if payment.due_date > today:
            continue  # future rent stays pending
        if payment.period == current_period:
            if random.random() < 0.6:
                payment.amount_paid = payment.amount
                payment.paid_date = payment.due_date - timedelta(days=random.randint(0, 3))
                payment.method = random.choice(["upi", "bank_transfer", "online"])
                payment.reference = f"TXN{random.randint(100000, 999999)}"
        else:
            roll = random.random()
            if roll < 0.86:
                payment.amount_paid = payment.amount
                payment.paid_date = payment.due_date + timedelta(days=random.randint(-2, 4))
                payment.method = random.choice(["upi", "bank_transfer", "cash", "cheque", "online"])
                payment.reference = f"TXN{random.randint(100000, 999999)}"
            elif roll < 0.94:
                payment.amount_paid = round(float(payment.amount) * 0.5, 2)
                payment.paid_date = payment.due_date + timedelta(days=2)
                payment.method = "upi"
                payment.reference = f"TXN{random.randint(100000, 999999)}"
                payment.notes = "Part payment received, balance promised next week."
        payment.refresh_status()

    # ---------------------------------------------------------- maintenance
    statuses = ["open", "assigned", "in_progress", "completed", "closed"]
    leases = Lease.query.order_by(Lease.id).all()
    for index, (title, category, priority, description) in enumerate(TICKETS):
        lease = leases[index % len(leases)]
        status = statuses[index % len(statuses)]
        created = datetime.utcnow() - timedelta(days=random.randint(1, 50), hours=random.randint(0, 20))
        technician, tech_phone = TECHNICIANS[index % len(TECHNICIANS)]

        assigned = status != "open"
        done = status in ("completed", "closed")

        req = MaintenanceRequest(
            property_id=lease.property_id, tenant_id=lease.tenant_id,
            title=title, description=description, category=category, priority=priority,
            status=status, created_at=created, updated_at=created,
            assigned_to=staff[index % len(staff)].id if assigned else None,
            technician_name=technician if assigned else None,
            technician_phone=tech_phone if assigned else None,
            assigned_at=created + timedelta(hours=6) if assigned else None,
            scheduled_date=(created + timedelta(days=2)).date() if assigned else None,
            cost=random.choice([650, 1200, 1850, 2400, 3200]) if done else 0,
            resolution_notes=(
                "Technician attended, part replaced and tested. Tenant confirmed the fix."
            ) if done else None,
            completed_at=created + timedelta(days=random.randint(1, 5)) if done else None,
            closed_at=created + timedelta(days=random.randint(5, 8)) if status == "closed" else None,
        )
        db.session.add(req)
        db.session.flush()
        req.ticket_code = f"MR-{req.id:04d}"

    # ------------------------------------------------------- notifications
    db.session.add_all([
        Notification(
            audience="staff", title="Rent overdue",
            message="Several invoices are past their due date and need chasing.",
            kind="rent", link="/payments",
        ),
        Notification(
            audience="staff", title="Leases expiring soon",
            message="Review agreements ending in the next 60 days.",
            kind="lease", link="/leases",
        ),
        Notification(
            audience="staff", title="Urgent maintenance open",
            message="Urgent tickets are waiting on assignment.",
            kind="maintenance", link="/maintenance",
        ),
    ])
    for tenant in tenants[:3]:
        if tenant.user_id:
            db.session.add(
                Notification(
                    user_id=tenant.user_id, title="Rent due soon",
                    message="Your next rent instalment is due on the 5th.",
                    kind="rent", link="/portal/payments",
                )
            )

    # ------------------------------------------------------------ activity
    seeds = [
        ("created", "property", "Property added: Skyline Loft 15"),
        ("created", "tenant", "Tenant added: Meera Joshi"),
        ("paid", "payment", "Payment recorded from Aarav Sharma"),
        ("updated", "maintenance", "MR-0003 moved to in_progress"),
        ("created", "lease", "Lease created: Ananya Rao at Nexus Business Suite 501"),
        ("paid", "payment", "Payment recorded from Diya Patel"),
        ("updated", "property", "Property updated: Metro Plaza Office 302"),
        ("created", "maintenance", "Request raised: Bathroom drain blocked"),
    ]
    for offset, (action, entity, summary) in enumerate(seeds):
        db.session.add(
            Activity(
                actor_id=(admin if offset % 3 == 0 else manager).id,
                action=action, entity_type=entity, entity_id=offset + 1, summary=summary,
                created_at=datetime.utcnow() - timedelta(hours=offset * 7 + 2),
            )
        )

    db.session.commit()

    print("Seeded successfully.\n")
    print("  Admin    admin@propora.app   / admin123")
    print("  Manager  manager@propora.app / manager123")
    print("  Tenant   aarav.sharma@example.com / tenant123")
    print(
        f"\n  {Property.query.count()} properties, {Tenant.query.count()} tenants, "
        f"{Lease.query.count()} leases, {Payment.query.count()} invoices, "
        f"{MaintenanceRequest.query.count()} maintenance requests, "
        f"{Notification.query.count()} notifications."
    )


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        if "--reset" in sys.argv:
            reset()
        seed()
