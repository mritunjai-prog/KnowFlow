from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, DocumentGrant, User


def permission_for(db: Session, user: User | None, document: Document) -> str | None:
    """Owner, accepted view/edit, or None. Admin does not bypass document ACL."""
    if user is None:
        return None
    if document.owner_id == user.id:
        return "owner"
    grant = db.scalar(
        select(DocumentGrant).where(
            DocumentGrant.document_id == document.id,
            DocumentGrant.status == "accepted",
            DocumentGrant.grantee_user_id == user.id,
        )
    )
    if grant is None:
        return None
    if grant.permission not in {"view", "edit"}:
        return None
    return grant.permission


def can_read(db: Session, user: User | None, document: Document) -> bool:
    return permission_for(db, user, document) in {"owner", "view", "edit"}


def can_edit(db: Session, user: User | None, document: Document) -> bool:
    return permission_for(db, user, document) in {"owner", "edit"}


def can_manage_grants(db: Session, user: User | None, document: Document) -> bool:
    return permission_for(db, user, document) == "owner"
