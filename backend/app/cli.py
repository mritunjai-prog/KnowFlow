"""Private Admin provisioning. Not an HTTP endpoint and not a registration field."""

import argparse

from sqlalchemy import select

from app.config import get_settings
from app.db import make_engine, make_session_factory
from app.models import User
from app.security import normalize_email


def promote(email: str) -> int:
    settings = get_settings()
    factory = make_session_factory(make_engine(settings))
    db = factory()
    try:
        user = db.scalar(select(User).where(User.email == normalize_email(email)))
        if user is None or user.email_verified_at is None:
            print("No verified account matches that address.")
            return 1
        user.role = "admin"
        db.commit()
        print("Admin role assigned.")
        return 0
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="KnowFlow private administration")
    sub = parser.add_subparsers(dest="command", required=True)
    promote_cmd = sub.add_parser("promote-admin")
    promote_cmd.add_argument("email")
    args = parser.parse_args()
    if args.command == "promote-admin":
        raise SystemExit(promote(args.email))


if __name__ == "__main__":
    main()
