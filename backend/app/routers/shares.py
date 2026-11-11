"""Selected-document grants. A share is not a workspace, a meeting, or a task list."""

from datetime import timedelta

from fastapi import APIRouter, Request, Response
from sqlalchemy import select

from app.acl import can_manage_grants, can_read
from app.deps import mutation_actor, reader
from app.errors import error_response
from app.identity import find_user_by_email
from app.models import Document, DocumentGrant, User
from app.schemas import InvitationListOut, InvitationOut, ShareIn, ShareListOut, ShareOut, SharePatchIn
from app.security import aware, new_id, normalize_email, utcnow

router = APIRouter()
INVITATION_TTL = timedelta(days=7)


def _expired(grant: DocumentGrant) -> bool:
    if grant.status != "pending" or grant.expires_at is None:
        return False
    return aware(grant.expires_at) <= utcnow()


def _live(grant: DocumentGrant) -> bool:
    if grant.status == "accepted":
        return True
    return grant.status == "pending" and not _expired(grant)


def _share_out(grant: DocumentGrant) -> ShareOut:
    return ShareOut(id=grant.id, email=grant.grantee_email, permission=grant.permission, status=grant.status)


def _invitation_out(db, grant: DocumentGrant) -> InvitationOut | None:
    document = db.get(Document, grant.document_id)
    owner = db.get(User, document.owner_id) if document else None
    if document is None or owner is None or grant.permission not in {"view", "edit"}:
        return None
    status = grant.status if grant.status in {"pending", "accepted", "declined"} else None
    if status is None:
        return None
    return InvitationOut(
        id=grant.id,
        documentId=document.id,
        documentTitle=document.title,
        ownerName=owner.name,
        permission=grant.permission,
        status=status,
    )


def _owner_document(request: Request, document_id: str):
    actor, denied = mutation_actor(request) if request.method != "GET" else reader(request)
    if denied:
        return None, None, denied
    document = request.state.db.get(Document, document_id)
    if document is None or not can_read(request.state.db, actor.user, document):
        return None, None, error_response(404, "NOT_FOUND", "That document is not available.", request)
    if not can_manage_grants(request.state.db, actor.user, document):
        return None, None, error_response(403, "FORBIDDEN", "Only the owner can manage access to this document.", request)
    return actor, document, None


def _for_recipient(db, user: User, invitation_id: str) -> DocumentGrant | None:
    grant = db.get(DocumentGrant, invitation_id)
    if grant is None or normalize_email(grant.grantee_email) != normalize_email(user.email):
        return None
    if grant.grantee_user_id and grant.grantee_user_id != user.id:
        return None
    return grant


@router.get("/documents/{document_id}/shares")
def list_shares(document_id: str, request: Request):
    _actor, document, denied = _owner_document(request, document_id)
    if denied:
        return denied
    rows = request.state.db.scalars(
        select(DocumentGrant)
        .where(DocumentGrant.document_id == document.id, DocumentGrant.status.in_(("pending", "accepted")))
        .order_by(DocumentGrant.created_at.asc(), DocumentGrant.id.asc())
    ).all()
    return ShareListOut(items=[_share_out(row) for row in rows if _live(row)])


@router.post("/documents/{document_id}/shares", status_code=201)
def create_share(document_id: str, body: ShareIn, request: Request):
    actor, document, denied = _owner_document(request, document_id)
    if denied:
        return denied
    email = normalize_email(body.email)
    if email == normalize_email(actor.user.email):
        return error_response(409, "CONFLICT", "You cannot share a document with yourself.", request)
    db = request.state.db
    existing = db.scalars(
        select(DocumentGrant).where(DocumentGrant.document_id == document.id, DocumentGrant.grantee_email == email)
    ).all()
    if any(_live(row) for row in existing):
        return error_response(409, "CONFLICT", "That person already has a grant for this document.", request)
    recipient = find_user_by_email(db, email)
    now = utcnow()
    grant = DocumentGrant(
        id=new_id(),
        document_id=document.id,
        grantee_user_id=recipient.id if recipient and recipient.email_verified_at else None,
        grantee_email=email,
        permission=body.permission,
        status="pending",
        created_at=now,
        expires_at=now + INVITATION_TTL,
    )
    db.add(grant)
    db.flush()
    return _share_out(grant)


@router.patch("/documents/{document_id}/shares/{share_id}")
def change_share(document_id: str, share_id: str, body: SharePatchIn, request: Request):
    _actor, document, denied = _owner_document(request, document_id)
    if denied:
        return denied
    grant = request.state.db.get(DocumentGrant, share_id)
    if grant is None or grant.document_id != document.id or not _live(grant):
        return error_response(404, "NOT_FOUND", "That grant is not available.", request)
    grant.permission = body.permission
    return _share_out(grant)


@router.delete("/documents/{document_id}/shares/{share_id}", status_code=204)
def revoke_share(document_id: str, share_id: str, request: Request):
    _actor, document, denied = _owner_document(request, document_id)
    if denied:
        return denied
    grant = request.state.db.get(DocumentGrant, share_id)
    if grant is None or grant.document_id != document.id or grant.status == "revoked":
        return error_response(404, "NOT_FOUND", "That grant is not available.", request)
    grant.status = "revoked"
    return Response(status_code=204)


@router.get("/invitations")
def list_invitations(request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    email = normalize_email(actor.user.email)
    rows = request.state.db.scalars(
        select(DocumentGrant)
        .where(DocumentGrant.grantee_email == email, DocumentGrant.status.in_(("pending", "accepted")))
        .order_by(DocumentGrant.created_at.desc(), DocumentGrant.id.desc())
    ).all()
    items = []
    for row in rows:
        if row.grantee_user_id and row.grantee_user_id != actor.user.id:
            continue
        if not _live(row):
            continue
        item = _invitation_out(request.state.db, row)
        if item is not None:
            items.append(item)
    return InvitationListOut(items=items)


@router.post("/invitations/{invitation_id}/accept")
def accept_invitation(invitation_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    grant = _for_recipient(request.state.db, actor.user, invitation_id)
    if grant is None:
        return error_response(404, "NOT_FOUND", "That invitation is not available.", request)
    if _expired(grant):
        return error_response(409, "CONFLICT", "This invitation has expired.", request)
    if grant.status not in {"pending", "accepted"}:
        return error_response(409, "CONFLICT", "This invitation is no longer available.", request)
    grant.status = "accepted"
    grant.grantee_user_id = actor.user.id
    grant.expires_at = None
    item = _invitation_out(request.state.db, grant)
    if item is None:
        return error_response(404, "NOT_FOUND", "That invitation is not available.", request)
    return item


@router.post("/invitations/{invitation_id}/decline")
def decline_invitation(invitation_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    grant = _for_recipient(request.state.db, actor.user, invitation_id)
    if grant is None:
        return error_response(404, "NOT_FOUND", "That invitation is not available.", request)
    if grant.status == "revoked" or _expired(grant):
        return error_response(409, "CONFLICT", "This invitation is no longer available.", request)
    if grant.status not in {"pending", "accepted", "declined"}:
        return error_response(409, "CONFLICT", "This invitation is no longer available.", request)
    grant.status = "declined"
    grant.expires_at = None
    item = _invitation_out(request.state.db, grant)
    if item is None:
        return error_response(404, "NOT_FOUND", "That invitation is not available.", request)
    return item
