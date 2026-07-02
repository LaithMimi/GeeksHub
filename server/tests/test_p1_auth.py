"""STD Module: Authentication — AUTH-001..010 (AUTH-005 is P2, included as it's free).

Auth0 is mocked at the boundary (get_auth0_admin / GetToken / requests.post):
everything on OUR side of the boundary — domain allow-list, Pydantic validation,
rollback branch, rate limiting, cookie flags, error mapping — runs for real.
"""
import jwt as pyjwt
import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from sqlmodel import select

import routers.auth as auth_module
from models import User

SIGNUP = "/api/v1/signup"
SIGNIN = "/api/v1/signin"


def _payload(seed, email="qa.tester1@post.jce.ac.il", password="Valid#Pass1", **extra):
    body = {
        "username": "QA Tester",
        "email": email,
        "password": password,
        "password_confirm": password,
        "major_id": str(seed.major_id),
    }
    body.update(extra)
    return body


@pytest.fixture()
def mock_auth0_admin(monkeypatch):
    admin = MagicMock(name="MockAuth0Admin")
    admin.users.create.return_value = SimpleNamespace(user_id="auth0|new-test-user")
    monkeypatch.setattr(auth_module, "get_auth0_admin", lambda: admin)
    return admin


def _mock_gettoken(monkeypatch, email_verified=True, login_exc=None):
    """Patch routers.auth.GetToken so signin never reaches the real Auth0 tenant."""
    id_token = pyjwt.encode({"email_verified": email_verified}, "k", algorithm="HS256")

    class FakeGetToken:
        def __init__(self, *a, **k): ...
        def login(self, **kwargs):
            if login_exc:
                raise login_exc
            return {"id_token": id_token, "access_token": "fake-access-token"}

    monkeypatch.setattr(auth_module, "GetToken", FakeGetToken)


# --- AUTH-001 (P1) ---
def test_auth_001_signup_rejects_non_institutional_email(client, seed, db):
    r = client.post(SIGNUP, json=_payload(seed, email="student@gmail.com"))
    assert r.status_code == 400
    assert "restricted to Azrieli College students" in r.json()["detail"]
    assert db.exec(select(User).where(User.email == "student@gmail.com")).first() is None


# --- AUTH-002 (P1) — Auth0 boundary mocked ---
def test_auth_002_signup_succeeds_for_institutional_email(client, seed, db, mock_auth0_admin):
    r = client.post(SIGNUP, json=_payload(seed))
    assert r.status_code == 200, r.text
    user = db.exec(select(User).where(User.email == "qa.tester1@post.jce.ac.il")).first()
    assert user is not None
    assert user.role == "STUDENT"
    assert user.major_id == seed.major_id
    assert user.auth0_id == "auth0|new-test-user"
    mock_auth0_admin.users.create.assert_called_once()


# --- AUTH-003 (P1) — rollback on partial failure (DB insert fails after Auth0 create) ---
def test_auth_003_signup_rolls_back_auth0_user_on_db_failure(client, seed, db, mock_auth0_admin):
    # Nonexistent major_id → FK violation at commit, AFTER the Auth0 user was created.
    bad = _payload(seed)
    bad["major_id"] = str(uuid4())
    r = client.post(SIGNUP, json=bad)
    assert r.status_code == 400
    mock_auth0_admin.users.delete.assert_called_once_with("auth0|new-test-user")
    assert db.exec(select(User).where(User.email == "qa.tester1@post.jce.ac.il")).first() is None


# --- AUTH-004 (P1) — password strength boundaries ---
@pytest.mark.parametrize("password,should_pass", [
    ("short1!", False),         # < 8 chars
    ("alllowercase1!", False),  # no uppercase
    ("NoDigitsHere!", False),   # no number
    ("NoSpecial123", False),    # no special char
    ("Valid#Pass1", True),      # control case
])
def test_auth_004_password_strength(client, seed, mock_auth0_admin, password, should_pass):
    r = client.post(SIGNUP, json=_payload(
        seed, email=f"pw.case.{abs(hash(password)) % 10_000}@post.jce.ac.il", password=password))
    if should_pass:
        assert r.status_code == 200, r.text
    else:
        assert r.status_code == 422, f"{password!r} should have been rejected: {r.text}"


