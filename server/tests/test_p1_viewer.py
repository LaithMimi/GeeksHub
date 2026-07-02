"""STD Module: Viewer / Completion Scoring — VIEW-001, 002, 003, 005 (P1)
plus VIEW-004 (P2) and the XP-farming regression that motivated the
per-user+file source_id fix (relates to VIEW-006's idempotency concern).
"""
from uuid import UUID

import pytest
from sqlmodel import select

from models import (
    FileViewingSession, Material, MaterialChunk, PointsTransaction, User,
    UserCourseActivity,
)

SESSION_START = "/api/v1/me/viewer/session-start"
HEARTBEAT = "/api/v1/me/viewer/heartbeat"


@pytest.fixture()
def material(db, seed):
    mat = Material(title="Lecture 1", academic_year=1, material_year=2025,
                   course_id=seed.course_id, lecturer_id=seed.lecturer_id,
                   type_id=seed.type_id, uploader_id=seed.student_b_id,
                   file_url="Intro_to_SE/lecture1.pdf")
    db.add(mat); db.commit(); db.refresh(mat)
    return mat


def _add_chunks(db, material_id, pages):
    for p in range(1, pages + 1):
        db.add(MaterialChunk(material_id=material_id, content=f"page {p} text",
                             embedding=[0.0] * 1536, page_number=p))
    db.commit()


def _force_session(db, session_id, *, required=100, pages=10):
    """Pin the formula inputs so expected scores are exact (VIEW-003 test data)."""
    vs = db.get(FileViewingSession, UUID(session_id))
    vs.required_active_seconds = required
    vs.total_pages = pages
    db.add(vs); db.commit()


# --- VIEW-001 (P1) — server-authoritative page count ---
def test_view_001_session_start_uses_server_page_count(client, seed, as_user, db, material):
    _add_chunks(db, material.id, pages=20)
    as_user(seed.student_a_id)

    r = client.post(SESSION_START, json={"file_id": str(material.id)})
    assert r.status_code == 200, r.text
    vs = db.get(FileViewingSession, UUID(r.json()["sessionId"]))
    assert vs.total_pages == 20
    assert vs.required_active_seconds == int(20 * 45 * 0.60)  # 540


def test_view_001b_session_start_falls_back_to_10_pages(client, seed, as_user, db, material):
    as_user(seed.student_a_id)  # material has no chunks
    r = client.post(SESSION_START, json={"file_id": str(material.id)})
    vs = db.get(FileViewingSession, UUID(r.json()["sessionId"]))
    assert vs.total_pages == 10
    assert vs.required_active_seconds == int(10 * 45 * 0.60)  # 270


# --- VIEW-002 (P1) — heartbeat clamped to 30s ---
def test_view_002_heartbeat_clamps_active_seconds(client, seed, as_user, db, material):
    as_user(seed.student_a_id)
    session_id = client.post(SESSION_START, json={"file_id": str(material.id)}).json()["sessionId"]

    r = client.post(HEARTBEAT, json={"session_id": session_id,
                                     "active_seconds_to_add": 300, "visited_pages": [1]})
    assert r.status_code == 200
    assert r.json()["activeSeconds"] == 30, "client-claimed 300s must clamp to 30"


# --- VIEW-003 (P1) — completion formula and the 0.85 XP trigger ---
def test_view_003_completion_formula_and_xp_trigger(client, seed, as_user, db, material):
    as_user(seed.student_a_id)
    session_id = client.post(SESSION_START, json={"file_id": str(material.id)}).json()["sessionId"]
    _force_session(db, session_id, required=100, pages=10)

    # 3 × 30s = 90s active; 9/10 pages → 0.9 × 0.9 = 0.81 < 0.85 → no XP yet
    for _ in range(3):
        r = client.post(HEARTBEAT, json={"session_id": session_id,
                                         "active_seconds_to_add": 30,
                                         "visited_pages": list(range(1, 10))})
    assert r.json()["score"] == pytest.approx(0.81)
    assert r.json()["isComplete"] is False
    assert db.exec(select(PointsTransaction)).first() is None

    # 10th page, +0s → 0.9 × 1.0 = 0.9 ≥ 0.85 → complete, +10 XP exactly once
    r = client.post(HEARTBEAT, json={"session_id": session_id,
                                     "active_seconds_to_add": 0,
                                     "visited_pages": list(range(1, 11))})
    assert r.json()["isComplete"] is True
    assert r.json()["score"] == pytest.approx(0.9)

    db.expire_all()
    txs = db.exec(select(PointsTransaction)).all()
    assert len(txs) == 1 and txs[0].amount == 10 and txs[0].action == "file_completed"
    assert db.get(User, seed.student_a_id).total_points == 10
    activity = db.get(UserCourseActivity, (seed.student_a_id, seed.course_id))
    assert activity.files_completed == 1
    assert activity.status == "exploring"


# --- VIEW-004 (P2) — invalid page numbers sanitized ---
def test_view_004_invalid_pages_discarded(client, seed, as_user, db, material):
    as_user(seed.student_a_id)
    session_id = client.post(SESSION_START, json={"file_id": str(material.id)}).json()["sessionId"]
    _force_session(db, session_id, required=100, pages=10)

    r = client.post(HEARTBEAT, json={"session_id": session_id,
                                     "active_seconds_to_add": 30,
                                     "visited_pages": [0, -1, 5, 999]})
    # only page 5 counts: time 30/100 × pages 1/10 = 0.03
    assert r.json()["score"] == pytest.approx(0.03)


# --- VIEW-005 (P1) — no re-award once complete ---
def test_view_005_no_reaward_after_completion(client, seed, as_user, db, material):
    as_user(seed.student_a_id)
    session_id = client.post(SESSION_START, json={"file_id": str(material.id)}).json()["sessionId"]
    _force_session(db, session_id, required=30, pages=1)
    client.post(HEARTBEAT, json={"session_id": session_id,
                                 "active_seconds_to_add": 30, "visited_pages": [1]})

    r = client.post(HEARTBEAT, json={"session_id": session_id,
                                     "active_seconds_to_add": 30, "visited_pages": [1]})
    assert r.json() == {"message": "Already complete", "score": 1.0, "isComplete": True}

    db.expire_all()
    assert len(db.exec(select(PointsTransaction)).all()) == 1
    assert db.get(User, seed.student_a_id).total_points == 10


# --- Regression: XP farming via fresh sessions (the per-user+file dedupe fix) ---
def test_view_xp_not_farmable_via_new_sessions(client, seed, as_user, db, material):
    as_user(seed.student_a_id)

    def complete_once():
        sid = client.post(SESSION_START, json={"file_id": str(material.id)}).json()["sessionId"]
        _force_session(db, sid, required=30, pages=1)
        return client.post(HEARTBEAT, json={"session_id": sid,
                                            "active_seconds_to_add": 30,
                                            "visited_pages": [1]})

    r1 = complete_once()
    assert r1.json()["isComplete"] is True
    r2 = complete_once()  # brand-new session, same file — must NOT pay again
    assert r2.status_code == 200
    assert r2.json()["isComplete"] is True

    db.expire_all()
    txs = db.exec(select(PointsTransaction).where(
        PointsTransaction.user_id == seed.student_a_id)).all()
    assert len(txs) == 1, "second session on the same file must not re-award XP"
    assert db.get(User, seed.student_a_id).total_points == 10
    activity = db.get(UserCourseActivity, (seed.student_a_id, seed.course_id))
    assert activity.files_completed == 1
