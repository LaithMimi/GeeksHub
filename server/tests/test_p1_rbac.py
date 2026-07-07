"""STD Module: RBAC — RBAC-001..003.

Role hierarchy: STUDENT < ADMIN < MODERATOR. Moderators inherit all admin
privileges (moderation queue, audit, lecturers/courses/majors); user management
(/directory/users, /directory/stats) is MODERATOR-only — admins are rejected.

Note: the STD expects "Admin privileges required" from /directory/users — the code
actually gates it behind get_moderator_user ("Moderator privileges required.").
Still a 403 for students; the message deviation is recorded in the STR.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlmodel import select

import routers.auth as auth_module
from models import User


# --- RBAC-001 (P1) — student blocked everywhere privileged ---
def test_rbac_001_student_blocked_from_privileged_endpoints(client, seed, as_user):
    as_user(seed.student_a_id)

    r = client.get("/api/v1/admin/requests")
    assert r.status_code == 403
    assert r.json()["detail"] == "Admin privileges required. Your role: STUDENT"

    r = client.post(f"/api/v1/admin/requests/{uuid4()}/approve")
    assert r.status_code == 403

    r = client.get("/api/v1/directory/users")
    assert r.status_code == 403
    # STD deviation: directory is moderator-gated, so the message differs.
    assert r.json()["detail"] == "Moderator privileges required."

    r = client.post("/api/v1/directory/majors", json={"name": "Hacked Major"})
    assert r.status_code == 403


# --- RBAC-002 (P1) — moderator is the top role; admin blocked from user management ---
def test_rbac_002_moderator_top_admin_blocked_from_user_management(client, seed, as_user):
    # Moderator passes both gates (inherits admin privileges).
    as_user(seed.moderator_id)

    r_mod = client.get("/api/v1/directory/users")
    assert r_mod.status_code == 200, r_mod.text

    r_admin = client.get("/api/v1/admin/requests")
    assert r_admin.status_code == 200, r_admin.text

    # Admin keeps admin jobs but is rejected from moderator-only user management.
    as_user(seed.admin_id)

    r_admin = client.get("/api/v1/admin/requests")
    assert r_admin.status_code == 200, r_admin.text

    r_users = client.get("/api/v1/directory/users")
    assert r_users.status_code == 403
    assert r_users.json()["detail"] == "Moderator privileges required."

    r_update = client.put(f"/api/v1/directory/users/{seed.student_a_id}", json={"name": "X"})
    assert r_update.status_code == 403

    r_delete = client.delete(f"/api/v1/directory/users/{seed.student_a_id}")
    assert r_delete.status_code == 403


# --- RBAC-003 (P1) — role injection in signup is ignored ---
def test_rbac_003_role_cannot_be_self_escalated_at_signup(client, seed, db, monkeypatch):
    admin = MagicMock()
    admin.users.create.return_value = SimpleNamespace(user_id="auth0|escalation-attempt")
    monkeypatch.setattr(auth_module, "get_auth0_admin", lambda: admin)

    r = client.post("/api/v1/signup", json={
        "username": "Sneaky",
        "email": "sneaky@post.jce.ac.il",
        "password": "Valid#Pass1",
        "password_confirm": "Valid#Pass1",
        "major_id": str(seed.major_id),
        "role": "ADMIN",  # injected field — must be dropped, not honored
    })
    assert r.status_code == 200, r.text
    user = db.exec(select(User).where(User.email == "sneaky@post.jce.ac.il")).first()
    assert user.role == "STUDENT"