# --- AUTH-005 (P2) — password confirmation mismatch ---
def test_auth_005_password_confirm_mismatch(client, seed):
    body = _payload(seed)
    body["password_confirm"] = "Valid#Pass2"
    r = client.post(SIGNUP, json=body)
    assert r.status_code == 422
    assert "Passwords do not match" in r.text


# --- AUTH-006 (P1) — unverified email must get 403, not 401 ---
def test_auth_006_signin_blocked_before_email_verification(client, seed, monkeypatch):
    _mock_gettoken(monkeypatch, email_verified=False)
    r = client.post(SIGNIN, json={"email": "student.a@post.jce.ac.il", "password": "Valid#Pass1"})
    assert r.status_code == 403, f"expected 403 email-not-verified, got {r.status_code}: {r.text}"
    assert "Email not verified" in r.json()["detail"]


# --- AUTH-007 (P1) — signin rate limit 10/minute ---
def test_auth_007_signin_rate_limited_after_10(client, seed, monkeypatch):
    _mock_gettoken(monkeypatch, login_exc=Exception("Wrong email or password."))
    statuses = []
    for _ in range(11):
        r = client.post(SIGNIN, json={"email": "student.a@post.jce.ac.il", "password": "wrong"})
        statuses.append(r.status_code)
    assert statuses[:10] == [401] * 10, statuses
    assert statuses[10] == 429, f"11th request should be 429, got {statuses[10]}"


# --- AUTH-008 (P1) — forgot-password anti-enumeration ---
def test_auth_008_forgot_password_identical_for_real_and_fake_email(client, seed, monkeypatch):
    monkeypatch.setattr(auth_module.requests, "post",
                        MagicMock(return_value=MagicMock(status_code=200)))
    r_real = client.post("/api/v1/forgot-password", json={"email": "student.a@post.jce.ac.il"})
    r_fake = client.post("/api/v1/forgot-password", json={"email": "no.such.user@post.jce.ac.il"})
    assert r_real.status_code == r_fake.status_code == 200
    assert r_real.json() == r_fake.json()
    assert "If an account with that email exists" in r_real.json()["message"]


# --- AUTH-009 (P1, security) — production cookie attributes ---
def test_auth_009_production_cookie_flags(client, seed, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    _mock_gettoken(monkeypatch, email_verified=True)
    r = client.post(SIGNIN, json={"email": "student.a@post.jce.ac.il", "password": "Valid#Pass1"})
    assert r.status_code == 200, r.text
    set_cookie = r.headers["set-cookie"].lower()
    assert "auth_token=" in set_cookie
    assert "httponly" in set_cookie
    assert "secure" in set_cookie
    # Documented accepted-risk (DEF-002): samesite=none in production.
    assert "samesite=none" in set_cookie


# --- AUTH-010 (P1) — /me rejects missing and garbage tokens ---
def test_auth_010_me_rejects_missing_and_invalid_token(client, seed):
    r_missing = client.get("/api/v1/me")
    assert r_missing.status_code == 401
    assert "No cookie or header found" in r_missing.json()["detail"]

    r_garbage = client.get("/api/v1/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r_garbage.status_code == 401
    assert r_garbage.json()["detail"] == "Authentication failed."


# --- Regression for the fixed enumeration oracle (relates to AUTH-008's design) ---
def test_signin_unknown_email_is_indistinguishable_from_wrong_password(client, seed, monkeypatch):
    _mock_gettoken(monkeypatch, login_exc=Exception("Wrong email or password."))
    r_unknown = client.post(SIGNIN, json={"email": "ghost@post.jce.ac.il", "password": "x"})
    r_wrongpw = client.post(SIGNIN, json={"email": "student.a@post.jce.ac.il", "password": "x"})
    assert r_unknown.status_code == r_wrongpw.status_code == 401
    assert r_unknown.json()["detail"] == r_wrongpw.json()["detail"]


# --- Regression for the new /signup rate limit ---
def test_signup_rate_limited_after_5(client, seed, mock_auth0_admin):
    # unique auth0_id per call — the shared default would trip the DB unique index
    mock_auth0_admin.users.create.side_effect = (
        lambda **kw: SimpleNamespace(user_id=f"auth0|{kw['email']}"))
    statuses = []
    for i in range(6):
        statuses.append(client.post(
            SIGNUP, json=_payload(seed, email=f"ratelimit.{i}@post.jce.ac.il")).status_code)
    assert statuses[:5] == [200] * 5, statuses
    assert statuses[5] == 429, f"6th signup should be 429, got {statuses[5]}"
