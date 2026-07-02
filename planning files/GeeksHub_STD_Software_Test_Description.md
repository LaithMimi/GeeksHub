# Software Test Description (STD) — GeeksHub

| | |
|---|---|
| **Project** | GeeksHub |
| **Parent document** | GeeksHub_STP_Software_Test_Plan.md |
| **Prepared by** | Laith Mimi |
| **Date** | 2 July 2026 |
| **Status** | Draft v1.0 — cases written, not yet executed (see STR) |

Format per case: ID, Title, Priority, Preconditions, Test Data, Steps, Expected Result, Postconditions. Grounded directly in `server/routers/*.py`, `server/utils/*.py`, and `server/models.py` — every expected result below traces to a specific line of logic, not a guess.

---

## Module: Authentication (`auth.py`)

### AUTH-001 — Signup rejected for non-institutional email
**Priority:** P1
**Preconditions:** No account exists for the test email.
**Test Data:** `email = "student@gmail.com"`, valid `major_id`, password meeting strength rules.
**Steps:**
1. `POST /api/v1/signup` with the above payload.

**Expected Result:** `400 Bad Request` — "Registration is currently restricted to Azrieli College students" (domain allow-list is `@post.jce.ac.il` only, hardcoded in `sign_up`).
**Postconditions:** No Auth0 user, no DB row created.

### AUTH-002 — Signup succeeds for valid institutional email
**Priority:** P1
**Test Data:** `email = "qa.tester1@post.jce.ac.il"`, password = `Qatest#2026`, matching `password_confirm`, valid `major_id`.
**Steps:** `POST /api/v1/signup`.
**Expected Result:** `200`, new `User` row with `role = "STUDENT"` (default, never client-supplied), `major_id` persisted correctly.
**Postconditions:** User exists in both Auth0 and Neon DB with matching `auth0_id`.

### AUTH-003 — Signup rollback on partial failure
**Priority:** P1
**Preconditions:** Simulate a DB failure after Auth0 user creation (e.g., duplicate constraint race, or temporarily point DB at an invalid table — test-env only).
**Steps:** Trigger signup such that Auth0 succeeds but the DB insert throws.
**Expected Result:** The Auth0 user created in step 2 (`auth0_id`) is deleted by the rollback branch (`admin.users.delete(auth0_id)`). No orphaned Auth0 account remains.
**Why this matters:** Without this test, an orphaned Auth0 user silently blocks that email from ever registering again — a real, hard-to-diagnose bug class.

### AUTH-004 — Password strength boundary cases
**Priority:** P1
**Test Data (each is a separate sub-case):**
| Password | Should fail because |
|---|---|
| `short1!` | < 8 chars |
| `alllowercase1!` | no uppercase |
| `NoDigitsHere!` | no number |
| `NoSpecial123` | no special char |
| `Valid#Pass1` | should PASS (control case) |

**Steps:** `POST /api/v1/signup` once per row.
**Expected Result:** All four invalid rows → `422` (Pydantic validator rejection) with the specific message from `password_strength`. The valid row → `200`.

### AUTH-005 — Password confirmation mismatch
**Priority:** P2
**Test Data:** `password = "Valid#Pass1"`, `password_confirm = "Valid#Pass2"`.
**Expected Result:** `422` — "Passwords do not match" (from `passwords_match` model validator).

### AUTH-006 — Signin blocked before email verification
**Priority:** P1
**Preconditions:** Account exists in Auth0, email not yet verified.
**Steps:** `POST /api/v1/signin` with correct credentials.
**Expected Result:** `403` — "Email not verified. Please verify your email before signing in." (decoded from `id_token.email_verified`, not trusted from client).

### AUTH-007 — Signin rate limiting
**Priority:** P1
**Steps:** Send 11 `POST /api/v1/signin` requests within 60 seconds from the same IP, using wrong passwords.
**Expected Result:** Requests 1–10 return `401` (invalid credentials). Request 11 returns `429` (`@limiter.limit("10/minute")` on `sign_in`).
**Why this matters:** This is the brute-force defense — if it doesn't actually trigger, that's a P1 defect regardless of how the rest of auth behaves.

