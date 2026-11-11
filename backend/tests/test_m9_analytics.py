"""M9 personal analytics and the explicit study timer. No provider calls."""

import json
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.acl import can_read
from app.identity import promote_configured_admins
from app.models import Document, StudyIntervalRecord, StudySessionRecord, TaskRecord, TaskStatusEvent, User
from app.security import new_id, utcnow
from tests.helpers import assert_schema, bootstrap, register_and_verify
from tests.test_m2_capture import finish, login

PASSWORD = "correct-horse-1"
ZONE = ZoneInfo("Asia/Kolkata")


class Clock:
    def __init__(self, instant: datetime):
        self.value = instant

    def __call__(self) -> datetime:
        return self.value

    def advance(self, **kwargs) -> datetime:
        self.value += timedelta(**kwargs)
        return self.value


def _meta(title, tags):
    return {
        "title": title,
        "tags": tags,
        "documentType": "lecture note",
        "meetingId": None,
        "meetingTitle": None,
        "occurredAt": None,
        "captureSource": "text",
        "modelId": None,
    }


def _ingest(client, text, key, title, tags):
    created = client.post(
        "/api/v1/ingestions",
        data={"text": text, "metadata": json.dumps(_meta(title, tags))},
        headers={"Idempotency-Key": key},
    )
    assert created.status_code == 202, created.text
    done = finish(client, created.json()["id"])
    assert done["status"] == "succeeded", done
    return done["items"][0]["documentId"]


