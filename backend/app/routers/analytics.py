"""Personal analytics. Counts come from stored rows, not page views."""

from fastapi import APIRouter, Request

from app.analytics import aggregate, parse_zone
from app.deps import reader
from app.errors import error_response

router = APIRouter()
ALLOWED_DAYS = {7, 30, 90}


@router.get("/analytics")
def get_analytics(request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    raw_days = request.query_params.get("days")
    if raw_days in {None, ""}:
        days = 7
    else:
        try:
            days = int(raw_days)
        except ValueError:
            days = 0
        if days not in ALLOWED_DAYS:
            return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"days": "Use 7, 30, or 90."})
    zone_name = (request.query_params.get("timezone") or "UTC").strip() or "UTC"
    if parse_zone(zone_name) is None:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"timezone": "Use an IANA timezone."})
    return aggregate(request.state.db, actor.user, days, zone_name)
