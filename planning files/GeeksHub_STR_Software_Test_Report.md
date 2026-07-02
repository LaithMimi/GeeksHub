# Software Test Report (STR) — GeeksHub

| | |
|---|---|
| **Project** | GeeksHub |
| **Parent documents** | GeeksHub_STP_Software_Test_Plan.md, GeeksHub_STD_Software_Test_Description.md |
| **Prepared by** | Laith Mimi (execution assisted by Claude Code) |
| **Date** | 2 July 2026 |
| **Status** | **Executed — cycle 1 complete** |

---

## Execution environment & method

- **Backend:** FastAPI app under `pytest` 9.1.1 + `TestClient` (httpx), against a **disposable local Postgres 17 + pgvector Docker container** (`localhost:55432`). The production Neon database and GCS bucket were never touched; the test harness hard-aborts if `DATABASE_URL` points anywhere but the local container.
- **External boundaries mocked:** Auth0 (`get_auth0_admin` / `GetToken` / password-reset POST), Google Cloud Storage (client is a `MagicMock`), Gemini embedding (background task stubbed). Everything on GeeksHub's side of those boundaries — validation, rollback logic, rate limiting, state machines, XP ledger, RBAC — executed for real. Rows that depend on the mocked boundary say so in their Actual Result.
- **Backend suite:** `server/tests/` — 43 tests, **43 passed** (2026-07-02).
- **Frontend suite:** `npx vitest run` — 6 files (authService, useDashboardData, useTasks, Dashboard, RequestFileModal, utils), **36/36 passed** (2026-07-02). `tsc -b --noEmit` clean.
- **Important context:** the STD was written against the pre-fix codebase. A code review on 2026-07-02 found and fixed 7 defects (DEF-004…DEF-010 below) **before** this execution run, so several rows below are "Pass (after fix)" — they would have failed against the reviewed commit `d4e7b01`.

## STD errata found during execution

1. **FILE-004 premise outdated:** the 25MB-vs-15MB size mismatch no longer exists (frontend constant is 15MB). The *live* defect of that class was the extension list (`.ppt`/`.docx` accepted client-side, rejected server-side) — logged as DEF-010, fixed.
2. **RBAC-001 expected message wrong for directory routes:** `/api/v1/directory/*` is gated by `get_moderator_user`, so a student gets 403 "Moderator privileges required." — not "Admin privileges required". The 403 itself holds.
3. **STD summary-count arithmetic:** the case list contains **27 P1 / 11 P2 / 3 P3** rows (Auth has 9 P1 cases, not 8), while the STD summary table claims 26/12/3.
4. **Route paths:** directory endpoints live under `/api/v1/directory/*`, not `/directory/*` as written in RBAC-001.

---

## 1. Execution Summary

| Metric | Value |
|---|---|
| Total test cases (STD) | 41 |
| Executed | 37 (27 P1, 10 P2) |
| Passed | 35 (27 P1, 8 P2) |
| Passed with caveat | 1 (VIEW-006 — deterministic dedupe verified, true parallel race not exercised) |
| Failed (open defect) | 1 (AI-002 — empty-message validation gap, DEF-012) |
| Blocked | 0 |
| Not executed | 4 (ADMIN-006 P2; GAM-002, DIR-003, AI-003 P3 — deliberate scope decision per STP §7) |
| P1 cases executed / required | **27 / 27 (100%)** |
| Open P1 defects | **0** (2 found in review, fixed & re-verified same day) |
| **Exit criteria met (per STP §5)?** | **Yes** — 100% of P1 executed, zero open P1 defects, P2 defects triaged below |

---

## 2. Results Log

Backend rows executed via `server/tests/test_p1_*.py` on 2026-07-02. "Auth0 mocked" = the Auth0 SDK boundary was faked; GeeksHub-side logic ran for real.