def _minutes(seconds: int) -> float:
    return float((Decimal(seconds) / Decimal(60)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _analytics(client, days=7, zone="Asia/Kolkata"):
    response = client.get(f"/api/v1/analytics?days={days}&timezone={zone}")
    assert response.status_code == 200, response.text
    body = response.json()
    assert_schema(body, "Analytics")
    return body


def _period(body):
    return datetime.fromisoformat(body["period"]["from"]).date(), datetime.fromisoformat(body["period"]["to"]).date()


def _add_document(app, owner_id, title, tags, created_at):
    db = app.state.sessionmaker()
    try:
        db.add(
            Document(
                id=new_id(),
                owner_id=owner_id,
                title=title,
                storage_bytes=0,
                created_at=created_at,
                updated_at=created_at,
                source_type="text",
                document_type="other",
                tags=json.dumps(tags),
                text="Synthetic persisted note.",
            )
        )
        db.commit()
    finally:
        db.close()


def _set_created_at(app, document_id, created_at):
    db = app.state.sessionmaker()
    try:
        document = db.get(Document, document_id)
        document.created_at = created_at
        db.commit()
    finally:
        db.close()


def _recompute_completions(app, user_id, zone, start, end):
    """Independent of app.analytics: latest completion event only, and only while access remains."""
    db = app.state.sessionmaker()
    try:
        user = db.get(User, user_id)
        tasks = db.scalars(select(TaskRecord).where(TaskRecord.owner_id == user_id)).all()
        events = db.scalars(select(TaskStatusEvent).where(TaskStatusEvent.owner_id == user_id)).all()
        grouped: dict[str, list] = {}
        for event in events:
            grouped.setdefault(event.task_id, []).append(event)
        counts: dict = {}
        for task in tasks:
            document = db.get(Document, task.document_id)
            if task.status != "completed" or document is None or not can_read(db, user, document):
                continue
            rows = grouped.get(task.id, [])
            if not rows:
                continue
            latest = max(rows, key=lambda event: (event.seq, event.id))
            if latest.kind != "completed":
                continue
            day = _aware(latest.occurred_at).astimezone(zone).date()
            if start <= day <= end:
                counts[day] = counts.get(day, 0) + 1
        return counts
    finally:
        db.close()


def _overlap_seconds(app, user_id, opening, closing) -> int:
    db = app.state.sessionmaker()
    try:
        sessions = db.scalars(select(StudySessionRecord.id).where(StudySessionRecord.owner_id == user_id)).all()
        if not sessions:
            return 0
        intervals = db.scalars(select(StudyIntervalRecord).where(StudyIntervalRecord.session_id.in_(sessions))).all()
        total = 0.0
        for interval in intervals:
            start = _aware(interval.started_at)
            end = _aware(interval.confirmed_through)
            lo = max(start, opening)
            hi = min(end, closing)
            if hi > lo:
                total += (hi - lo).total_seconds()
        return int(total)
    finally:
        db.close()


def test_unknown_period_and_empty_analytics_do_not_invent_study_time(client, caplog):
    anonymous = client.get("/api/v1/analytics")
    assert anonymous.status_code == 401
    register_and_verify(client, caplog)
    login(client)
    for _ in range(3):
        assert client.get("/api/v1/documents").status_code == 200
    missing = client.get("/api/v1/analytics?days=14")
    assert missing.status_code == 422
    assert missing.json()["error"]["fields"]["days"]
    bad_zone = client.get("/api/v1/analytics?days=7&timezone=Mars/Phobos")
    assert bad_zone.status_code == 422
    body = _analytics(client)
    start, end = _period(body)
    assert (end - start).days == 6
    assert body["documentCount"] == 0
    assert body["pendingTaskCount"] == 0
    assert body["completedTaskCount"] == 0
    assert body["studyMinutes"] is None
    assert body["activity"] == []
    assert body["topicCoverage"] == []
    assert "not measured" in body["studyTimeDefinition"]
    assert "Page views" in body["studyTimeDefinition"]
    longer = _analytics(client, days=90)
    assert (_period(longer)[1] - _period(longer)[0]).days == 89
    assert client.get("/api/v1/study-sessions/current").json()["session"] is None


def test_day_boundaries_and_reopened_tasks_do_not_double_count(client, app, caplog):
    register_and_verify(client, caplog)
    login(client)
    session = client.get("/api/v1/session")
    client.headers["X-CSRF-Token"] = session.json()["csrfToken"]
    user_id = session.json()["user"]["id"]
    probe = _analytics(client)
    start, end = _period(probe)
    assert (end - start).days == 6
    midnight = datetime.combine(end, time.min, ZONE)
    before = midnight - timedelta(minutes=10)
    after = midnight + timedelta(minutes=10)
    older = datetime.combine(end - timedelta(days=10), time(12), ZONE)
    monthish = datetime.combine(end - timedelta(days=40), time(12), ZONE)
    ancient = datetime.combine(end - timedelta(days=100), time(12), ZONE)
    captured = _ingest(client, "Synthetic capture about graphs.", "capture-1", "Captured note", ["graphs"])
    replay = client.post(
        "/api/v1/ingestions",
        data={"text": "Synthetic capture about graphs.", "metadata": json.dumps(_meta("Captured note", ["graphs"]))},
        headers={"Idempotency-Key": "capture-1"},
    )
    assert replay.status_code == 202
    assert finish(client, replay.json()["id"])["items"][0]["documentId"] == captured
    _set_created_at(app, captured, before.astimezone(timezone.utc))
    _add_document(app, user_id, "After midnight", ["graphs", "graphs"], after.astimezone(timezone.utc))
    _add_document(app, user_id, "Ten days ago", ["graphs"], older.astimezone(timezone.utc))
    _add_document(app, user_id, "Forty days ago", [], monthish.astimezone(timezone.utc))
    _add_document(app, user_id, "Outside ninety", ["graphs"], ancient.astimezone(timezone.utc))
    owned = client.get("/api/v1/documents?ownership=owned&pageSize=100")
    assert owned.status_code == 200
    owned_body = owned.json()
    expected_days = {}
    for item in owned_body["items"]:
        day = datetime.fromisoformat(item["createdAt"]).astimezone(ZONE).date()
        if start <= day <= end:
            expected_days[day] = expected_days.get(day, 0) + 1
    week = _analytics(client)
    assert week["documentCount"] == owned_body["total"] == 5
    assert {row["date"]: row["documents"] for row in week["activity"]} == {
        day.isoformat(): count for day, count in expected_days.items()
    }
    assert week["activity"]
    assert before.astimezone(ZONE).date().isoformat() in {row["date"] for row in week["activity"]}
    assert after.astimezone(ZONE).date().isoformat() in {row["date"] for row in week["activity"]}
    los_angeles = _analytics(client, zone="America/Los_Angeles")
    la_days = {row["date"] for row in los_angeles["activity"]}
    assert after.astimezone(ZoneInfo("America/Los_Angeles")).date().isoformat() in la_days
    assert after.astimezone(ZONE).date() != after.astimezone(ZoneInfo("America/Los_Angeles")).date()
    month = _analytics(client, days=30)
    assert older.astimezone(ZONE).date().isoformat() in {row["date"] for row in month["activity"]}
    assert older.astimezone(ZONE).date().isoformat() not in {row["date"] for row in week["activity"]}
    quarter = _analytics(client, days=90)
    assert monthish.astimezone(ZONE).date().isoformat() in {row["date"] for row in quarter["activity"]}
    assert monthish.astimezone(ZONE).date().isoformat() not in {row["date"] for row in month["activity"]}
    assert ancient.astimezone(ZONE).date().isoformat() not in {row["date"] for row in quarter["activity"]}
    assert quarter["documentCount"] == 5
    graphs = next(item for item in week["topicCoverage"] if item["topic"] == "graphs")
    assert graphs["count"] == 4
    assert all(item["topic"] != "mastery" for item in week["topicCoverage"])

    task = client.post(
        "/api/v1/tasks",
        json={"description": "Read the note", "priority": "medium", "dueDate": None, "sourceDocumentId": captured},
    )
    assert task.status_code == 201, task.text
    task_id = task.json()["id"]
    for _ in range(2):
        completed = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "completed"})
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
    reopened = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "pending"})
    assert reopened.status_code == 200
    again = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "completed"})
    assert again.status_code == 200
    db = app.state.sessionmaker()
    try:
        events = db.scalars(select(TaskStatusEvent).where(TaskStatusEvent.task_id == task_id).order_by(TaskStatusEvent.seq.asc())).all()
        assert [event.kind for event in events] == ["completed", "reopened", "completed"]
        latest = events[-1]
        latest.occurred_at = after.astimezone(timezone.utc)
        events[0].occurred_at = older.astimezone(timezone.utc)
        task_row = db.get(TaskRecord, task_id)
        task_row.completed_at = after.astimezone(timezone.utc)
        db.commit()
    finally:
        db.close()
    counted = _analytics(client)
    start, end = _period(counted)
    recomputed = _recompute_completions(app, user_id, ZONE, start, end)
    assert sum(recomputed.values()) == 1
    assert {row["date"]: row["completedTasks"] for row in counted["activity"] if row["completedTasks"]} == {
        day.isoformat(): count for day, count in recomputed.items()
    }
    assert counted["completedTaskCount"] == client.get("/api/v1/tasks?status=completed").json()["total"] == 1
    assert counted["pendingTaskCount"] == client.get("/api/v1/tasks?status=pending").json()["total"] == 0
    month = _analytics(client, days=30)
    month_start, month_end = _period(month)
    assert sum(_recompute_completions(app, user_id, ZONE, month_start, month_end).values()) == 1
    removed = client.delete(f"/api/v1/tasks/{task_id}")
    assert removed.status_code == 204
    after_delete = _analytics(client)
    assert after_delete["completedTaskCount"] == 0
    assert sum(row["completedTasks"] for row in after_delete["activity"]) == 0


