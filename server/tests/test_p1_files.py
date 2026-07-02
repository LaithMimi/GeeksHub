"""STD Module: File Upload — FILE-001, 002, 003(P2), 005, 006.

FILE-004 is a UI walkthrough case — executed via the frontend Vitest suite +
code verification, recorded directly in the STR (see DEF-001 history).
GCS is a MagicMock: upload never leaves the process.
"""
import datetime
import io

from sqlmodel import select

from models import FileRequest

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PDF_BYTES = b"%PDF-1.4\n" + b"0" * 64


def _upload(client, seed, *, filename="notes.pdf", content=PDF_BYTES,
            content_type="application/pdf"):
    return client.post(
        f"/api/v1/courses/{seed.course_id}/upload",
        data={
            "title": "Test Upload",
            "academic_year": 1,
            "material_year": 2025,
            "type_id": str(seed.type_id),
            "lecturer_id": str(seed.lecturer_id),
        },
        files={"file": (filename, io.BytesIO(content), content_type)},
    )


# --- FILE-001 (P1) — >15MB rejected with 413 ---
def test_file_001_oversize_rejected(client, seed, as_user):
    as_user(seed.student_a_id)
    sixteen_mb = b"%PDF-1.4\n" + b"0" * (16 * 1024 * 1024)
    r = _upload(client, seed, content=sixteen_mb)
    assert r.status_code == 413
    assert "Maximum allowed size is 15MB" in r.json()["detail"]


# --- FILE-002 (P1) — spoofed extension/content-type caught by magic bytes ---
def test_file_002_magic_byte_spoof_rejected(client, seed, as_user, db):
    as_user(seed.student_a_id)
    r = _upload(client, seed, filename="really-a-jpeg.pdf", content=JPEG_BYTES,
                content_type="application/pdf")
    assert r.status_code == 400
    assert "File content does not match its extension" in r.json()["detail"]
    assert db.exec(select(FileRequest)).first() is None


# --- FILE-003 (P2) — unsupported extension rejected ---
def test_file_003_unsupported_extension_rejected(client, seed, as_user):
    as_user(seed.student_a_id)
    r = _upload(client, seed, filename="cv.docx", content=b"PK\x03\x04" + b"0" * 32,
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    assert r.status_code == 400
    assert "Invalid file extension" in r.json()["detail"]


# --- FILE-005 (P1) — 10 uploads/hour cap ---
def test_file_005_upload_rate_limit(client, seed, as_user, db):
    as_user(seed.student_a_id)
    now = datetime.datetime.now(datetime.timezone.utc)
    for i in range(10):
        db.add(FileRequest(
            user_id=seed.student_a_id, course_id=seed.course_id,
            type_id=seed.type_id, lecturer_id=seed.lecturer_id,
            title=f"prior {i}", academic_year=1, material_year=2025,
            file_url=f"pending_uploads/prior_{i}.pdf", status="pending",
            created_at=now,
        ))
    db.commit()

    r = _upload(client, seed)
    assert r.status_code == 429
    assert "Upload limit reached" in r.json()["detail"]


# --- FILE-006 (P1) — non-owner cannot withdraw someone else's pending request ---
def test_file_006_non_owner_cannot_delete_request(client, seed, as_user, db):
    req = FileRequest(
        user_id=seed.student_a_id, course_id=seed.course_id,
        type_id=seed.type_id, lecturer_id=seed.lecturer_id,
        title="A's pending upload", academic_year=1, material_year=2025,
        file_url="pending_uploads/a_file.pdf", status="pending",
    )
    db.add(req); db.commit(); db.refresh(req)

    as_user(seed.student_b_id)
    r = client.delete(f"/api/v1/me/requests/{req.id}")
    assert r.status_code == 404  # not found *for B* — no existence leak, no deletion

    db.expire_all()
    assert db.get(FileRequest, req.id) is not None, "B must not delete A's request"