| Test Case ID | Priority | Status | Actual Result | Defect ID | Date | Tested By |
|---|---|---|---|---|---|---|
| AUTH-001 | P1 | Pass | 400 "restricted to Azrieli College students"; no DB row created | | 2026-07-02 | pytest (`test_auth_001`) |
| AUTH-002 | P1 | Pass | 200; DB row with role=STUDENT, correct major_id + auth0_id (Auth0 mocked) | | 2026-07-02 | pytest |
| AUTH-003 | P1 | Pass | FK failure after Auth0 create → `users.delete(auth0_id)` called exactly once, no orphan DB row (Auth0 mocked; DB failure real) | | 2026-07-02 | pytest |
| AUTH-004 | P1 | Pass | 4 invalid passwords → 422 with the specific validator message; control case → 200 | | 2026-07-02 | pytest (5 sub-cases) |
| AUTH-005 | P2 | Pass | 422 "Passwords do not match" | | 2026-07-02 | pytest |
| AUTH-006 | P1 | **Pass (after fix)** | Pre-fix code swallowed the 403 into 401 "Invalid email or password" — found in review, fixed; now returns 403 "Email not verified" | DEF-004 (fixed) | 2026-07-02 | pytest |
| AUTH-007 | P1 | **Pass (after fix)** | Requests 1–10 → 401, request 11 → 429. Note: worked only after registering the slowapi exception handler (DEF-009) | DEF-009 (fixed) | 2026-07-02 | pytest |
| AUTH-008 | P1 | Pass | Real and fabricated email return byte-identical 200 body (Auth0 POST mocked; timing side-channel not measured) | | 2026-07-02 | pytest |
| AUTH-009 | P1 | Pass w/ noted risk | `ENVIRONMENT=production` → cookie is `HttpOnly; Secure; SameSite=None`. Matches code as written; `SameSite=None` remains an accepted-risk decision | DEF-002 (open decision) | 2026-07-02 | pytest |
| AUTH-010 | P1 | Pass | No token → 401 "No cookie or header found"; garbage bearer → 401 "Authentication failed." | | 2026-07-02 | pytest |
| RBAC-001 | P1 | Pass | All four endpoints → 403. Admin routes say "Admin privileges required. Your role: STUDENT"; directory routes say "Moderator privileges required." (STD erratum 2) | | 2026-07-02 | pytest |
| RBAC-002 | P1 | Pass | Moderator: directory 200, admin 403 | | 2026-07-02 | pytest |
| RBAC-003 | P1 | Pass | Injected `"role": "ADMIN"` silently dropped; created user is STUDENT | | 2026-07-02 | pytest |
| FILE-001 | P1 | Pass | 16MB PDF → 413 "Maximum allowed size is 15MB." | | 2026-07-02 | pytest |
| FILE-002 | P1 | Pass | JPEG bytes named `.pdf` with spoofed Content-Type → 400 "File content does not match its extension"; no FileRequest row | | 2026-07-02 | pytest |
| FILE-003 | P2 | Pass | `.docx` → 400 "Invalid file extension. Allowed extensions are: .pdf, .png, .jpg, .pptx" | | 2026-07-02 | pytest |
| FILE-004 | P1 | **Pass (after fix)** | Size halves already aligned at 15MB (DEF-001 fixed prior). Surviving defect was the extension list — `.ppt`/`.docx` accepted client-side, rejected server-side; fixed in `useRequestForm.ts`/`StepUpload.tsx`, verified by frontend unit suite (36/36). Method: code verification + Vitest, not a manual UI walkthrough | DEF-001, DEF-010 (both fixed) | 2026-07-02 | Vitest + code review |
| FILE-005 | P1 | Pass | 10 uploads in the window, 11th → 429 "Upload limit reached." | | 2026-07-02 | pytest |
| FILE-006 | P1 | Pass | Student B deleting A's pending request → 404; row survives. No IDOR | | 2026-07-02 | pytest |
| ADMIN-001 | P1 | Pass | All six side effects verified: status=approved, Material at final path, exactly one +25 XP transaction, total_points cache correct, AuditLog(actor=admin), "Upload Approved" notification, embedding job enqueued (GCS/Gemini mocked) | | 2026-07-02 | pytest |
| ADMIN-002 | P1 | Pass | `.pptx` approval → Material.file_url is the `.pdf`; PDF uploaded and original PPTX deleted on the (mocked) bucket; conversion function stubbed | | 2026-07-02 | pytest |
| ADMIN-003 | P1 | Pass | Second approve → 409 "Request already approved."; still exactly one PointsTransaction, points not doubled | | 2026-07-02 | pytest |
| ADMIN-004 | P2 | Pass | Open MaterialRequest (type=NULL) → fulfilled + `fulfilled_by_request_id` set; both `upload_approval` and `requested_upload_bonus` awarded (50 total); requester notified | | 2026-07-02 | pytest |
| ADMIN-005 | P2 | **Pass (after fix)** | Full state machine: pending↔rejected (note cleared on undo), pending↔approved with complete cleanup — ALL XP revoked incl. bonus, Material deleted, MaterialRequest re-opened, blob moved back, re-approve works. Pre-fix code failed 4 of those assertions | DEF-005, DEF-006 (fixed) | 2026-07-02 | pytest |
| ADMIN-006 | P2 | Not Executed | Bulk approve/reject mixed-batch behavior not tested this cycle; code review found bulk paths skip non-pending IDs silently and (unlike single approve) award no fulfillment bonus and send no uploader notification | DEF-013 (open) | | |
| VIEW-001 | P1 | Pass | 20 chunks → `required_active_seconds=540`, `total_pages=20` (server-side); no chunks → fallback 10 pages / 270s | | 2026-07-02 | pytest |
| VIEW-002 | P1 | Pass | Client claims 300s → server adds exactly 30 | | 2026-07-02 | pytest |
| VIEW-003 | P1 | Pass | 90s/9-of-10 pages → score 0.81, no XP; 10th page → 0.9 ≥ 0.85 → +10 XP once, files_completed=1, status not_started→exploring | | 2026-07-02 | pytest |
| VIEW-004 | P2 | Pass | `[0, -1, 5, 999]` with 10 pages → only page 5 counts (score 0.03 exactly) | | 2026-07-02 | pytest |
| VIEW-005 | P1 | Pass | Post-completion heartbeat → `{"message": "Already complete", "score": 1.0, "isComplete": true}`; ledger and total unchanged | | 2026-07-02 | pytest |
| VIEW-006 | P2 | Pass w/ caveat | Idempotency verified deterministically: a second full session on the same file awards nothing (per-user+file `source_id` after DEF-007 fix; `IntegrityError` handler remains as race backstop). A true two-request parallel race was **not** reproduced — TestClient is single-process | DEF-007 (fixed) | 2026-07-02 | pytest |
| GAM-001 | P2 | Pass | `/me/reputation` totalPoints == User.total_points == Σ ledger amounts (35 == 35 == 35) | | 2026-07-02 | pytest |
| GAM-002 | P3 | Not Executed | Code review note: leaderboard has no secondary sort key — tie order nondeterministic (`gamification.py:41`) | DEF-014 (open) | | |
| DIR-001 | P2 | Pass | Course create with nonexistent majorId → clean 4xx, not a 500 | | 2026-07-02 | pytest |
| DIR-002 | P1 | Pass | Deleting a major with courses → 409 "This major has courses or users and cannot be deleted." | | 2026-07-02 | pytest |
| DIR-003 | P3 | Not Executed | Deliberately descoped per STP §7 (P3) | | | |
| CAT-001 | P2 | Pass | `?major_id=` filter returns only that major's courses; no cross-major leakage | | 2026-07-02 | pytest |
| TASK-001 | P1 | Pass | Student B PATCH/DELETE on A's task → 404 both; task untouched. No IDOR | | 2026-07-02 | pytest |
| AI-001 | P1 | Pass | Unauthenticated `/assistant/chat` → 401 before any model/RAG work | | 2026-07-02 | pytest |
| AI-002 | P2 | **Fail (partial)** | >2000-char message → 422 ✔. Empty-string message passes Pydantic (no `min_length`) and reaches the endpoint ✘ — would be forwarded to Gemini for a real file | DEF-012 (open) | 2026-07-02 | pytest |
| AI-003 | P3 | Not Executed | Requires a live Gemini call + human relevance judgment; out of scope for the mocked harness. Cannot honestly be executed without a real (billed) LLM environment | | | |