def test_permission_changes_do_not_enter_another_users_metrics(client, app, caplog):
    register_and_verify(client, caplog, email="ada@example.com", name="Ada")
    register_and_verify(client, caplog, email="bea@example.com", name="Bea")
    register_and_verify(client, caplog, email="cy@example.com", name="Cy")
    register_and_verify(client, caplog, email="admin@example.com", name="Admin")
    db = app.state.sessionmaker()
    try:
        promote_configured_admins(db, app.state.settings)
        db.commit()
    finally:
        db.close()
    login(client, "ada@example.com")
    shared = _ingest(client, "Shared graphs note.", "shared-note", "Ada Private Title", ["ada-private-topic"])
    sibling = _ingest(client, "Sibling note.", "sibling-note", "Sibling title", ["sibling-only"])
    invited = client.post(f"/api/v1/documents/{shared}/shares", json={"email": "bea@example.com", "permission": "view"})
    assert invited.status_code == 201, invited.text
    share_id = invited.json()["id"]
    login(client, "bea@example.com")
    before = _analytics(client)
    assert before["documentCount"] == 0
    assert before["topicCoverage"] == []
    assert "Ada Private Title" not in before.__repr__()
    assert "ada-private-topic" not in json.dumps(before)
    invitations = client.get("/api/v1/invitations").json()["items"]
    accepted = client.post(f"/api/v1/invitations/{invitations[0]['id']}/accept")
    assert accepted.status_code == 200
    task = client.post(
        "/api/v1/tasks",
        json={"description": "Bea follow-up", "priority": "low", "dueDate": None, "sourceDocumentId": shared},
    )
    assert task.status_code == 201, task.text
    assert client.patch(f"/api/v1/tasks/{task.json()['id']}", json={"status": "completed"}).status_code == 200
    shared_view = _analytics(client)
    assert shared_view["documentCount"] == 0
    assert shared_view["topicCoverage"] == [{"topic": "ada-private-topic", "count": 1}]
    assert shared_view["completedTaskCount"] == 1
    assert "sibling-only" not in json.dumps(shared_view)
    assert "Sibling title" not in json.dumps(shared_view)
    login(client, "cy@example.com")
    outsider = _analytics(client)
    assert outsider["documentCount"] == 0
    assert outsider["topicCoverage"] == []
    assert outsider["completedTaskCount"] == 0
    login(client, "admin@example.com")
    admin = _analytics(client)
    assert admin["documentCount"] == 0
    assert "ada-private-topic" not in json.dumps(admin)
    assert "Ada Private Title" not in json.dumps(admin)
    login(client, "ada@example.com")
    assert client.delete(f"/api/v1/documents/{shared}/shares/{share_id}").status_code == 204
    owner = _analytics(client)
    assert owner["documentCount"] == 2
    assert {item["topic"] for item in owner["topicCoverage"]} == {"ada-private-topic", "sibling-only"}
    login(client, "bea@example.com")
    revoked = _analytics(client)
    assert revoked["documentCount"] == 0
    assert revoked["topicCoverage"] == []
    assert revoked["pendingTaskCount"] == 0
    assert revoked["completedTaskCount"] == 0
    assert revoked["studyMinutes"] is None
    assert "Ada Private Title" not in json.dumps(revoked)
    assert client.get("/api/v1/tasks").json()["total"] == 0


