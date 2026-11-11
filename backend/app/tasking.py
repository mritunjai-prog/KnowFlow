"""Idempotent source-linked tasks. A retry must not duplicate or overwrite an edit."""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, TaskRecord, TaskTombstone
from app.security import new_id, utcnow


def apply_extracted_tasks(db: Session, owner_id: str, document: Document, actions: list[dict]) -> int:
    created = 0
    for action in actions:
        fingerprint = action.get("fingerprint")
        description = str(action.get("description") or "").strip()
        if not fingerprint or not description:
            continue
        buried = db.scalar(
            select(TaskTombstone).where(
                TaskTombstone.owner_id == owner_id,
                TaskTombstone.document_id == document.id,
                TaskTombstone.fingerprint == fingerprint,
            )
        )
        if buried is not None:
            continue
        existing = db.scalar(
            select(TaskRecord).where(
                TaskRecord.owner_id == owner_id,
                TaskRecord.document_id == document.id,
                TaskRecord.fingerprint == fingerprint,
            )
        )
        if existing is not None:
            continue
        priority = action.get("priority") if action.get("priority") in {"low", "medium", "high"} else "medium"
        due = action.get("dueDate") if isinstance(action.get("dueDate"), str) else None
        now = utcnow()
        db.add(
            TaskRecord(
                id=new_id(),
                owner_id=owner_id,
                document_id=document.id,
                description=description[:2000],
                status="pending",
                priority=priority,
                due_date=due,
                page=action.get("page") if isinstance(action.get("page"), int) else None,
                excerpt=(action.get("excerpt") or description)[:500],
                meeting_id=document.meeting_id,
                origin="extracted",
                fingerprint=fingerprint,
                user_edited=False,
                created_at=now,
                updated_at=now,
            )
        )
        created += 1
    return created


def reconcile_extracted_tasks(db: Session, owner_id: str, document: Document, actions: list[dict]) -> int:
    """Add new extracted tasks and drop stale unedited ones. User edits and deletions stay."""
    created = apply_extracted_tasks(db, owner_id, document, actions)
    current = {action.get("fingerprint") for action in actions if action.get("fingerprint")}
    rows = db.scalars(
        select(TaskRecord).where(
            TaskRecord.owner_id == owner_id,
            TaskRecord.document_id == document.id,
            TaskRecord.origin == "extracted",
            TaskRecord.user_edited.is_(False),
            TaskRecord.status == "pending",
        )
    ).all()
    for row in rows:
        if row.fingerprint not in current:
            db.delete(row)
    return created


def remember_deletion(db: Session, task: TaskRecord) -> None:
    if not task.fingerprint:
        return
    existing = db.scalar(
        select(TaskTombstone).where(
            TaskTombstone.owner_id == task.owner_id,
            TaskTombstone.document_id == task.document_id,
            TaskTombstone.fingerprint == task.fingerprint,
        )
    )
    if existing is None:
        db.add(
            TaskTombstone(
                id=new_id(),
                owner_id=task.owner_id,
                document_id=task.document_id,
                fingerprint=task.fingerprint,
                created_at=utcnow(),
            )
        )


def stored_actions(raw: str | None) -> list[dict]:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []
