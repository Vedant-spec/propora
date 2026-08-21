# PROPORA — Smart Property Management & Tenant Portal

A centralised, responsive web portal that replaces paper files and spreadsheets for managing
residential and commercial properties: property records, tenant tracking, lease agreements,
rent collection, maintenance workflow, reports and analytics.

Built to the stack in the project spec: **React frontend · Python Flask backend · MySQL-ready**,
with **light and dark mode** throughout.

---

## Deploy it

To give someone a link that works when your PC is off, see **[DEPLOY.md](DEPLOY.md)** —
the app is packaged as a single service (Flask serves the API *and* the built React app),
with a `Dockerfile` and a Render blueprint ready to go.

## Quick start

Two servers. Open two terminals.

**1. Backend (API on port 5000)**

```bash
cd backend && .venv/Scripts/python.exe wsgi.py
```

**2. Frontend (app on port 5173)**

```bash
cd frontend && npm run dev
```

Then open <http://localhost:5173>.

### First-time setup

```bash
cd backend && python -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt && .venv/Scripts/python.exe seed.py --reset
```

```bash
cd frontend && npm install
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@propora.app` | `admin123` |
| Property manager | `manager@propora.app` | `manager123` |
| Tenant | `aarav.sharma@example.com` | `tenant123` |

Seed data: 12 properties, 8 tenants, 7 leases, 91 rent invoices, 12 maintenance requests and
6 notifications — with a deliberate mix of paid, partial and overdue rent, a lease close to
expiry and tickets at every stage of the workflow, so every screen has real signal.

---

## 🌗 Light and dark mode

Three ways to switch:

- **Header toggle** — the sun/moon button, on every authenticated screen.
- **Settings → Application** — Light / Dark / System, with a live preview card.
- **System** — follows the OS setting and reacts live when it changes.

The choice is saved to `localStorage` *and* to the user's account, so it follows them to
another browser. Implementation lives in [`frontend/src/index.css`](frontend/src/index.css):
every colour is a runtime CSS variable, and the `ink` ramp is **semantic rather than literal** —
`ink-50` is always the page background and `ink-900` is always the strongest text, in both
themes. Switching is a class change on `<html>`, not a re-render, and one set of utility
classes covers both themes.

---

## Screen inventory

Every screen from the Phase 1 scope, and where it lives.

### 🔐 Authentication
| Screen | Route |
| --- | --- |
| Splash / Welcome | `/` |
| Login | `/login` |
| Forgot password | `/forgot-password` |
| Reset password | `/reset-password?token=…` |
| Session expired | `/session-expired` |
| Authentication errors | inline, per field |

### 📊 Admin / Property Manager
| Screen | Route |
| --- | --- |
| Dashboard (+ analytics, recent activity) | `/dashboard` |
| Notifications panel | header bell, every screen |

Dashboard shows total/occupied/vacant properties, total tenants, monthly revenue, pending rent,
overdue rent, maintenance load, occupancy rate, revenue charts, recent payments, recent
maintenance and a live activity feed.

### 🏠 Property Management
| Screen | Route |
| --- | --- |
| Property list (search, filter, sort) | `/properties` |
| Availability tabs (Available / Occupied / Maintenance) | `/properties` |
| Add / Edit property | modal on `/properties` |
| Property details | `/properties/:id` |
| Delete confirmation | modal |

### 👥 Tenant Management
| Screen | Route |
| --- | --- |
| Tenant list | `/tenants` |
| Add / Edit tenant (personal, ID, document upload, emergency contact) | modal |
| Tenant details | `/tenants/:id` |
| Tenant property assignment | modal on `/tenants/:id` |
| Delete confirmation | modal |

### 📄 Lease Management
| Screen | Route |
| --- | --- |
| Lease list | `/leases` |
| Create / Edit lease | modal |
| Lease details (+ renew, rent schedule) | `/leases/:id` |
| Expiry / status tabs | `/leases?status=expiring_soon` |

### 💳 Rent & Payments
| Screen | Route |
| --- | --- |
| Payment dashboard | `/payments/dashboard` |
| Payment list / history | `/payments` |
| Pending / Overdue / Paid / Partial | `/payments?status=…` |
| Record payment | modal |
| Payment details | `/payments/:id` |

### 🔧 Maintenance
| Screen | Route |
| --- | --- |
| Maintenance dashboard | `/maintenance/dashboard` |
| Request list | `/maintenance` |
| Create request | modal |
| Request details (+ timeline, progress) | `/maintenance/:id` |
| Assign request | modal on details |
| Update status | modal on details |
| Maintenance history | `/maintenance/history` |

### 📈 Reports & Analytics
| Screen | Route |
| --- | --- |
| Reports dashboard | `/reports` |
| Generate + filter any report | `/reports/generate` |
| Rent collection / Payment / Property / Tenant / Lease / Maintenance | `?report=…` |
| Export PDF · Excel · CSV · Print | buttons on `/reports/generate` |

### 👤 Tenant Portal
| Screen | Route |
| --- | --- |
| Tenant dashboard | `/portal` |
| My property | `/portal/property` |
| My lease | `/portal/lease` |
| My payment history | `/portal/payments` |
| Raise / track maintenance | `/portal/maintenance` |

