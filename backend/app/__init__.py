import logging
import os

from flask import Flask, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import cors, db, jwt, migrate


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    # In production the SPA is served from this same origin, so CORS is only
    # doing anything during local development against the Vite dev server.
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    from .routes import BLUEPRINTS

    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

    @app.get("/api/health")
    def health():
        from .mailer import is_configured
        from .models import Property, User

        engine = app.config["SQLALCHEMY_DATABASE_URI"].split("://")[0]
        try:
            users, properties = User.query.count(), Property.query.count()
        except Exception:  # pragma: no cover - database not reachable
            users = properties = None

        return jsonify(
            {
                "status": "ok",
                "database": engine,
                # SQLite on a container filesystem does not survive a restart.
                "persistent": engine != "sqlite",
                "users": users,
                "properties": properties,
                "email": "configured" if is_configured() else "disabled",
            }
        )

    @jwt.expired_token_loader
    def expired_token(_header, _payload):
        return jsonify({"message": "Session expired, please sign in again"}), 401

    @jwt.invalid_token_loader
    def invalid_token(_reason):
        return jsonify({"message": "Invalid session, please sign in again"}), 401

    @jwt.unauthorized_loader
    def missing_token(_reason):
        return jsonify({"message": "Sign in to continue"}), 401

    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        if exc.code == 404 and not _wants_api(exc):
            return _serve_spa()
        return jsonify({"message": exc.description}), exc.code

    @app.errorhandler(Exception)
    def handle_error(exc):  # pragma: no cover - safety net
        app.logger.exception(exc)
        db.session.rollback()
        return jsonify({"message": "Something went wrong on the server"}), 500

    _register_spa(app)

    with app.app_context():
        db.create_all()
        if app.config["SEED_ON_START"]:
            _seed_if_empty(app)

    return app


def _wants_api(_exc):
    from flask import request

    return request.path.startswith("/api/")


def _serve_spa():
    """Hand any non-API path to index.html so client-side routing works."""
    from flask import current_app

    static_dir = current_app.config["STATIC_DIR"]
    index = os.path.join(static_dir, "index.html")
    if os.path.isfile(index):
        return send_from_directory(static_dir, "index.html")
    return (
        jsonify(
            {
                "message": "Frontend build not found. Run `npm run build` in frontend/, "
                "or set STATIC_DIR to the built assets."
            }
        ),
        404,
    )


def _register_spa(app):
    """Serve the built React app from the same origin as the API."""
    static_dir = app.config["STATIC_DIR"]

    @app.get("/")
    def index():
        return _serve_spa()

    @app.get("/<path:filename>")
    def static_files(filename):
        # An unmatched /api/ path must stay JSON. Without this the catch-all
        # would hand back index.html with a 200, and the client would choke
        # parsing HTML as JSON instead of surfacing a clean error.
        if filename == "api" or filename.startswith("api/"):
            return jsonify({"message": "Not found"}), 404

        candidate = os.path.join(static_dir, filename)
        if os.path.isfile(candidate):
            response = send_from_directory(static_dir, filename)
            # Vite emits content-hashed asset names, so they can cache hard.
            if filename.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response
        return _serve_spa()


def _seed_if_empty(app):
    """First boot on a fresh database: load the demo dataset."""
    from .models import User

    try:
        if User.query.count():
            return
    except Exception:  # pragma: no cover - table may not exist yet
        return

    app.logger.info("Empty database detected — loading the demo dataset…")
    try:
        import seed as seed_module

        seed_module.seed()
        app.logger.info("Demo dataset loaded.")
    except Exception:  # pragma: no cover - seeding must never block boot
        app.logger.exception("Could not load the demo dataset")
