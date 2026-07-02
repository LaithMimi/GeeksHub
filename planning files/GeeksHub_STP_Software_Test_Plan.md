
# Software Test Plan (STP) — GeeksHub

| | |
|---|---|
| **Project** | GeeksHub — AI-assisted course materials platform |
| **Repository** | github.com/LaithMimi/GeeksHub (branch: main) |
| **Document** | Software Test Plan |
| **Prepared by** | Laith Mimi |
| **Date** | 2 July 2026 |
| **Status** | Draft v1.0 |

---

## 1. Introduction

### 1.1 Purpose
This STP defines what will be tested in GeeksHub, how, by whom, with what tools, and when. It is the parent document for the Software Test Description (STD — the actual test cases) and the Software Test Report (STR — the results after execution).

### 1.2 Why this document exists right now
Grounded fact from the codebase: there is **zero automated backend test coverage**. The `server/` directory (13 FastAPI routers, ~2,900 lines across routers alone) has no `pytest` suite. The frontend has partial coverage — `authService.test.ts`, `useDashboardData.test.ts`, `useTasks.test.tsx`, `Dashboard.test.tsx`, `RequestFileModal.test.tsx`, `utils.test.ts` — but nothing for the admin approval flow, the viewer/XP scoring engine, or the AI assistant. This plan exists to close that gap in a structured way before the graduation submission, using manual test execution as the primary method (since writing 13 routers' worth of pytest fixtures from scratch is not realistic before the deadline) with automated tests reserved for the highest-risk logic.

### 1.3 System under test — actual architecture
- **Backend:** FastAPI, SQLModel + PostgreSQL (pgvector for embeddings), Auth0 (JWT via JWKS), Google Cloud Storage for file storage.
- **Routers (13):** `auth`, `files`, `ai`, `catalog`, `tasks`, `viewer`, `notifications`, `pinned_courses`, `settings`, `directory`, `activity`, `gamification`, `admin`.
- **Frontend:** React 19 + TypeScript, feature-first structure (`src/features/*`), TanStack Query, Vitest for unit tests.
- **Roles:** `STUDENT` (default), `MODERATOR`, `ADMIN` — enforced via `get_verified_user`, `get_moderator_user`, `get_admin_user` dependencies in `auth_utils.py`.

---

## 2. Scope

### 2.1 In scope
| Area | Why it's in scope |
|---|---|
| Authentication & session (`auth.py`) | Domain-restricted signup, Auth0 login, email verification gate, cookie-based session, rate limiting — highest blast radius if broken. |
| Role-based access control | Three-tier role model (`STUDENT`/`MODERATOR`/`ADMIN`) gates every admin and directory endpoint. |
| File upload pipeline (`files.py`, `upload_utils.py`) | Security-critical: magic-byte validation, size limits, upload rate limiting. Known mismatch already flagged (frontend advertises 25MB, backend enforces 15MB). |
| Admin approval workflow (`admin.py`) | Complex multi-step transaction: PPTX→PDF conversion, GCS file move, Material creation, XP award, request-fulfillment bonus, notification, audit log — many ways to partially fail. |
| Viewer / completion-scoring engine (`viewer.py`) | Custom formula (`time_ratio × page_ratio ≥ 0.85` triggers XP); directly drives gamification and is exploitable if not server-authoritative. |
| Gamification / points ledger (`gamification.py`, `PointsTransaction`) | Real "currency" in the product — idempotency (`source_id` unique constraint) must hold under concurrency. |
| Directory CRUD (`directory.py`) | Largest single router (512 lines); admin-only CRUD for users, majors, lecturers, courses, and course-lecturer links. |
| Catalog & tasks (`catalog.py`, `tasks.py`) | Core student-facing browsing and to-do functionality. |
| AI Assistant (`ai.py`) | RAG-based chat; correctness is hard to assert automatically but availability/error-handling is testable. |

### 2.2 Out of scope (for this cycle)
- Load/performance testing (no target SLA defined yet — flag as a gap, don't fake numbers).
- Penetration testing / formal security audit beyond the checks already noted in code comments (rate limits, magic bytes, CSRF).
- Auth0 and GCS themselves (third-party — tested only at the integration boundary, not internally).
- Full frontend E2E (Playwright) — testing plan exists separately (`GEEKSHUB_FRONTEND_TESTING_PLAN.md`); this STP covers backend + manual black-box testing of the frontend flows that touch it.

### 2.3 Known pre-existing issues to carry into testing (not hypothetical — already in project notes)
1. Frontend UI advertises a 25MB upload limit; backend (`upload_utils.py`) hard-enforces 15MB → user-facing false promise, will surface as a real bug in TC-FILE-004.
2. Cookie is set `samesite="none"` in production — flagged CSRF exposure; needs a dedicated negative test.
3. `user_course_activity.total_files` is not populated by current code — will produce a silent data-accuracy defect on the progress bar, not a crash, so it needs an explicit assertion or it will be missed.

---

## 3. Test Approach

Risk-based, not exhaustive. Priority = (likelihood of use) × (cost of failure), not "coverage for coverage's sake."

| Priority | Definition | Example |
|---|---|---|
| **P1 — Must pass before any release** | Breaks money/trust/security if wrong | Auth, RBAC, file upload validation, approval transaction integrity |
| **P2 — Should pass** | Breaks a core workflow but has a workaround | XP scoring edge cases, notification delivery, request-fulfillment matching |
| **P3 — Nice to verify** | Cosmetic or low-traffic | Pinned courses ordering, settings persistence |

Test types used:
- **Functional / black-box** via manual API calls (curl / Postman / Swagger UI at `/docs`) and UI walkthroughs — primary method given zero backend automation today.
- **Boundary & negative testing** — every P1 endpoint gets at least one invalid-input and one unauthorized-access case, not just the happy path.
- **State-transition testing** — `FileRequest.status` (pending → approved/rejected → undo), `MaterialRequest.status` (open → fulfilled), `FileViewingSession.is_complete` (false → true, one-way).
- **Data-persistence verification** — every write operation is checked by a follow-up read (e.g., after approve, re-fetch the material and the user's points, not just trust the 200 response).

---

## 4. Environment & Tools

| Item | Detail |
|---|---|
| Backend | Local FastAPI instance (`uvicorn server.main:app --reload`) against a **non-production** PostgreSQL + pgvector database — never test against real student data. |
| Auth | Auth0 test tenant / test user accounts with `@post.jce.ac.il` emails (required by the domain allow-list in `sign_up`). |
| Storage | GCS test bucket, separate from production `BUCKET_NAME`. |
| API tools | Swagger UI (`/docs`, auto-generated by FastAPI), Postman/Insomnia collection (to be built as a deliverable of this cycle), `curl`. |
| Frontend | Local Vite dev server; Vitest for existing/new unit tests. |
| Tracking | STD spreadsheet/doc (test cases) + STR (results log) — see Section 8. |

---

## 5. Entry & Exit Criteria

**Entry criteria** (must be true before test execution starts):
- Backend runs locally without errors against the test DB.
- Seed data available (`server/seed.py`) covering at least one Major, Course, Lecturer, MaterialType.
- At least one test account per role (STUDENT, MODERATOR, ADMIN) exists.

**Exit criteria** (must be true before calling this cycle "done"):
- 100% of P1 test cases executed with a recorded Pass/Fail (no "skipped" on P1).
- Zero open P1 defects.
- P2 defects triaged with an owner and a decision (fix now / accept / defer).
- STR published with actual dates and actual results — not placeholders.

---

## 6. Roles & Responsibilities

| Role | Who | Responsibility |
|---|---|---|
| Test author / executor | Laith Mimi | Writes STD test cases, executes them, files defects, writes STR |
| Dev (backend) | Laith Mimi | Fixes P1/P2 defects found |
| Dev (frontend, if applicable) | Mohamad Dweik / Laith | Coordinates on any UI-facing defects (e.g., the 25MB/15MB mismatch — this is a two-line frontend fix once flagged) |

---

## 7. Schedule (fit this into the graduation-submission timeline)

| Phase | Scope | Target |
|---|---|---|
| 1 | Write STD for P1 areas (auth, RBAC, upload, approval transaction) | This week |
| 2 | Execute P1 test cases, log defects | +2–3 days |
| 3 | Write + execute P2 (viewer scoring, gamification, catalog/tasks) | +2–3 days |
| 4 | Fix P1 defects found, re-test | Before report freeze |
| 5 | Publish final STR | Before graduation report submission |

Don't try to cover P3 exhaustively before the deadline — it's the least valuable use of remaining time.

---

## 8. Deliverables

1. **This STP** (scope, approach, environment, criteria).
2. **STD — Software Test Description** (the actual numbered test cases, one file per priority tier or per module).
3. **STR — Software Test Report** (execution results, defect log, sign-off).

---

## 9. Risks to the Test Effort Itself

| Risk | Impact | Mitigation |
|---|---|---|
| Only one person (Laith) writing and executing tests | Confirmation bias — you already know how it "should" work, which makes you gentler on your own code | Deliberately write the negative/abuse case *before* the happy-path case for each P1 endpoint |
| No backend pytest today means every re-test after a fix is manual | Slow feedback loop, temptation to skip re-testing | At minimum, convert the P1 test cases into pytest as you go — even a thin suite beats zero |
| Time pressure from graduation deadline | P3 areas get silently skipped and nobody decides that on purpose | Exit criteria above forces an explicit decision, not a silent omission |
