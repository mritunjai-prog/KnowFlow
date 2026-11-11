from fastapi import APIRouter, Request, Response
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import load_actor
from app.identity import create_anonymous_session, issue_csrf, session_out, touch
from app.security import set_session_cookie

router = APIRouter()


@router.get("/session")
def get_session(request: Request, response: Response):
    db: Session = request.state.db
    settings: Settings = request.app.state.settings
    actor = load_actor(request, db)
    cookie_token = actor.cookie
    record = actor.record
    if record is None:
        record, cookie_token, csrf = create_anonymous_session(db, settings)
        set_session_cookie(response, cookie_token, record.expires_at, settings)
    else:
        touch(record, settings)
        csrf = issue_csrf(record)
    return session_out(actor.user if actor.record else None, csrf)
