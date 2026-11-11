"""Explicit study timer. Elapsed time is the sum of confirmed intervals, never a client number."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.acl import can_read
from app.models import Document, StudyIntervalRecord, StudySessionRecord, User
from app.security import aware, new_id, utcnow

LEASE = timedelta(seconds=90)
SAFETY_CAP = timedelta(hours=4)


def now() -> datetime:
    return utcnow()


class StudyDenied(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict[str, str] | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields


def as_utc(value: datetime) -> datetime:
    """Store UTC. SQLite drops the offset and would otherwise keep a local wall time."""
    return aware(value).astimezone(timezone.utc)


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return as_utc(value).isoformat()


def _open_row(db: Session, user_id: str) -> StudySessionRecord | None:
    return db.scalar(
        select(StudySessionRecord).where(
            StudySessionRecord.owner_id == user_id,
            StudySessionRecord.status.in_(("active", "paused")),
        )
    )


def _owned(db: Session, user_id: str, session_id: str) -> StudySessionRecord | None:
    row = db.get(StudySessionRecord, session_id)
    if row is None or row.owner_id != user_id:
        return None
    return row


def _intervals(db: Session, session_id: str) -> list[StudyIntervalRecord]:
    return list(
        db.scalars(
            select(StudyIntervalRecord)
            .where(StudyIntervalRecord.session_id == session_id)
            .order_by(StudyIntervalRecord.started_at.asc(), StudyIntervalRecord.id.asc())
        ).all()
    )


def _open_interval(db: Session, session: StudySessionRecord) -> StudyIntervalRecord | None:
    return db.scalar(
        select(StudyIntervalRecord).where(
            StudyIntervalRecord.session_id == session.id,
            StudyIntervalRecord.closed.is_(False),
        )
    )


def measured_seconds(db: Session, session_id: str) -> int:
    total = timedelta(0)
    for interval in _intervals(db, session_id):
        delta = aware(interval.confirmed_through) - aware(interval.started_at)
        if delta.total_seconds() > 0:
            total += delta
    return int(total.total_seconds())


def _close_open(db: Session, session: StudySessionRecord) -> None:
    interval = _open_interval(db, session)
    if interval is not None:
        interval.closed = True


def _confirm(db: Session, session: StudySessionRecord, moment: datetime) -> None:
    moment = as_utc(moment)
    if moment <= aware(session.confirmed_through):
        return
    interval = _open_interval(db, session)
    if interval is None:
        return
    interval.confirmed_through = moment
    session.confirmed_through = moment


def _open_new(db: Session, session: StudySessionRecord, moment: datetime) -> None:
    moment = as_utc(moment)
    db.add(
        StudyIntervalRecord(
            id=new_id(),
            session_id=session.id,
            started_at=moment,
            confirmed_through=moment,
            closed=False,
        )
    )
    session.confirmed_through = moment


def reconcile(db: Session, session: StudySessionRecord, moment: datetime | None = None) -> None:
    """Pause a missed lease at the last confirmed time. Do not credit the gap."""
    if session.status == "completed":
        return
    moment = as_utc(moment or now())
    if session.status == "active":
        lease = session.lease_expires_at
        if lease is None or aware(lease) < moment:
            _close_open(db, session)
            session.status = "paused"
            session.pause_reason = "connection_lost"
            session.lease_expires_at = None
            session.revision += 1
    if session.status in {"active", "paused"} and moment >= aware(session.started_at) + SAFETY_CAP:
        if session.status == "active":
            _close_open(db, session)
        session.status = "completed"
        session.stopped_at = as_utc(session.confirmed_through)
        session.stop_reason = "safety_cap"
        session.lease_expires_at = None
        session.revision += 1


def reconcile_owner(db: Session, user_id: str) -> None:
    row = _open_row(db, user_id)
    if row is not None:
        reconcile(db, row)


def visible_document_id(db: Session, user: User, document_id: str | None) -> str | None:
    if not document_id:
        return None
    document = db.get(Document, document_id)
    if document is None or not can_read(db, user, document):
        return None
    return document.id


def session_state(db: Session, user: User, session: StudySessionRecord | None, moment: datetime | None = None) -> dict:
    moment = as_utc(moment or now())
    if session is None:
        return {"session": None, "serverTime": iso(moment)}
    db.flush()
    return {
        "session": {
            "id": session.id,
            "status": session.status,
            "startedAt": iso(session.started_at),
            "stoppedAt": iso(session.stopped_at),
            "confirmedThrough": iso(session.confirmed_through),
            "measuredSeconds": measured_seconds(db, session.id),
            "leaseExpiresAt": iso(session.lease_expires_at),
            "pauseReason": session.pause_reason,
            "stopReason": session.stop_reason,
            "documentId": visible_document_id(db, user, session.document_id),
            "revision": session.revision,
        },
        "serverTime": iso(moment),
    }


def current_state(db: Session, user: User) -> dict:
    reconcile_owner(db, user.id)
    return session_state(db, user, _open_row(db, user.id))


def start(db: Session, user: User, document_id: str | None) -> tuple[int, dict]:
    moment = as_utc(now())
    reconcile_owner(db, user.id)
    if _open_row(db, user.id) is not None:
        raise StudyDenied(409, "STUDY_SESSION_OPEN", "You already have an open study session. Stop it before starting another.")
    if document_id:
        document = db.get(Document, document_id)
        if document is None or not can_read(db, user, document):
            raise StudyDenied(404, "NOT_FOUND", "That document is not available.")
    session = StudySessionRecord(
        id=new_id(),
        owner_id=user.id,
        status="active",
        started_at=moment,
        stopped_at=None,
        confirmed_through=moment,
        lease_expires_at=moment + LEASE,
        pause_reason=None,
        stop_reason=None,
        document_id=document_id,
        revision=1,
    )
    db.add(session)
    db.flush()
    _open_new(db, session, moment)
    return 201, session_state(db, user, session, moment)


def heartbeat(db: Session, user: User, session_id: str, revision: int) -> tuple[int, dict]:
    session = _owned(db, user.id, session_id)
    if session is None:
        raise StudyDenied(404, "NOT_FOUND", "That study session is not available.")
    was_completed = session.status == "completed"
    moment = as_utc(now())
    reconcile(db, session, moment)
    if session.status != "active":
        if was_completed:
            raise StudyDenied(409, "STUDY_SESSION_CLOSED", "This study session is already stopped.")
        return 200, session_state(db, user, session, moment)
    if session.revision != revision:
        raise StudyDenied(409, "STALE_REVISION", "This study session changed. Reload the current session and try again.")
    _confirm(db, session, moment)
    session.lease_expires_at = moment + LEASE
    return 200, session_state(db, user, session, moment)


def pause(db: Session, user: User, session_id: str, revision: int) -> tuple[int, dict]:
    session = _owned(db, user.id, session_id)
    if session is None:
        raise StudyDenied(404, "NOT_FOUND", "That study session is not available.")
    moment = as_utc(now())
    reconcile(db, session, moment)
    if session.status == "paused" and session.revision == revision:
        return 200, session_state(db, user, session, moment)
    if session.status != "active":
        raise StudyDenied(409, "STUDY_SESSION_CLOSED", "This study session is already stopped.")
    if session.revision != revision:
        raise StudyDenied(409, "STALE_REVISION", "This study session changed. Reload the current session and try again.")
    _confirm(db, session, moment)
    _close_open(db, session)
    session.status = "paused"
    session.pause_reason = "manual"
    session.lease_expires_at = None
    session.revision += 1
    return 200, session_state(db, user, session, moment)


def resume(db: Session, user: User, session_id: str, revision: int) -> tuple[int, dict]:
    session = _owned(db, user.id, session_id)
    if session is None:
        raise StudyDenied(404, "NOT_FOUND", "That study session is not available.")
    moment = as_utc(now())
    reconcile(db, session, moment)
    if session.status == "active" and session.revision == revision:
        return 200, session_state(db, user, session, moment)
    if session.status != "paused":
        raise StudyDenied(409, "STUDY_SESSION_CLOSED", "This study session is already stopped.")
    if session.revision != revision:
        raise StudyDenied(409, "STALE_REVISION", "This study session changed. Reload the current session and try again.")
    _open_new(db, session, moment)
    session.status = "active"
    session.pause_reason = None
    session.lease_expires_at = moment + LEASE
    session.revision += 1
    return 200, session_state(db, user, session, moment)


def stop(db: Session, user: User, session_id: str, revision: int) -> tuple[int, dict]:
    session = _owned(db, user.id, session_id)
    if session is None:
        raise StudyDenied(404, "NOT_FOUND", "That study session is not available.")
    moment = as_utc(now())
    reconcile(db, session, moment)
    if session.status == "completed":
        if session.revision == revision:
            return 200, session_state(db, user, session, moment)
        raise StudyDenied(409, "STALE_REVISION", "This study session changed. Reload the current session and try again.")
    if session.revision != revision:
        raise StudyDenied(409, "STALE_REVISION", "This study session changed. Reload the current session and try again.")
    if session.status == "active":
        _confirm(db, session, moment)
        _close_open(db, session)
    session.status = "completed"
    session.stopped_at = as_utc(moment)
    session.stop_reason = "manual"
    session.lease_expires_at = None
    session.revision += 1
    return 200, session_state(db, user, session, moment)


def remove(db: Session, user: User, session_id: str, revision: int) -> None:
    session = _owned(db, user.id, session_id)
    if session is None:
        raise StudyDenied(404, "NOT_FOUND", "That study session is not available.")
    if session.revision != revision:
        raise StudyDenied(409, "STALE_REVISION", "This study session changed. Reload it and try again.")
    db.delete(session)


def _overlaps(db: Session, session: StudySessionRecord, window_start: datetime, window_end: datetime) -> bool:
    started = aware(session.started_at)
    if window_start <= started < window_end:
        return True
    for interval in _intervals(db, session.id):
        start = aware(interval.started_at)
        end = aware(interval.confirmed_through)
        if end <= start:
            continue
        if start < window_end and end > window_start:
            return True
    return False


def history(
    db: Session,
    user: User,
    window: tuple[datetime, datetime] | None,
    page: int,
    page_size: int,
) -> dict:
    reconcile_owner(db, user.id)
    rows = list(
        db.scalars(
            select(StudySessionRecord)
            .where(StudySessionRecord.owner_id == user.id)
            .order_by(StudySessionRecord.started_at.desc(), StudySessionRecord.id.desc())
        ).all()
    )
    if window is not None:
        rows = [row for row in rows if _overlaps(db, row, window[0], window[1])]
    total = len(rows)
    selected = rows[(page - 1) * page_size : page * page_size]
    return {
        "items": [session_state(db, user, row)["session"] for row in selected],
        "total": total,
        "page": page,
        "pageSize": page_size,
    }