### AUTH-008 — Forgot-password does not leak account existence
**Priority:** P1
**Test Data:** One request with a real registered email, one with a fabricated email.
**Steps:** `POST /api/v1/forgot-password` for each.
**Expected Result:** Both return the identical generic message — "If an account with that email exists…" — with identical status code and response time order of magnitude (no timing side-channel). This is a deliberate anti-enumeration design; the test must confirm the two responses are indistinguishable, not just that both are 200.

### AUTH-009 — Cookie attributes in production mode
**Priority:** P1 (security)
**Preconditions:** `ENVIRONMENT=production`.
**Steps:** Successful signin; inspect `Set-Cookie` header.
**Expected Result:** `httponly=True`, `secure=True`, `samesite=none`.
**Flag:** `samesite=none` in production is a known CSRF-exposure risk (already noted in project history). This test doesn't "fail" the code as written, but the result should be logged as an accepted risk or escalated for a fix — don't let this pass silently into the STR as a green checkmark without a note.

### AUTH-010 — `/api/v1/me` rejects missing/invalid token
**Priority:** P1
**Steps:** Call `GET /api/v1/me` with (a) no cookie/header, (b) an expired/garbage bearer token.
**Expected Result:** (a) `401` "No cookie or header found"; (b) `401` "Authentication failed" (JWKS signature/audience/issuer check fails in `get_verified_user`).

---

## Module: Role-Based Access Control (`auth_utils.py`, `directory.py`, `admin.py`)

### RBAC-001 — Student blocked from admin-only endpoints
**Priority:** P1
**Preconditions:** Logged in as a `STUDENT` role user.
**Steps:** Call each of: `GET /api/v1/admin/requests`, `POST /api/v1/admin/requests/{id}/approve`, `GET /directory/users`, `POST /directory/majors`.
**Expected Result:** All return `403` — "Admin privileges required. Your role: STUDENT".

### RBAC-002 — Moderator allowed where MODERATOR-or-ADMIN is required, blocked from ADMIN-only
**Priority:** P1
**Preconditions:** Logged in as `MODERATOR`.
**Steps:** Call an endpoint gated by `get_moderator_user`, then one gated by `get_admin_user`.
**Expected Result:** First call succeeds; second returns `403`.

### RBAC-003 — Role field cannot be self-escalated via signup or profile update
**Priority:** P1
**Steps:** Attempt `POST /api/v1/signup` with an extra `"role": "ADMIN"` field injected into the JSON body.
**Expected Result:** Ignored — `sign_up` hardcodes `role="STUDENT"` regardless of payload; the extra field has no schema binding in `UserSignUp`, so it's silently dropped, not honored.

---

## Module: File Upload (`files.py`, `upload_utils.py`)

### FILE-001 — Reject file over the real 15MB limit
**Priority:** P1
**Test Data:** A 16MB valid PDF.
**Steps:** `POST /api/v1/courses/{course_id}/upload` as an authenticated student.
**Expected Result:** `413` — "File is too large. Maximum allowed size is 15MB."

### FILE-002 — Extension/content-type mismatch rejected
**Priority:** P1
**Test Data:** A `.pdf`-renamed `.jpg` file (real JPEG bytes, `.pdf` extension, `Content-Type: application/pdf` header spoofed).
**Steps:** Upload the file.
**Expected Result:** `400` — "File content does not match its extension. Malicious file detected." (magic-byte check catches the spoof even though extension and declared MIME type both claim PDF).

### FILE-003 — Unsupported file type rejected
**Priority:** P2
**Test Data:** A `.docx` or `.exe` file.
**Expected Result:** `400` — "Invalid file extension. Allowed extensions are: .pdf, .png, .jpg, .pptx".

