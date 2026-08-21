from . import auth, dashboard, leases, maintenance, payments, portal, properties, reports, tenants

BLUEPRINTS = (
    auth.bp,
    dashboard.bp,
    properties.bp,
    tenants.bp,
    leases.bp,
    payments.bp,
    maintenance.bp,
    reports.bp,
    portal.bp,
)
