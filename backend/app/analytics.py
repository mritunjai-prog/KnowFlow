"""Personal counts from persisted rows. Study time comes only from confirmed timer intervals."""

import json
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.acl import can_read
from app import study
from app.models import Document, DocumentGrant, StudyIntervalRecord, StudySessionRecord, TaskRecord, TaskStatusEvent, User

UNMEASURED = (
    "Study time is not measured for this period. "
    "It is recorded only by an explicit Start, Pause, Resume, and Stop timer. "
    "Page views and document counts are not study time."
)


def measured_definition(zone_name: str) -> str:
    return (
        "Recorded study time — user-started timer. "
        f"Minutes are confirmed server intervals in this period, split on {zone_name} day boundaries, "
        "and rounded once to one decimal. A missed heartbeat is not counted. "
        "This is not attention or mastery."
    )


def parse_zone(name: str) -> ZoneInfo | None:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return None


def local_date(value: datetime, zone: ZoneInfo):
    return study_aware(value).astimezone(zone).date()


def study_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def window_for(start, end, zone: ZoneInfo) -> tuple[datetime, datetime]:
    opening = datetime.combine(start, time.min, zone).astimezone(timezone.utc)
    closing = datetime.combine(end + timedelta(days=1), time.min, zone).astimezone(timezone.utc)
    return opening, closing


def minutes_from_seconds(seconds: int) -> float:
    return float((Decimal(seconds) / Decimal(60)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def topic_labels(raw: str | None) -> list[str]:
    try:
        parsed = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    labels: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            continue
        label = item.strip()
        if label and label not in labels:
            labels.append(label)
    return labels


def _readable_documents(db: Session, user: User) -> list[Document]:
    shared = select(DocumentGrant.document_id).where(
        DocumentGrant.grantee_user_id == user.id,
        DocumentGrant.status == "accepted",
    )
    rows = db.scalars(select(Document).where(or_(Document.owner_id == user.id, Document.id.in_(shared)))).all()
    return [row for row in rows if can_read(db, user, row)]


def _latest_completion(events: list[TaskStatusEvent]) -> datetime | None:
    if not events:
        return None
    latest = max(events, key=lambda event: (event.seq, event.id))
    if latest.kind != "completed":
        return None
    return study_aware(latest.occurred_at)


def _confirmed_seconds(db: Session, user_id: str, opening: datetime, closing: datetime) -> int:
    sessions = db.scalars(select(StudySessionRecord.id).where(StudySessionRecord.owner_id == user_id)).all()
    if not sessions:
        return 0
    intervals = db.scalars(select(StudyIntervalRecord).where(StudyIntervalRecord.session_id.in_(sessions))).all()
    total = timedelta(0)
    for interval in intervals:
        start = study_aware(interval.started_at)
        end = study_aware(interval.confirmed_through)
        lo = max(start, opening)
        hi = min(end, closing)
        if hi > lo:
            total += hi - lo
    return int(total.total_seconds())


def aggregate(db: Session, user: User, days: int, zone_name: str) -> dict:
    zone = parse_zone(zone_name)
    if zone is None:
        raise ValueError(zone_name)
    study.reconcile_owner(db, user.id)
    today = study_aware(study.now()).astimezone(zone).date()
    start = today - timedelta(days=days - 1)
    end = today
    opening, closing = window_for(start, end, zone)

    owned = db.scalars(select(Document).where(Document.owner_id == user.id)).all()
    documents_by_day: dict = {}
    for document in owned:
        day = local_date(document.created_at, zone)
        if start <= day <= end:
            documents_by_day[day] = documents_by_day.get(day, 0) + 1

    tasks = db.scalars(select(TaskRecord).where(TaskRecord.owner_id == user.id)).all()
    events = db.scalars(select(TaskStatusEvent).where(TaskStatusEvent.owner_id == user.id)).all()
    by_task: dict[str, list[TaskStatusEvent]] = {}
    for event in events:
        by_task.setdefault(event.task_id, []).append(event)
    pending = 0
    completed = 0
    completions_by_day: dict = {}
    for task in tasks:
        document = db.get(Document, task.document_id)
        if document is None or not can_read(db, user, document):
            continue
        if task.status == "completed":
            completed += 1
            instant = _latest_completion(by_task.get(task.id, []))
            if instant is not None:
                day = local_date(instant, zone)
                if start <= day <= end:
                    completions_by_day[day] = completions_by_day.get(day, 0) + 1
        else:
            pending += 1

    activity = []
    for day in sorted(set(documents_by_day) | set(completions_by_day)):
        documents = documents_by_day.get(day, 0)
        task_count = completions_by_day.get(day, 0)
        if documents or task_count:
            activity.append({"date": day.isoformat(), "documents": documents, "completedTasks": task_count})

    coverage: dict[str, int] = {}
    for document in _readable_documents(db, user):
        for label in topic_labels(document.tags):
            coverage[label] = coverage.get(label, 0) + 1
    topics = [{"topic": label, "count": count} for label, count in sorted(coverage.items(), key=lambda item: (-item[1], item[0]))]

    seconds = _confirmed_seconds(db, user.id, opening, closing)
    measured = seconds > 0
    return {
        "documentCount": len(owned),
        "pendingTaskCount": pending,
        "completedTaskCount": completed,
        "studyMinutes": minutes_from_seconds(seconds) if measured else None,
        "studyTimeDefinition": measured_definition(zone_name) if measured else UNMEASURED,
        "topicCoverage": topics,
        "activity": activity,
        "period": {"from": start.isoformat(), "to": end.isoformat()},
    }