### FILE-004 — Frontend/backend size-limit mismatch (known defect, confirm & document)
**Priority:** P1 (defect confirmation, not new discovery)
**Test Data:** A file between 15MB and 25MB.
**Steps:** Upload via the actual UI (not raw API).
**Expected Result (current buggy behavior):** UI allows selecting/starting the upload (since it validates against 25MB client-side), then the request fails with backend's 413 — a confusing late failure instead of an immediate client-side rejection.
**Action:** Log as a confirmed P1 defect in the STR with a one-line fix recommendation: align the frontend constant to 15MB (or raise `MAX_FILE_SIZE_MB` server-side if 25MB was the actual intent — needs a product decision, not just a code fix).

### FILE-005 — Upload rate limit (10/hour per student)
**Priority:** P1
**Steps:** As one student, submit 11 valid uploads within one hour.
**Expected Result:** Uploads 1–10 succeed (`200` + `FileRequest` created with `status="pending"`). Upload 11 → `429` "Upload limit reached. You can submit up to 10 files per hour."

### FILE-006 — Non-owner cannot delete another student's pending request
**Priority:** P1
**Preconditions:** Student A has a pending `FileRequest`.
**Steps:** Student B calls `DELETE /api/v1/me/requests/{requestId}` using Student A's request ID.
**Expected Result:** Should not succeed against another user's resource — verify the ownership check exists and returns `403`/`404` rather than deleting it. *(If the current implementation doesn't filter by `user_id`, this test will surface a real IDOR-class defect — treat as P1 if found.)*

---

## Module: Admin Approval Workflow (`admin.py`)

### ADMIN-001 — Full approval happy path (data integrity across every side effect)
**Priority:** P1
**Preconditions:** A pending `FileRequest` for a valid PDF exists.
**Steps:**
1. `POST /api/v1/admin/requests/{id}/approve` as ADMIN.
2. Re-fetch: the `Material` record, the uploading student's `total_points`, the `AuditLog`, the student's notifications.

**Expected Result — all must be true, not just the 200 response:**
- `FileRequest.status` → `"approved"`.
- New `Material` row exists with the file moved out of `pending_uploads/` into `{course_name}/{filename}`.
- `PointsTransaction` of `amount = XP_UPLOAD_APPROVAL`, `action="upload_approval"` created; `User.total_points` incremented by exactly that amount (not double-counted).
- `AuditLog` row with `action="approve"`, correct `actor_id`.
- `UserNotification` created for the uploader ("Upload Approved").
- (Background task) embedding job enqueued for the new material.

**Why one test case checks six things:** This is exactly the senior-QA principle — one business behavior ("approve a file"), but validate every breakpoint around it (persistence, side effects, notifications), not just the happy-path status code.

### ADMIN-002 — PPTX approval triggers conversion to PDF
**Priority:** P1
**Preconditions:** Pending request is a `.pptx` file.
**Steps:** Approve it.
**Expected Result:** Original `.pptx` blob deleted from GCS; a `.pdf` with the same base filename exists at the final path; `Material.file_url` points to the `.pdf`, not the `.pptx`.

### ADMIN-003 — Double-approval is rejected (idempotency)
**Priority:** P1
**Preconditions:** A request already has `status="approved"`.
**Steps:** Call approve again on the same `request_id`.
**Expected Result:** `409 Conflict` — "Request already approved." No duplicate `PointsTransaction`, no duplicate points awarded.

### ADMIN-004 — Approval fulfills a matching open material request + bonus XP
**Priority:** P2
**Preconditions:** An open `MaterialRequest` exists for the same course, with `type_id` either matching or `NULL` ("any material").
**Steps:** Approve an upload of a matching type.
**Expected Result:** `MaterialRequest.status → "fulfilled"`, `fulfilled_by_request_id` set; uploader gets a second `PointsTransaction` (`action="requested_upload_bonus"`); the *requester* (if different from uploader) receives a "Your request was filled" notification.

### ADMIN-005 — Rejection and undo-approve/undo-reject state transitions
**Priority:** P2
**Steps:** Reject a pending request, then call undo-reject; separately, approve a request, then call undo-approve.
**Expected Result:** State machine returns to the correct prior state each time (`pending ↔ approved`, `pending ↔ rejected`) without orphaning the `Material` row or double-crediting/double-revoking points. This is the highest-complexity state transition in the system — worth its own dedicated pass rather than assuming symmetry with the forward action.