### ⚙️ Profile & Settings
| Screen | Route |
| --- | --- |
| Profile (view + edit) | `/profile` |
| Application settings (theme) | `/settings` |
| Security settings (password, sessions) | `/settings/security` |
| Notification settings | `/settings/notifications` |
| User accounts (admin only) | `/users` |

### 🧪 UI / System states
Loading skeletons, empty states, error states with retry, inline form validation, success
toasts, delete confirmations, logout confirmation and the session-expired screen — all in
[`frontend/src/components/ui.tsx`](frontend/src/components/ui.tsx).

### 📱 Responsive
One responsive implementation per screen rather than separate mobile pages: the sidebar
collapses to a drawer under `lg`, stat grids reflow 4 → 2 → 1, forms go single-column, and
wide tables scroll inside their own container so the page body never scrolls sideways.
Verified at 375 px with no horizontal overflow.

---

## Business rules worth knowing

- Creating an active lease marks the property **occupied**; ending it frees the unit.
- A lease optionally generates one rent invoice per month of its term, due on the configured day.
- Invoice status is **derived, never hand-set**: `paid` / `partial` / `overdue` / `pending`.
- **Pending** rent is not yet past due; **overdue** is past the due date. Future scheduled rent
  is never counted as arrears.
- Maintenance follows `open → assigned → in_progress → completed → closed`, and the API refuses
  to complete or close a ticket without resolution notes.
- Tenants only ever see their own lease, invoices and requests — enforced **server-side**, so
  editing a request in the browser gets a 403, not data.
- A property or tenant with an active lease cannot be deleted.
- "Sign out everywhere" bumps a `token_version` carried in the JWT, retiring every older token.
- Password reset emails a single-use link that expires in 30 minutes; requesting a new one
  retires the previous link, and resetting signs out every existing session.
- `/forgot-password` returns the same response whether or not the address exists, so it
  cannot be used to discover which emails have accounts.

---

## Email

Password reset and notification emails go out over SMTP. Set `MAIL_SERVER`, `MAIL_PORT`,
`MAIL_USERNAME`, `MAIL_PASSWORD` and `MAIL_FROM` (see `backend/.env.example`) plus
`APP_BASE_URL` so links point at your public URL.

Leave `MAIL_SERVER` unset and email is simply disabled — the reset link is written to the
server log instead, so the flow stays testable locally. It is never returned to the browser.
Check which mode you are in at `/api/health`.

Emails respect **Settings → Notifications**: the per-topic switches control which alerts get
mirrored to a user's inbox.

## Switching to MySQL

Local development defaults to a SQLite file (`backend/propora.db`) so the app runs with no
database server installed. To use the MySQL target from the spec, copy `backend/.env.example`
to `backend/.env` and set:

```
DB_ENGINE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=yourpassword
MYSQL_DB=propora
```

Create the schema (`CREATE DATABASE propora;`), then run `python seed.py --reset`. No code
changes — SQLAlchemy handles both engines and `PyMySQL` is already installed.

---

## Project layout

```
propora/
├── backend/                  Flask API
│   ├── app/
│   │   ├── __init__.py       app factory, error handlers, JWT setup
│   │   ├── config.py         env config, SQLite/MySQL switch, upload folder
│   │   ├── models.py         User, Property, Tenant, Lease, Payment,
│   │   │                     MaintenanceRequest, Notification, Activity,
│   │   │                     PasswordResetToken
│   │   ├── utils.py          role guards, validation, activity + notify helpers
│   │   └── routes/           auth, dashboard, properties, tenants, leases,
│   │                         payments, maintenance, reports, portal
│   ├── seed.py               demo dataset
│   └── wsgi.py               entry point
├── frontend/                 React + TypeScript + Vite + Tailwind v4
│   └── src/
│       ├── components/       Layout, AuthShell, NotificationsPanel, ui.tsx
│       ├── context/          Auth, Theme, Toast
│       ├── hooks/            useResource
│       ├── lib/              api client, formatters, types
│       └── pages/            one file per screen; portal/ and settings/ subfolders
└── stitch-export/            ← drop your Stitch screens here
```

## Design system

- **Tokens** — [`src/index.css`](frontend/src/index.css): neutral ramp, brand ramp, status
  colours (success / warning / danger / info / accent), surfaces, shadows, all theme-aware.
- **Components** — [`src/components/ui.tsx`](frontend/src/components/ui.tsx): Button (5
  variants), Card, Badge, Input, Select, Textarea, Checkbox, Toggle, SearchBar, Modal,
  ConfirmModal, Table, Pagination, Tabs, Detail grid, StatCard, ProgressSteps, EmptyState,
  ErrorState, Spinner, Skeletons, Alert, PageHeader.
- **Charts** — Recharts, wired to the same CSS variables so they repaint with the theme.

---

## About the UI

The Stitch project could not be read — it needs a signed-in Google session, so those screens
were never available to this build. The interface here is an original design system built from
your written spec.

To swap in your Stitch designs, drop the exported screens into `stitch-export/`
(see the README there). The re-skin is contained: colours and typography live in
`frontend/src/index.css`, and every shared element comes from `frontend/src/components/ui.tsx`.
