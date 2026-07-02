"""STD Module: Admin Approval Workflow — ADMIN-001..005 (004/005 are P2, included:
they validate the undo-approve and reject-guard fixes).

GCS is a MagicMock; the Gemini embedding background task is replaced with a
recording stub so ADMIN-001 can still assert "embedding job enqueued".
"""
import pytest
from sqlmodel import select

import routers.admin as admin_module
from models import (
    AuditLog, FileRequest, Material, MaterialRequest, PointsTransaction,
    User, UserNotification,
)


@pytest.fixture()
def embed_stub(monkeypatch):
    calls = []
    monkeypatch.setattr(admin_module, "embed_single",
                        lambda material_id, gcs_path: calls.append((material_id, gcs_path)))
    monkeypatch.setattr(admin_module, "embed_batch", lambda batch: calls.extend(batch))
    return calls


def _pending_request(db, seed, filename="upload_ab12.pdf", user_id=None):
    req = FileRequest(
        user_id=user_id or seed.student_a_id, course_id=seed.course_id,
        type_id=seed.type_id, lecturer_id=seed.lecturer_id,
        title="Midterm 2025", academic_year=1, material_year=2025,
        file_url=f"pending_uploads/{filename}", status="pending",
    )
    db.add(req); db.commit(); db.refresh(req)
    return req


# --- ADMIN-001 (P1) — approval happy path: every side effect verified ---
def test_admin_001_approve_happy_path_all_side_effects(client, seed, as_user, db, embed_stub):
    req = _pending_request(db, seed)
    as_user(seed.admin_id)

    r = client.post(f"/api/v1/admin/requests/{req.id}/approve")
    assert r.status_code == 200, r.text

    db.expire_all()
    # 1. Status transition
    assert db.get(FileRequest, req.id).status == "approved"
    # 2. Material created at the final (non-pending) path
    material = db.get(Material, req.id)
    assert material is not None
    assert material.file_url == "Intro_to_SE/upload_ab12.pdf"
    assert material.uploader_id == seed.student_a_id
    # 3. Exactly one XP transaction, and the cache matches
    txs = db.exec(select(PointsTransaction).where(
        PointsTransaction.request_id == req.id)).all()
    assert len(txs) == 1
    assert txs[0].amount == admin_module.XP_UPLOAD_APPROVAL
    assert txs[0].action == "upload_approval"
    assert db.get(User, seed.student_a_id).total_points == admin_module.XP_UPLOAD_APPROVAL
    # 4. Audit log
    audit = db.exec(select(AuditLog).where(AuditLog.action == "approve")).first()
    assert audit is not None and audit.actor_id == seed.admin_id
    # 5. Uploader notification
    notif = db.exec(select(UserNotification).where(
        UserNotification.user_id == seed.student_a_id)).first()
    assert notif is not None and notif.title == "Upload Approved"
    # 6. Embedding job enqueued for the new material
    assert embed_stub == [(str(req.id), "Intro_to_SE/upload_ab12.pdf")]


# --- ADMIN-002 (P1) — PPTX approval converts to PDF ---
def test_admin_002_pptx_approval_converts_to_pdf(client, seed, as_user, db,
                                                 embed_stub, monkeypatch):
    monkeypatch.setattr(admin_module, "convert_pptx_to_pdf",
                        lambda pptx_bytes: b"%PDF-1.4 converted")
    req = _pending_request(db, seed, filename="slides_xy99.pptx")
    as_user(seed.admin_id)

    r = client.post(f"/api/v1/admin/requests/{req.id}/approve")
    assert r.status_code == 200, r.text

    db.expire_all()
    material = db.get(Material, req.id)
    assert material.file_url == "Intro_to_SE/slides_xy99.pdf"  # .pdf, not .pptx

    # GCS interactions (on the mock): PDF uploaded, original PPTX deleted.
    from utils.shared import storage_client
    bucket = storage_client.bucket.return_value
    uploaded_paths = [c.args[0] for c in bucket.blob.call_args_list]
    assert "pending_uploads/slides_xy99.pptx" in uploaded_paths
    assert "Intro_to_SE/slides_xy99.pdf" in uploaded_paths
    assert bucket.blob.return_value.upload_from_string.called
    assert bucket.blob.return_value.delete.called