---

## 3. Defect Log

| Defect ID | Severity | Related Test Case | Description | Recommended Fix | Status |
|---|---|---|---|---|---|
| DEF-001 | P1 | FILE-004 | Frontend advertised 25MB, backend enforces 15MB. | Align frontend constant to 15MB. | **Fixed** (prior to this cycle — `useRequestForm.ts` MAX_FILE_SIZE = 15MB with comment tying it to the backend). Verified 2026-07-02. |
| DEF-002 | Info / accepted-risk | AUTH-009 | `SameSite=None` cookie in production — CSRF exposure pattern. Confirmed by execution. | Decide explicitly: accept with written rationale, or add CSRF token / switch to `Lax` with same-site deployment. | **Needs decision** (unchanged) |
| DEF-003 | P2 | (no STD case) | `UserCourseActivity.total_files` never populated — progress UIs reading it show silently wrong data. | Populate on approval or remove from UI. Add an STD case. | Open |
| DEF-004 | **P1** | AUTH-006 | `sign_in`'s blanket `except Exception` swallowed the 403 "Email not verified" and re-raised it as 401 "Invalid email or password" — the frontend's verify-your-email branch was unreachable dead code. | `except HTTPException: raise` before the generic handler (`auth.py`). | **Fixed & verified** 2026-07-02 |
| DEF-005 | **P1** | ADMIN-005 | `reject_request` had no status guard: rejecting an already-approved request left the Material live in the catalog and XP awarded while status read "rejected". | 409 on non-pending (`admin.py`). | **Fixed & verified** 2026-07-02 |
| DEF-006 | P2 | ADMIN-005 | `undo_approve` revoked only the first PointsTransaction (bonus XP survived), never re-opened fulfilled MaterialRequests, never moved the GCS blob back — undone requests were un-re-approvable. | Revoke all transactions, re-open requests, rename blob back + update `file_url`. | **Fixed & verified** 2026-07-02 |
| DEF-007 | P2 | VIEW-006 | XP farming: `source_id` was per-session; unlimited fresh sessions on one file each paid +10 XP. | `source_id = view_{user_id}_{file_id}` + already-awarded check. Note: pre-existing ledger rows use the old key, so each user can earn one final +10 per previously-completed file — bounded, or backfill old rows. | **Fixed & verified** 2026-07-02 |
| DEF-008 | P2 | AUTH-008 (design) | Signin returned 404 "No account found. Please sign up." — account-enumeration oracle defeating forgot-password's anti-enumeration design. | Generic 401, identical to wrong-password. | **Fixed & verified** 2026-07-02 |
| DEF-009 | P2 | AUTH-007 | `/signup` had no rate limit, and `main.py` never registered `app.state.limiter` / the `RateLimitExceeded` handler — tripping any limit produced an unhandled-exception 500 path instead of a clean 429. | 5/min on signup; register handler in `main.py`. | **Fixed & verified** 2026-07-02 (both 429 tests pass) |
| DEF-010 | P2 | FILE-004 | Successor to DEF-001: frontend accepted `.ppt`/`.docx` (validator, `accept` attr, two labels) that the backend rejects → late-failure UX. | Remove from `ALLOWED_EXTENSIONS`, `accept`, labels. | **Fixed** 2026-07-02, Vitest green |
| DEF-011 | P2 | ADMIN-001 (edge) | **Open partial-failure window:** in `approve_file`/`bulk_approve` the GCS move runs before the single DB commit. If the commit fails, the blob has left `pending_uploads/` but the request stays pending with a stale `file_url` → preview broken, re-approval fails rename, request stuck. | Compensating rename-back on commit failure, or move the blob after commit. | **Open** — not in the approved fix batch |
| DEF-012 | P3 | AI-002 | Empty-string assistant message passes validation and would be forwarded to Gemini (wasted spend). | `message: Field(min_length=1)` in `AIChatRequest`. | Open |
| DEF-013 | P3 | ADMIN-006 | Bulk approve: silently skips non-pending IDs (count only, no per-ID errors), and unlike single approve awards no fulfillment bonus and sends no uploader notification. | Return per-ID results; extract shared approval logic. | Open |
| DEF-014 | P3 | GAM-002 | Leaderboard has no secondary sort → nondeterministic tie order. | Add secondary `order_by`. | Open |
| DEF-015 | P3 | — (code review) | Batch of review findings: upload doesn't validate course/lecturer/type FK ids (500 instead of 4xx); `active_seconds_to_add` accepts negatives; approve allows rejected→approved directly; Auth0 rollback delete unguarded (orphan + 500 if the delete throws); `auth_utils` swallows its 403 into 401 (same pattern as DEF-004, benign effect). | Individual small fixes; none release-blocking. | Open |

