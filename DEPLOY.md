# Deploying PROPORA to a public URL

The app is packaged as **one service**: Flask serves both the API and the built
React app, so you get a single URL like `https://propora.onrender.com` that works
whether or not your PC is on.

You need a free account on a hosting provider — I cannot create one for you, so
that part is yours. Everything else is already configured.

---

## Option A — Render (recommended, free, ~10 minutes)

Free tier gives you a public HTTPS URL and a Postgres database. The service sleeps
after 15 minutes idle and takes ~40 seconds to wake on the next visit; that is the
only catch, and it does not lose data.

### 1. Put the code on GitHub

```bash
cd C:/Users/91786/Desktop/propora
git init
git add -A
git commit -m "PROPORA property management portal"
```

Create an empty repo at <https://github.com/new>, then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/propora.git
git branch -M main
git push -u origin main
```

### 2. Deploy the blueprint

1. Sign up at <https://render.com> (GitHub login is easiest).
2. **New → Blueprint**.
3. Pick your `propora` repo. Render reads [`render.yaml`](render.yaml) and offers
   a web service plus a Postgres database.
4. **Apply**. First build takes 5–8 minutes.

### 3. Point the app at its own URL

Once it is live, copy the URL Render gives you, then in the service's
**Environment** tab set:

```
APP_BASE_URL = https://your-app-name.onrender.com
```

Save — it redeploys. This is what password-reset emails link back to.

**That is the link you send your friend.** The demo dataset seeds itself on first
boot, so she can sign in immediately with the accounts in the README.

---

## Option B — Railway

1. <https://railway.app> → **New Project → Deploy from GitHub repo**.
2. Add a Postgres database to the project; Railway injects `DATABASE_URL`.
3. Under **Variables**, set `PRODUCTION=true`, `SEED_ON_START=true`, and
   `APP_BASE_URL` to the generated domain.
4. **Settings → Networking → Generate Domain**.

Railway auto-detects the `Dockerfile`. No sleep on the trial credit.

---

## Option C — Fly.io

```bash
fly launch --no-deploy      # detects the Dockerfile
fly postgres create
fly postgres attach <db-name>
fly secrets set PRODUCTION=true SEED_ON_START=true APP_BASE_URL=https://your-app.fly.dev
fly deploy
```

---

## Turning on password reset emails

Without SMTP the app works fine — the reset screen just cannot deliver the link.
To enable it, add these variables on your host:

| Variable | Gmail example |
| --- | --- |
| `MAIL_SERVER` | `smtp.gmail.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USE_TLS` | `true` |
| `MAIL_USERNAME` | `you@gmail.com` |
| `MAIL_PASSWORD` | your 16-character **App Password** |
| `MAIL_FROM` | `you@gmail.com` |

For Gmail you must create an App Password at
<https://myaccount.google.com/apppasswords> (requires 2-Step Verification).
Your normal Google password will be rejected.

Other providers that work the same way: Brevo (`smtp-relay.brevo.com`), Mailgun
(`smtp.mailgun.org`), SendGrid (`smtp.sendgrid.net`, username literally `apikey`).

Check it took effect: visit `https://your-app/api/health` — it reports
`"email": "configured"` or `"email": "disabled"`.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PRODUCTION` | `false` | Refuses to use the known dev secrets |
| `DATABASE_URL` | — | Postgres/MySQL URL; falls back to SQLite |
| `SECRET_KEY` / `JWT_SECRET_KEY` | random in production | Session signing |
| `APP_BASE_URL` | `http://localhost:5173` | Public URL used in emails |
| `SEED_ON_START` | `false` | Load demo data if the database is empty |
| `SESSION_HOURS` | `12` | How long a sign-in lasts |
| `STATIC_DIR` | `frontend/dist` | Built SPA location |
| `MAIL_*` | — | SMTP, see above |

---

## Before sharing more widely

The seeded accounts use demo passwords. If this is going beyond a friend:

1. Sign in as `admin@propora.app`, go to **User accounts**, and change the
   passwords (or delete the demo users and create your own).
2. Set `SEED_ON_START=false` so a future empty database does not re-seed.
3. Use **Settings → Security → Sign out of all other devices** after changing
   anything sensitive.

---

## Running it locally instead

Nothing here changes local development — `npm run dev` and `python wsgi.py` still
work exactly as before, with the Vite proxy pointing at port 5000.

To preview the production setup locally as one service:

```bash
cd frontend && npm run build
```

```bash
cd backend && SEED_ON_START=true .venv/Scripts/python.exe wsgi.py
```

Then open <http://localhost:5000> — Flask serves the built app and the API together.
