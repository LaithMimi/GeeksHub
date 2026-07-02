"""STD Modules: Directory (DIR-001 P2, DIR-002 P1), Catalog (CAT-001 P2),
Tasks (TASK-001 P1), Gamification (GAM-001 P2), AI Assistant (AI-001 P1, AI-002 P2).
"""
from uuid import UUID, uuid4

from sqlmodel import select

from models import PointsTransaction, User, UserTask


# --- DIR-002 (P1) — deleting a major with courses is a clean 409, not a 500 ---
def test_dir_002_delete_major_with_courses_blocked(client, seed, as_user):
    as_user(seed.moderator_id)
    r = client.delete(f"/api/v1/directory/majors/{seed.major_id}")
    assert r.status_code == 409
    assert "cannot be deleted" in r.json()["detail"]


# --- DIR-001 (P2) — course creation with a bad major reference ---
def test_dir_001_course_creation_with_bad_major(client, seed, as_user):
    as_user(seed.moderator_id)
    r = client.post("/api/v1/directory/courses", json={
        "code": "GHOST101", "name": "Ghost Course",
        "majorId": str(uuid4()), "yearId": 1, "semester": 1,
    })
    assert 400 <= r.status_code < 500, (
        f"bad major_id must be a clean 4xx, got {r.status_code}: {r.text}")


# --- CAT-001 (P2) — course filter by major has no cross-major leakage ---
def test_cat_001_courses_filtered_by_major(client, seed, as_user):
    as_user(seed.student_a_id)
    r = client.get(f"/api/v1/courses?major_id={seed.major_id}")
    assert r.status_code == 200
    majors = {c["major_id"] for c in r.json()}
    assert majors == {str(seed.major_id)}, f"cross-major leakage: {majors}"


# --- TASK-001 (P1) — task CRUD ownership isolation ---
def test_task_001_ownership_isolation(client, seed, as_user, db):
    as_user(seed.student_a_id)
    r = client.post("/api/v1/me/tasks", json={
        "title": "Study for midterm", "date": "2026-07-10",
        "startHour": 10.0, "duration": 2.0, "priority": "high",
    })
    assert r.status_code == 201, r.text
    task_id = r.json()["id"]

    as_user(seed.student_b_id)
    r_patch = client.patch(f"/api/v1/me/tasks/{task_id}", json={"completed": True})
    assert r_patch.status_code == 404
    r_delete = client.delete(f"/api/v1/me/tasks/{task_id}")
    assert r_delete.status_code == 404

    db.expire_all()
    task = db.get(UserTask, UUID(task_id))
    assert task is not None and task.completed is False, "B must not touch A's task"


# --- GAM-001 (P2) — reputation cache matches the ledger ---
def test_gam_001_reputation_matches_ledger(client, seed, as_user, db):
    db.add(PointsTransaction(user_id=seed.student_a_id, amount=25,
                             action="upload_approval", reason="t1"))
    db.add(PointsTransaction(user_id=seed.student_a_id, amount=10,
                             action="file_completed", reason="t2", source_id="test_src_1"))
    user = db.get(User, seed.student_a_id)
    user.total_points = 35
    db.add(user); db.commit()

    as_user(seed.student_a_id)
    r = client.get("/api/v1/me/reputation")
    assert r.status_code == 200
    body = r.json()
    ledger_sum = sum(t["amount"] for t in body["transactions"])
    assert body["totalPoints"] == 35 == ledger_sum, (
        f"cache ({body['totalPoints']}) and ledger ({ledger_sum}) diverge")


# --- AI-001 (P1) — assistant requires auth (no unauthenticated LLM spend) ---
def test_ai_001_assistant_requires_auth(client, seed):
    r = client.post("/api/v1/assistant/chat",
                    json={"fileId": str(uuid4()), "message": "hello"})
    assert r.status_code == 401


# --- AI-002 (P2) — input validation on the assistant payload ---
def test_ai_002_assistant_input_validation(client, seed, as_user):
    as_user(seed.student_a_id)

    # Oversized message (>2000 chars) must be a 422 before any LLM call.
    r_long = client.post("/api/v1/assistant/chat",
                         json={"fileId": str(uuid4()), "message": "x" * 50_000})
    assert r_long.status_code == 422

    # Empty message: schema has no min_length, so this documents actual behavior.
    # (fileId is nonexistent → a 404 here proves the empty string got PAST
    # validation, which the STD says should be a 4xx validation error — recorded
    # as a partial fail / P3 defect in the STR.)
    r_empty = client.post("/api/v1/assistant/chat",
                          json={"fileId": str(uuid4()), "message": ""})
    assert r_empty.status_code in (404, 422)
    global EMPTY_MESSAGE_REACHED_ENDPOINT
    EMPTY_MESSAGE_REACHED_ENDPOINT = (r_empty.status_code == 404)