### ADMIN-006 — Bulk approve/reject consistency
**Priority:** P2
**Steps:** Submit `bulk-approve` with a mix of valid pending IDs and one already-approved ID.
**Expected Result:** Valid IDs process correctly; the already-approved ID is skipped/reported as an error in the response, and does not abort or corrupt processing of the other valid IDs in the batch.

---

## Module: Viewer / Completion Scoring (`viewer.py`)

### VIEW-001 — Session-start uses server-authoritative page count, not client input
**Priority:** P1
**Steps:** Start a viewer session (`POST /api/v1/me/viewer/session-start`) for a material with, say, 20 chunked pages in `MaterialChunk`.
**Expected Result:** `required_active_seconds = int(20 * 45 * 0.60) = 540`. The client cannot influence `total_pages` — it's computed server-side via `MAX(MaterialChunk.page_number)`. If no chunks exist, the fallback default of 10 pages is used.

### VIEW-002 — Heartbeat clamps active-seconds to prevent cheating
**Priority:** P1
**Test Data:** Send a heartbeat with `active_seconds_to_add = 300` (client lying to inflate progress).
**Expected Result:** Server adds only `min(300, 30) = 30` seconds (`MAX_HEARTBEAT_SECONDS = 30`), not the client-claimed 300.

### VIEW-003 — Completion score formula and 85% XP trigger
**Priority:** P1
**Test Data:** `required_active_seconds = 100`, `total_pages = 10`. Send heartbeats until `active_seconds = 90` and `visited_pages = {1..9}` (9 of 10 pages).
**Expected Result:** `time_ratio = min(90/100,1) = 0.9`; `page_ratio = 9/10 = 0.9`; `completion_score = 0.81` → **below 0.85, no XP yet**. Add one more valid page → `page_ratio = 1.0` → `completion_score = 0.9` → now ≥ 0.85: `is_complete = True`, +10 XP awarded exactly once, `UserCourseActivity.files_completed` incremented, `status` moves from `"not_started"` to `"exploring"` only if it was still `"not_started"`.

### VIEW-004 — Invalid page numbers are sanitized, not counted
**Priority:** P2
**Test Data:** `visited_pages = [0, -1, 5, 999]` where `total_pages = 10`.
**Expected Result:** Only page `5` counts (`1 <= p <= total_pages` filter); pages `0`, `-1`, `999` are discarded, not inflating `page_ratio`.

### VIEW-005 — XP is not re-awarded once complete (idempotency under concurrency)
**Priority:** P1
**Preconditions:** Session already `is_complete = True`.
**Steps:** Send another heartbeat on the same session.
**Expected Result:** Early return — `{"message": "Already complete", "score": 1.0, "isComplete": True}` — no new `PointsTransaction`, `total_points` unchanged.

### VIEW-006 — Concurrent heartbeats don't double-award XP
**Priority:** P2
**Steps:** Fire two heartbeat requests for the same session in quick succession such that both cross the 0.85 threshold simultaneously.
**Expected Result:** `PointsTransaction.source_id = f"view_{session_id}"` uniqueness constraint causes the second commit to raise `IntegrityError`, which is caught and handled by returning the already-committed state rather than crashing or double-crediting.

---

## Module: Gamification / Points Ledger

### GAM-001 — Reputation summary matches sum of ledger entries
**Priority:** P2
**Steps:** After several `PointsTransaction` entries of different `action` types for one user, call `GET /api/v1/me/reputation`.
**Expected Result:** Reported total equals `User.total_points`, which itself equals the sum of all `PointsTransaction.amount` rows for that user (cross-check the cache against the ledger — this is exactly the kind of "UI success message vs. actual backend state" check a senior tester performs by design).

