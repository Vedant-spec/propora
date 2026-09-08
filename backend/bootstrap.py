"""Prepare the database before the web server starts accepting requests.

Run as its own process ahead of gunicorn. Two reasons it is separate:

* The instance sleeps on free hosting. Seeding inside the request-serving
  process leaves a window where the app is up but empty, and a sign-in during
  that window fails with "invalid email or password".
* Multiple workers each running create_app() would otherwise race to seed the
  same empty database.

Running here means the schema exists and the demo data is committed before any
worker is forked, and the process exits so no database connection is inherited
across the fork.
"""
import sys

from app import create_app
from app.extensions import db


def main() -> int:
    app = create_app()
    with app.app_context():
        from app.models import Property, User

        users, properties = User.query.count(), Property.query.count()
        engine = app.config["SQLALCHEMY_DATABASE_URI"].split("://")[0]
        print(f"[bootstrap] {engine}: {users} users, {properties} properties", flush=True)

        if users == 0:
            print("[bootstrap] database is empty and was not seeded — check SEED_ON_START", flush=True)
            return 1

        # Release the pool so nothing is carried into the forked workers.
        db.engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(main())
