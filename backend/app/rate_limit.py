from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import RateBucket
from app.security import aware, utcnow


def hit(db: Session, settings: Settings, key: str, limit: int | None = None) -> int | None:
    """Increment a windowed counter. Return Retry-After seconds when limited."""
    now = utcnow()
    window = settings.auth_rate_window_seconds
    start = now - timedelta(seconds=window)
    bucket = db.scalar(
        select(RateBucket)
        .where(RateBucket.bucket_key == key, RateBucket.window_start >= start)
        .order_by(RateBucket.window_start.desc())
    )
    if bucket is None or (now - aware(bucket.window_start)).total_seconds() >= window:
        db.add(RateBucket(bucket_key=key, window_start=now, count=1))
        db.flush()
        return None
    cap = settings.auth_rate_limit if limit is None else limit
    if bucket.count >= cap:
        retry = window - int((now - aware(bucket.window_start)).total_seconds())
        return max(1, retry)
    bucket.count += 1
    db.flush()
    return None