---

## 4. Coverage Gaps & Deliberate Scope Decisions

- **IDOR sweep across `/me/*`: DONE and clean.** Beyond FILE-006/TASK-001, code review verified ownership scoping in notes, notifications, pinned-courses, settings, activity, and viewer sessions (`user_id` filter present in every resource-by-ID path). The suspected systemic gap does not exist.
- **True concurrency (VIEW-006):** only the deterministic equivalent was executed; a parallel-race harness (two processes) remains future work. The DB unique constraint is the real guarantee either way.
- **Auth0/GCS/Gemini internals:** tested at the boundary only (mocked), per STP §2.2. Rows relying on mocks are labeled. A staging-tenant smoke test (real Auth0 signup→verify→signin) is recommended before release but was not executable here without live test-tenant credentials.
- **ADMIN-006, DIR-003, GAM-002, AI-003:** not executed — explicit scope decision, not an oversight (STP §7: don't burn deadline time on P3).
- **Load/performance:** out of scope per STP §2.2.

---

## 5. Sign-off

**Cycle 1 verdict: exit criteria met.** 27/27 P1 cases executed with real results; both P1 defects found (DEF-004, DEF-005) were fixed and re-verified the same day; remaining open items are one P2 (DEF-011, triaged: fix before release), one decision (DEF-002), and P3 polish. The backend now has a 43-test pytest suite (`server/tests/`) that re-runs in ~5s against a disposable container — every re-test after future fixes is no longer manual.

Top 3 defects by severity this cycle: **DEF-004** (unverified-email 403 masked as wrong-password), **DEF-005** (reject-after-approve state desync), **DEF-011** (GCS/DB partial-failure window — still open).
