import os
import secrets
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROJECT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def _bool(name: str, default: bool = False) -> bool:
    return (os.getenv(name) or str(default)).strip().lower() in ("1", "true", "yes", "on")


def _database_uri() -> str:
    """Build the SQLAlchemy URI.

    Priority: DATABASE_URL (what hosting providers inject) → explicit MySQL vars
    → a local SQLite file so the app runs with no database server installed.
    """
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        # Providers hand out the legacy postgres:// scheme, which SQLAlchemy 2 rejects.
        if explicit.startswith("postgres://"):
            explicit = explicit.replace("postgres://", "postgresql+psycopg://", 1)
        elif explicit.startswith("postgresql://"):
            explicit = explicit.replace("postgresql://", "postgresql+psycopg://", 1)
        elif explicit.startswith("mysql://"):
            explicit = explicit.replace("mysql://", "mysql+pymysql://", 1)
        return explicit

    if os.getenv("DB_ENGINE", "sqlite").lower() == "mysql":
        user = os.getenv("MYSQL_USER", "root")
        password = os.getenv("MYSQL_PASSWORD", "")
        host = os.getenv("MYSQL_HOST", "localhost")
        port = os.getenv("MYSQL_PORT", "3306")
        name = os.getenv("MYSQL_DB", "propora")
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"

    return "sqlite:///" + os.path.join(os.getenv("SQLITE_DIR", BASE_DIR), "propora.db")


def _secret(name: str, fallback: str) -> str:
    value = os.getenv(name)
    if value:
        return value
    if _bool("PRODUCTION"):
        # Never ship a known secret. A random one per boot is safer: worst case
        # everyone is signed out on restart, which is obvious and recoverable.
        return secrets.token_urlsafe(48)
    return fallback


class Config:
    SECRET_KEY = _secret("SECRET_KEY", "propora-dev-secret-change-me-in-production")
    JWT_SECRET_KEY = _secret("JWT_SECRET_KEY", "propora-dev-jwt-secret-change-me-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("SESSION_HOURS", 12)))

    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}

    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 8 MB cap on document uploads

    # Built React app. When present, Flask serves the SPA and the API from one origin.
    STATIC_DIR = os.getenv("STATIC_DIR", os.path.join(PROJECT_DIR, "frontend", "dist"))

    # Public origin, used to build links inside emails. Hosts that inject their
    # own external URL (Render sets RENDER_EXTERNAL_URL) are picked up
    # automatically, so a deployment needs no manual configuration for this.
    APP_BASE_URL = (
        os.getenv("APP_BASE_URL")
        or os.getenv("RENDER_EXTERNAL_URL")
        or os.getenv("RAILWAY_PUBLIC_DOMAIN_URL")
        or (
            "https://" + os.environ["RENDER_EXTERNAL_HOSTNAME"]
            if os.getenv("RENDER_EXTERNAL_HOSTNAME")
            else None
        )
        or "http://localhost:5173"
    ).rstrip("/")

    # In production the SPA is same-origin, so CORS is only needed for local dev.
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]

    # --- Email -------------------------------------------------------------
    MAIL_SERVER = os.getenv("MAIL_SERVER", "")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_USE_TLS = _bool("MAIL_USE_TLS", True)
    MAIL_USE_SSL = _bool("MAIL_USE_SSL", False)
    MAIL_FROM = os.getenv("MAIL_FROM") or os.getenv("MAIL_USERNAME", "no-reply@propora.app")
    MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "PROPORA")
    MAIL_TIMEOUT = int(os.getenv("MAIL_TIMEOUT", 20))

    # --- SMS (phone sign-in codes) ----------------------------------------
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
    SMS_WEBHOOK_URL = os.getenv("SMS_WEBHOOK_URL", "")
    SMS_WEBHOOK_TOKEN = os.getenv("SMS_WEBHOOK_TOKEN", "")

    # With no SMS gateway the code cannot reach anyone, which makes phone
    # sign-in impossible to try. Showing it on screen is then the only way the
    # flow is usable — but it is a demo affordance, so it switches itself off
    # the moment a real gateway is configured, and can be forced off entirely.
    SHOW_OTP_WITHOUT_GATEWAY = _bool("SHOW_OTP_WITHOUT_GATEWAY", True)

    # Public sign-up. Self-registered accounts are always tenants; staff
    # accounts are created by an administrator.
    ALLOW_PUBLIC_SIGNUP = _bool("ALLOW_PUBLIC_SIGNUP", True)

    PASSWORD_RESET_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", 30))
    PRODUCTION = _bool("PRODUCTION")
    # An empty database means nobody can sign in, which makes the app
    # unusable. Bootstrap the demo dataset unless explicitly told not to.
    SEED_ON_START = _bool("SEED_ON_START", True)