### GAM-002 — Leaderboard ordering and tie-handling
**Priority:** P3
**Steps:** `GET /api/v1/reputation/leaderboard` with several users at identical point totals.
**Expected Result:** Deterministic, documented ordering (verify what the secondary sort key actually is — if none exists, that's worth flagging, not assuming).

---

## Module: Directory CRUD (`directory.py`) — Admin-only management

### DIR-001 — Course creation requires valid major/lecturer references
**Priority:** P2
**Test Data:** `POST /courses` with a non-existent `major_id`.
**Expected Result:** Rejected with a clear `4xx`, not a silent DB-level failure or a `500`.

### DIR-002 — Deleting a Major that still has Courses attached
**Priority:** P1
**Preconditions:** A `Major` has one or more `Course` rows referencing it via `major_id`.
**Steps:** `DELETE /majors/{major_id}`.
**Expected Result:** Either a blocking `409` with a clear message ("major has associated courses") or a defined cascade behavior — verify which one is actually implemented, since an unhandled FK constraint here would surface as an ugly `500` to an admin user.

### DIR-003 — Lecturer-course link create/remove round-trip
**Priority:** P3
**Steps:** `POST /lecturers/{lecturer_id}/courses/{course_id}`, then `GET /lecturers/{lecturer_id}/courses` to confirm, then `DELETE` the same link and re-`GET` to confirm removal.
**Expected Result:** Link appears after create, disappears after delete — no orphaned `CourseLecturer` rows.

---

## Module: Catalog & Tasks (student-facing core)

### CAT-001 — Courses filtered correctly by major
**Priority:** P2
**Steps:** `GET /api/v1/courses?major_id={id}` for a major with a known course set.
**Expected Result:** Only courses with that `major_id` returned; no cross-major leakage.

### TASK-001 — Task CRUD ownership isolation
**Priority:** P1
**Preconditions:** Student A creates a task via `POST /api/v1/me/tasks`.
**Steps:** Student B calls `PATCH /api/v1/me/tasks/{taskId}` or `DELETE` using Student A's task ID.
**Expected Result:** Rejected (`403`/`404`) — tasks must be scoped to `current_user`, not globally addressable by ID alone. This is the same IDOR pattern as FILE-006; if one router has the bug, check whether it's systemic across all `/me/*` resource routers (notes, notifications, pinned-courses, tasks) rather than treating each as isolated.

---

## Module: AI Assistant (`ai.py`)

### AI-001 — Assistant chat requires authentication
**Priority:** P1
**Steps:** `POST /api/v1/assistant/chat` with no auth token.
**Expected Result:** `401`, no request reaches the LLM/RAG pipeline (avoid burning API cost on unauthenticated traffic).

### AI-002 — Assistant handles empty/malformed query gracefully
**Priority:** P2
**Test Data:** Empty string message, or a message exceeding a reasonable length (e.g., 50,000 characters).
**Expected Result:** Clear `4xx` validation error, not a `500` or an expensive silent pass-through to the LLM.

### AI-003 — Assistant response relevance (manual spot-check, not automatable)
**Priority:** P3
**Steps:** Ask a question clearly answerable from a specific course's uploaded material.
**Expected Result:** Response cites/reflects that material's content, not a generic or hallucinated answer. Document actual vs. expected qualitatively — this can't be a strict pass/fail without a human judgment call, so record it as such in the STR rather than forcing a green checkmark.

---

## Summary count

| Module | P1 | P2 | P3 | Total |
|---|---|---|---|---|
| Auth | 8 | 2 | 0 | 10 |
| RBAC | 3 | 0 | 0 | 3 |
| File Upload | 5 | 1 | 0 | 6 |
| Admin Approval | 3 | 3 | 0 | 6 |
| Viewer/Scoring | 4 | 2 | 0 | 6 |
| Gamification | 0 | 1 | 1 | 2 |
| Directory | 1 | 1 | 1 | 3 |
| Catalog/Tasks | 1 | 1 | 0 | 2 |
| AI Assistant | 1 | 1 | 1 | 3 |
| **Total** | **26** | **12** | **3** | **41** |

Per the STP exit criteria: all 26 P1 cases must be executed and passing (or have a filed, triaged defect) before this cycle is considered done.