def _start(client, key, document_id=None):
    payload = {} if document_id is None else {"documentId": document_id}
    response = client.post("/api/v1/study-sessions", json=payload, headers={"Idempotency-Key": key})
    return response


def _beat(client, session_id, revision, key):
    return client.post(
        f"/api/v1/study-sessions/{session_id}/heartbeat",
        json={"revision": revision},
        headers={"Idempotency-Key": key},
    )


def _act(client, session_id, action, revision, key):
    return client.post(
        f"/api/v1/study-sessions/{session_id}/{action}",
        json={"revision": revision},
        headers={"Idempotency-Key": key},
    )


def test_study_timer_credits_only_confirmed_server_intervals(client, app, caplog, monkeypatch):
    register_and_verify(client, caplog, email="ada@example.com", name="Ada")
    register_and_verify(client, caplog, email="bea@example.com", name="Bea")
    login(client, "ada@example.com")
    session = client.get("/api/v1/session")
    client.headers["X-CSRF-Token"] = session.json()["csrfToken"]
    user_id = session.json()["user"]["id"]
    note = _ingest(client, "Timer source.", "timer-note", "Timer title", ["timers"])
    for _ in range(4):
        assert client.get(f"/api/v1/documents/{note}").status_code == 200
    assert _analytics(client)["studyMinutes"] is None
    rejected = client.post(
        "/api/v1/study-sessions",
        json={"documentId": note, "elapsedSeconds": 600},
        headers={"Idempotency-Key": "reject-elapsed"},
    )
    assert rejected.status_code == 422
    assert _analytics(client)["studyMinutes"] is None

    zone = ZONE
    end_clock = datetime(2026, 11, 11, 12, 0, tzinfo=zone)
    period_start = datetime.combine(end_clock.date() - timedelta(days=6), time.min, zone)
    clock = Clock(period_start - timedelta(seconds=60))
    monkeypatch.setattr("app.study.now", clock)
    started = _start(client, "boundary-start", note)
    assert started.status_code == 201, started.text
    session_id = started.json()["session"]["id"]
    assert started.json()["session"]["measuredSeconds"] == 0
    assert started.json()["session"]["documentId"] == note
    replay = _start(client, "boundary-start", note)
    assert replay.status_code == 201
    assert replay.json()["session"]["id"] == session_id
    conflict = _start(client, "boundary-other")
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "STUDY_SESSION_OPEN"
    clock.value = period_start - timedelta(seconds=30)
    first = _beat(client, session_id, started.json()["session"]["revision"], "boundary-beat-1")
    assert first.status_code == 200, first.text
    assert first.json()["session"]["measuredSeconds"] == 30, first.text
    clock.value = period_start + timedelta(seconds=30)
    beat = _beat(client, session_id, started.json()["session"]["revision"], "boundary-beat-2")
    assert beat.status_code == 200, beat.text
    assert beat.json()["session"]["measuredSeconds"] == 90
    late_replay = _beat(client, session_id, started.json()["session"]["revision"], "boundary-beat-2")
    assert late_replay.status_code == 200
    assert late_replay.json()["session"]["measuredSeconds"] == 90
    stopped = _act(client, session_id, "stop", beat.json()["session"]["revision"], "boundary-stop")
    assert stopped.status_code == 200, stopped.text
    assert stopped.json()["session"]["status"] == "completed"
    assert stopped.json()["session"]["measuredSeconds"] == 90
    clock.value = end_clock
    opening = period_start.astimezone(timezone.utc)
    closing = datetime.combine(end_clock.date() + timedelta(days=1), time.min, zone).astimezone(timezone.utc)
    overlap = _overlap_seconds(app, user_id, opening, closing)
    assert overlap == 30
    measured = _analytics(client)
    assert measured["studyMinutes"] == _minutes(overlap) == 0.5
    assert "user-started timer" in measured["studyTimeDefinition"]
    assert "Asia/Kolkata" in measured["studyTimeDefinition"]
    assert "not attention or mastery" in measured["studyTimeDefinition"]
    utc_view = client.get("/api/v1/analytics?days=7")
    assert utc_view.status_code == 200
    assert utc_view.json()["studyMinutes"] is None
    assert "not measured" in utc_view.json()["studyTimeDefinition"]

    clock.value = end_clock
    second = _start(client, "gap-start")
    assert second.status_code == 201, second.text
    second_id = second.json()["session"]["id"]
    revision = second.json()["session"]["revision"]
    clock.advance(seconds=30)
    first_beat = _beat(client, second_id, revision, "gap-beat-1")
    assert first_beat.status_code == 200
    assert first_beat.json()["session"]["measuredSeconds"] == 30
    clock.advance(seconds=30)
    same_key = _beat(client, second_id, revision, "gap-beat-1")
    assert same_key.json()["session"]["measuredSeconds"] == 30
    second_beat = _beat(client, second_id, revision, "gap-beat-2")
    assert second_beat.status_code == 200
    assert second_beat.json()["session"]["measuredSeconds"] == 60
    paused = _act(client, second_id, "pause", revision, "gap-pause")
    assert paused.status_code == 200, paused.text
    assert paused.json()["session"]["status"] == "paused"
    assert paused.json()["session"]["pauseReason"] == "manual"
    clock.advance(minutes=10)
    resumed = _act(client, second_id, "resume", paused.json()["session"]["revision"], "gap-resume")
    assert resumed.status_code == 200, resumed.text
    clock.advance(seconds=30)
    third = _beat(client, second_id, resumed.json()["session"]["revision"], "gap-beat-3")
    assert third.json()["session"]["measuredSeconds"] == 90
    finished = _act(client, second_id, "stop", resumed.json()["session"]["revision"], "gap-stop")
    assert finished.status_code == 200
    assert finished.json()["session"]["measuredSeconds"] == 90
    combined = _analytics(client)
    assert combined["studyMinutes"] == _minutes(30 + 90)

    clock.value = end_clock + timedelta(hours=3)
    stale = _start(client, "stale-start")
    stale_id = stale.json()["session"]["id"]
    stale_revision = stale.json()["session"]["revision"]
    clock.advance(seconds=91)
    current = client.get("/api/v1/study-sessions/current")
    assert current.status_code == 200, current.text
    assert current.json()["session"]["status"] == "paused"
    assert current.json()["session"]["pauseReason"] == "connection_lost"
    assert current.json()["session"]["measuredSeconds"] == 0
    late = _beat(client, stale_id, stale_revision, "stale-beat")
    assert late.status_code == 200
    assert late.json()["session"]["status"] == "paused"
    assert late.json()["session"]["measuredSeconds"] == 0
    revived = _beat(client, stale_id, late.json()["session"]["revision"], "stale-beat-2")
    assert revived.json()["session"]["status"] == "paused"
    stopped_stale = _act(client, stale_id, "stop", late.json()["session"]["revision"], "stale-stop")
    assert stopped_stale.status_code == 200
    assert stopped_stale.json()["session"]["measuredSeconds"] == 0
    no_credit = _analytics(client)
    assert no_credit["studyMinutes"] == combined["studyMinutes"]

    listed = client.get("/api/v1/study-sessions?page=1&pageSize=20")
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1
    assert "Timer title" not in listed.text
    wrong = client.delete(f"/api/v1/study-sessions/{second_id}", headers={"If-Match": "1"})
    assert wrong.status_code == 409
    deleted = client.delete(
        f"/api/v1/study-sessions/{session_id}",
        headers={"If-Match": str(stopped.json()["session"]["revision"])},
    )
    assert deleted.status_code == 204, deleted.text
    after = _analytics(client)
    assert after["studyMinutes"] == _minutes(90)
    login(client, "bea@example.com")
    assert client.delete(f"/api/v1/study-sessions/{second_id}", headers={"If-Match": "1"}).status_code == 404
    assert _analytics(client)["studyMinutes"] is None
    login(client, "ada@example.com")
    share = client.post(f"/api/v1/documents/{note}/shares", json={"email": "bea@example.com", "permission": "view"})
    assert share.status_code == 201, share.text
    login(client, "bea@example.com")
    invitation = client.get("/api/v1/invitations").json()["items"][0]
    assert client.post(f"/api/v1/invitations/{invitation['id']}/accept").status_code == 200
    clock.value = end_clock + timedelta(hours=5)
    bea_start = _start(client, "bea-start", note)
    assert bea_start.status_code == 201, bea_start.text
    assert bea_start.json()["session"]["documentId"] == note
    login(client, "ada@example.com")
    assert client.delete(f"/api/v1/documents/{note}/shares/{share.json()['id']}").status_code == 204
    login(client, "bea@example.com")
    hidden = client.get("/api/v1/study-sessions")
    assert hidden.status_code == 200
    assert hidden.json()["items"][0]["documentId"] is None
    assert "Timer title" not in hidden.text
    assert _analytics(client)["topicCoverage"] == []