# --- ADMIN-003 (P1) — double approval rejected, no double XP ---
def test_admin_003_double_approval_conflict(client, seed, as_user, db, embed_stub):
    req = _pending_request(db, seed)
    as_user(seed.admin_id)

    assert client.post(f"/api/v1/admin/requests/{req.id}/approve").status_code == 200
    r2 = client.post(f"/api/v1/admin/requests/{req.id}/approve")
    assert r2.status_code == 409
    assert "already approved" in r2.json()["detail"].lower()

    db.expire_all()
    txs = db.exec(select(PointsTransaction).where(
        PointsTransaction.request_id == req.id)).all()
    assert len(txs) == 1, "double approval must not double-award XP"
    assert db.get(User, seed.student_a_id).total_points == admin_module.XP_UPLOAD_APPROVAL


# --- ADMIN-004 (P2) — approval fulfills an open material request + bonus XP ---
def test_admin_004_approval_fulfills_material_request(client, seed, as_user, db, embed_stub):
    mr = MaterialRequest(course_id=seed.course_id, type_id=None,  # None = any type
                         requested_by=seed.student_b_id, status="open")
    db.add(mr); db.commit(); db.refresh(mr)
    req = _pending_request(db, seed)
    as_user(seed.admin_id)

    assert client.post(f"/api/v1/admin/requests/{req.id}/approve").status_code == 200

    db.expire_all()
    mr = db.get(MaterialRequest, mr.id)
    assert mr.status == "fulfilled"
    assert mr.fulfilled_by_request_id == req.id

    actions = {t.action for t in db.exec(select(PointsTransaction).where(
        PointsTransaction.request_id == req.id)).all()}
    assert actions == {"upload_approval", "requested_upload_bonus"}
    expected = admin_module.XP_UPLOAD_APPROVAL + admin_module.XP_REQUESTED_UPLOAD_BONUS
    assert db.get(User, seed.student_a_id).total_points == expected

    requester_notifs = db.exec(select(UserNotification).where(
        UserNotification.user_id == seed.student_b_id)).all()
    assert any(n.title == "Your request was filled" for n in requester_notifs)


# --- ADMIN-005 (P2) — reject/undo state machine, incl. the new guards ---
def test_admin_005_reject_and_undo_state_machine(client, seed, as_user, db, embed_stub):
    as_user(seed.admin_id)

    # pending → rejected → (undo) → pending
    req = _pending_request(db, seed)
    r = client.post(f"/api/v1/admin/requests/{req.id}/reject", json={"note": "blurry scan"})
    assert r.status_code == 200
    db.expire_all()
    assert db.get(FileRequest, req.id).status == "rejected"
    assert db.get(FileRequest, req.id).admin_note == "blurry scan"

    assert client.post(f"/api/v1/admin/requests/{req.id}/undo-reject").status_code == 200
    db.expire_all()
    assert db.get(FileRequest, req.id).status == "pending"
    assert db.get(FileRequest, req.id).admin_note is None

    # pending → approved → (undo) → pending, with full cleanup
    mr = MaterialRequest(course_id=seed.course_id, type_id=None,
                         requested_by=seed.student_b_id, status="open")
    db.add(mr); db.commit(); db.refresh(mr)

    assert client.post(f"/api/v1/admin/requests/{req.id}/approve").status_code == 200
    db.expire_all()
    assert db.get(FileRequest, req.id).status == "approved"
    points_after_approve = db.get(User, seed.student_a_id).total_points
    assert points_after_approve == (admin_module.XP_UPLOAD_APPROVAL
                                    + admin_module.XP_REQUESTED_UPLOAD_BONUS)

    # Guard (fix for defect): an approved request cannot be rejected directly
    r_reject_approved = client.post(f"/api/v1/admin/requests/{req.id}/reject",
                                    json={"note": "nope"})
    assert r_reject_approved.status_code == 409

    assert client.post(f"/api/v1/admin/requests/{req.id}/undo-approve").status_code == 200
    db.expire_all()
    assert db.get(FileRequest, req.id).status == "pending"
    assert db.get(Material, req.id) is None, "Material must not be orphaned"
    # ALL XP revoked — including the fulfillment bonus (fixed defect)
    assert db.get(User, seed.student_a_id).total_points == 0
    assert db.exec(select(PointsTransaction).where(
        PointsTransaction.request_id == req.id)).first() is None
    # Fulfilled material request re-opened (fixed defect)
    mr = db.get(MaterialRequest, mr.id)
    assert mr.status == "open" and mr.fulfilled_by_request_id is None
    # The blob was moved back → file_url points at pending_uploads again
    assert db.get(FileRequest, req.id).file_url.startswith("pending_uploads/")

    # Re-approve after undo must work (was a stuck-state defect before the fix)
    assert client.post(f"/api/v1/admin/requests/{req.id}/approve").status_code == 200