def test_abandoned_cap_and_second_tab_do_not_add_time(client, app, caplog, monkeypatch):
    register_and_verify(client, caplog)
    login(client)
    clock = Clock(datetime(2026, 11, 11, 8, 0, tzinfo=timezone.utc))
    monkeypatch.setattr("app.study.now", clock)
    missing = client.post("/api/v1/study-sessions/{}/heartbeat".format("missing"), json={"revision": 1}, headers={"Idempotency-Key": "missing"})
    assert missing.status_code == 404
    started = _start(client, "cap-start")
    assert started.status_code == 201, started.text
    session_id = started.json()["session"]["id"]
    revision = started.json()["session"]["revision"]
    db = app.state.sessionmaker()
    try:
        row = db.get(StudySessionRecord, session_id)
        confirmed = clock.value + timedelta(hours=3, minutes=59)
        row.confirmed_through = confirmed
        row.lease_expires_at = clock.value + timedelta(hours=4, minutes=2)
        interval = db.scalar(select(StudyIntervalRecord).where(StudyIntervalRecord.session_id == session_id))
        interval.confirmed_through = confirmed
        db.commit()
    finally:
        db.close()
    clock.advance(hours=4, seconds=1)
    capped = _beat(client, session_id, revision, "cap-beat")
    assert capped.status_code == 200, capped.text
    assert capped.json()["session"]["status"] == "completed"
    assert capped.json()["session"]["stopReason"] == "safety_cap"
    assert capped.json()["session"]["measuredSeconds"] == 3 * 3600 + 59 * 60
    assert _analytics(client)["studyMinutes"] == _minutes(3 * 3600 + 59 * 60)
    again = _start(client, "after-cap")
    assert again.status_code == 201, again.text
    from fastapi.testclient import TestClient

    with TestClient(app) as other:
        other.headers["Origin"] = "http://test.example"
        login(other)
        second = _start(other, "other-tab")
        assert second.status_code == 409
        assert second.json()["error"]["code"] == "STUDY_SESSION_OPEN"
    no_csrf = client.post("/api/v1/study-sessions", json={}, headers={"Idempotency-Key": "no-csrf", "X-CSRF-Token": "wrong"})
    assert no_csrf.status_code == 403
    events = app.state.sessionmaker()
    try:
        assert events.scalar(select(func.count()).select_from(StudySessionRecord)) == 2
    finally:
        events.close()
