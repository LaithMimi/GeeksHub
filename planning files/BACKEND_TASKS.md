# GeeksHub — Backend Implementation Tasks

> **For:** Backend Engineer
> **Frontend Stack:** React + TypeScript + TanStack Query
> **Backend Stack:** FastAPI + SQLModel + Neon PostgreSQL + Auth0 + Google Cloud Storage
> **Last Updated:** May 17, 2026

---

## How to Read This Document

The frontend has been **fully migrated** off `mock-db.ts`. Every service function now calls a real endpoint via `apiClient.ts` (`credentials: "include"`, base URL `/api/v1`).

- ✅ = Endpoint exists and is working in `main.py`
- 🔴 = **Frontend is calling this endpoint, but it doesn't exist yet** — the app will break here
- 🟡 = Frontend still uses localStorage/mock locally — implement when ready

---

## 1. Tech Stack & Conventions

| Item | Convention |
|------|-----------|
| **Base URL** | `/api/v1` |
| **Auth** | `HttpOnly` JWT cookie (`auth_token`) — sent via `credentials: "include"` |
| **User context** | Protected endpoints use `Depends(get_verified_user)` |
| **Admin check** | Use `Depends(get_admin_user)` |
| **Responses** | JSON with HTTP status codes |
| **Errors** | `HTTPException` with `{ detail: "..." }` |
| **Pagination** | `?page=1&limit=20` → `{ data: T[], total: number }` |
| **Timestamps** | ISO 8601 (`2026-03-19T00:00:00Z`) |
| **Data Format** | Always use `snake_case` for JSON responses and request bodies. The frontend's `apiClient.ts` automatically translates your responses to `camelCase` for React state! |

---

## 2. Database Schema (Current State)

These tables **exist** in `server/models.py`:

| Table | Model | Notes |
|-------|-------|-------|
| `users` | `User` | Has `major_id` FK to `majors`. **MUST ADD**: `bio` (text), `university` (text), `avatar_url` (text), `last_login_at` (timestamp) for Profile Page. |
| `majors` | `Major` | `id` is UUID, has `name` + `slug` |
| `courses` | `Course` | Has `major_id`, `year_id` (int), `semester` (int) |
| `lecturers` | `Lecturer` | `id` (UUID), `name`, `email` |
| `material_types` | `MaterialType` | `id` (string slug), `display_name` (must include 'homework') |
| `files` | `File` | Approved files with `course_id`, `type`, `lecturer`, `file_url` |
| `file_requests` | `FileRequest` | Pending uploads with `lecturer_id` FK, `type_id` FK |

### Tables That Need to Be Created

| Table | Purpose |
|-------|---------|
| `points_transactions` | Points ledger for reputation (`user_id`, `amount`, `reason`, `source_id` → idempotent) |
| `audit_logs` | Admin action log (`actor_id`, `action`, `target_ids`, `metadata`) |
| `user_recent_files` | Recently viewed files per user (`user_id`, `file_id`, `viewed_at`) |
| `file_viewing_sessions` | Tracks a single student's viewing session for a specific file (`id`, `user_id`, `file_id`, `course_id`, `started_at`, `active_seconds`, `completion_score`, `is_complete`) |
| `user_course_activity` | Materialized activity state per user per course (`user_id`, `course_id`, `status`, `files_completed`, `total_files`) |
| `user_platform_sessions` | Drives the 25-minute break and +2 points interval system (`id`, `user_id`, `started_at`, `active_seconds`, `intervals_awarded`) |
| `motivational_quotes` | Quotes shown on course completion (`id`, `text`, `author`, `is_active`) |

---

## 3. Authentication — ✅ COMPLETED

| Method | Endpoint | Status |
|--------|----------|--------|
| `POST` | `/api/v1/signup` | ✅ |
| `POST` | `/api/v1/signin` | ✅ |
| `POST` | `/api/v1/signout` | ✅ |
| `POST` | `/api/v1/forgot-password` | ✅ |
| `GET` | `/api/v1/me` | ✅ |

---

## 4. Catalog API

> **Frontend source:** `src/services/catalogService.ts`

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `GET` | `/api/v1/majors` | `listMajors()` | ✅ |
| `GET` | `/api/v1/types` | `listTypes()` | ✅ |
| `GET` | `/api/v1/courses?major_id=&year_id=&query=` | `listCourses(filters)` | ✅ |
| `GET` | `/api/v1/courses/{course_id}` | `getCourse(courseId)` | ✅ |
| `GET` | `/api/v1/lecturers?course_id=` | `listLecturers(filters)` | ✅ |

### Implementation Notes



**`GET /courses/{course_id}`** — Simple single-row lookup:
```python
@app.get("/api/v1/courses/{course_id}")
def get_course(course_id: UUID, session: Session = Depends(get_session)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course
```

**`GET /lecturers`** — Query the existing `Lecturer` table. Optional `course_id` filter can be added later when a `course_lecturers` junction table exists. For now, return all:
```python
@app.get("/api/v1/lecturers", response_model=List[Lecturer])
def list_lecturers(course_id: Optional[UUID] = None, session: Session = Depends(get_session)):
    return session.exec(select(Lecturer)).all()
```

---

## 5. Files API

> **Frontend source:** `src/services/fileService.ts`

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `GET` | `/api/v1/files?course_id=&type_id=&lecturer_id=&search=` | `listFiles(filters)` | ✅ |
| `GET` | `/api/v1/files/{file_id}` | `getFile(fileId)` | ✅ |
| `GET` | `/api/v1/files/{file_id}/download` | (used by PDF viewer) | ✅ |

### Implementation Notes

**`GET /files`** — Query the `File` table with optional filters. The frontend expects these fields in each object:
```ts
{ id, title, type, lecturer, courseId, date, size, status, downloadUrl }
```
- Join with `Lecturer` table if you want to return the lecturer name
- Generate `downloadUrl` via GCS signed URL for each file, or leave blank and let the frontend use `/files/{id}/download`

**`GET /files/{file_id}`** — Return a single `File` row. The PDF viewer calls this to get metadata + `downloadUrl`. Must also return a pre-signed GCS URL in the `downloadUrl` field.

---

## 6. Recent Files API

> **Frontend source:** `src/services/fileService.ts`

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `GET` | `/api/v1/me/recent-files` | `listRecentFiles()` | ✅ |
| `POST` | `/api/v1/me/recent-files/{file_id}` | `addRecentFile(file)` | ✅ |
| `DELETE` | `/api/v1/me/recent-files` | `clearRecentFiles()` | ✅ |

### Implementation Notes
Requires a new `user_recent_files` table:
```
user_recent_files(user_id UUID FK, file_id UUID FK, viewed_at TIMESTAMP, PRIMARY KEY(user_id, file_id))
```
- `POST` should UPSERT (update `viewed_at` if row exists)
- `GET` returns sorted by `viewed_at DESC`, limit 10

---

## 7. File Requests API

> **Frontend source:** `src/services/requestService.ts`

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `POST` | `/api/v1/courses/{course_id}/upload` | `createFileRequest(payload)` | ✅ |
| `GET` | `/api/v1/me/requests` | `listMyRequests(userId)` | ✅ |
| `DELETE` | `/api/v1/me/requests/{request_id}` | `withdrawRequest(id)` | ✅ |
| `GET` | `/api/v1/admin/requests?status=` | `listAllRequests(filters)` | ✅ |
| `GET` | `/api/v1/admin/requests/stats` | `getRequestStats()` | ✅ |
| `POST` | `/api/v1/admin/requests/{id}/approve` | `approveRequest(id, ...)` | ✅ |
| `POST` | `/api/v1/admin/requests/{id}/reject` | `rejectRequest(id, ...)` | ✅ |
| `POST` | `/api/v1/admin/requests/bulk-approve` | `bulkApprove(ids, ...)` | ✅ |
| `POST` | `/api/v1/admin/requests/bulk-reject` | `bulkReject(ids, ...)` | ✅ |
| `POST` | `/api/v1/admin/requests/{id}/undo-approve` | `undoApprove(id, ...)` | ✅ |
| `POST` | `/api/v1/admin/requests/{id}/undo-reject` | `undoReject(id, ...)` | ✅ |

### Implementation Notes

> [!IMPORTANT]
> The existing `POST /admin/requests/{id}/approve` endpoint in `main.py` uses a **query parameter** (`approve: bool`). The frontend sends a **JSON body** with `{ approve: true }`. You need to update the endpoint signature to accept a JSON body, OR align them.

**`GET /me/requests`** — Filter `FileRequest` by `user_id == current_user.id`. The frontend ignores the `userId` parameter it passes (the backend should use the JWT cookie).

**`GET /admin/requests`** — Return all `FileRequest` rows. Support `?status=pending` filter. Join with `Lecturer` to return `lecturerName`.

**`GET /admin/requests/stats`** — Return:
```json
{ "pending": 5, "approvedToday": 3, "rejectedToday": 1 }
```

**Approve/Reject** — The frontend sends JSON body. Approval should also trigger points (see Reputation section). Use idempotency: if already approved, return the existing record.

---

## 8. Reputation API

> **Frontend source:** `src/services/reputationService.ts` (⚠️ STILL USES MOCK — needs migration)

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `GET` | `/api/v1/me/reputation` | `getMyReputation(userId)` | ✅ |
| `GET` | `/api/v1/reputation/leaderboard` | `listTopContributors()` | ✅ |

### Implementation Notes
Requires new `points_transactions` table:
```
points_transactions(id UUID PK, user_id UUID FK, amount INT, reason TEXT, date TIMESTAMP, source_id UUID UNIQUE FK→file_requests)
```
- `source_id` UNIQUE constraint prevents double-awarding on approval
- `GET /me/reputation` returns `{ userId, totalPoints, badge, transactions[] }`
- Badge tiers: Gold (>1000), Silver (>500), Bronze (default)
- `GET /reputation/leaderboard` returns top 10 users by total points

---

## 9. Gamification API & Sessions

> **Frontend source:** `src/services/gamificationService.ts`

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `POST` | `/api/v1/me/viewer/session-start` | `startViewerSession({ fileId })` | ✅ |
| `POST` | `/api/v1/me/viewer/heartbeat` | `sendViewerHeartbeat(...)` | ✅ |
| `POST` | `/api/v1/me/viewer/session-end` | `endViewerSession(sessionId)` | ✅ |
| `GET` | `/api/v1/me/activity/summary` | `getActivitySummary()` | ✅ |

### Implementation Notes
- **Viewer Sessions**:
  - `POST /session-start` computes `required_active_seconds` based on file type (PDF: pages × 45s × 0.60; Slides: pages × 30s × 0.60).
  - `POST /heartbeat` calculates `completion_score` = `(visited_pages / total_pages) * min(active_seconds / required_active_seconds, 1.0)`. If >= 0.85, set `is_complete`, award points, update `user_course_activity`.
- **Idempotency**: All point transactions (`file_complete`, `course_complete`) must rely on `points_transactions.source_id` uniqueness. 
- **Course Status Logic**: `not_started` (0%), `exploring` (<50%), `engaged` (>=50%), `completed` (100%).

> **Note:** Platform session tracking (`/me/session/start`, `/me/session/heartbeat`, `/me/session/end`) and the share URL endpoint (`/files/:id/share`) have been **removed** from scope. The frontend no longer calls these endpoints.

---

## 9. AI Assistant API

> **Frontend source:** `src/services/assistantService.ts` (⚠️ STILL USES MOCK — needs migration)

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `POST` | `/api/v1/assistant/chat` | `sendMessage(fileId, message, history)` | ✅ |
| `GET` | `/api/v1/me/notes?fileId=` | `getNotes(fileId)` | ✅ |
| `POST` | `/api/v1/me/notes` | `saveNotes(fileId, content)` | ✅ |

### Implementation Notes
- **Chat**: Integrate with Google Gemini or OpenAI. Send the file content + conversation history as context. Return the AI response string.
- **Notes**: Store per-user, per-file JSON strings. Simple `user_notes(user_id, file_id, content TEXT, updated_at)` table.

---

## 10. Audit Logs API

> **Frontend source:** `src/services/auditService.ts` (⚠️ STILL USES MOCK — needs migration)

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `GET` | `/api/v1/admin/audit-logs?action=&actorId=&limit=` | `listAuditLogs(filters)` | ✅ |

### Implementation Notes
Requires new `audit_logs` table:
```
audit_logs(id UUID PK, timestamp TIMESTAMP, actor_id UUID FK, actor_name TEXT, action TEXT, target_type TEXT, target_ids UUID[], metadata JSONB)
```
- Write audit entries inside the approve/reject/bulk flows
- Return paginated, sorted by `timestamp DESC`

---

## 11. User Settings & Preferences

> **Frontend source:** `src/components/pages/Settings.tsx`
> **Important:** The frontend currently resets settings on reload because `localStorage` causes silent divergence bugs across devices. These endpoints must be implemented to preserve settings reliably.

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/settings` | Get user preferences | ✅ |
| `PATCH` | `/api/v1/me/settings` | Update user preferences | ✅ |

---

## 12. Tasks / Pinned Courses (🟡 localStorage)

> **Frontend source:** `src/hooks/useTasks.ts`, `src/hooks/usePinnedCourses.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/tasks` | List user tasks | ✅ |
| `POST` | `/api/v1/me/tasks` | Create task | ✅ |
| `PATCH` | `/api/v1/me/tasks/{id}` | Toggle/edit task | ✅ |
| `DELETE` | `/api/v1/me/tasks/{id}` | Delete task | ✅ |
| `GET` | `/api/v1/me/pinned-courses` | Get pinned courses | ✅ |
| `POST` | `/api/v1/me/pinned-courses/{courseId}` | Pin course | ✅ |
| `DELETE` | `/api/v1/me/pinned-courses/{courseId}` | Unpin course | ✅ |

### Implementation Notes
- **Tasks Payload:** When bridging the `/api/v1/me/tasks` POST endpoint, the frontend sends the following schema:
```json
{
  "title": "string",
  "date": "YYYY-MM-DD",
  "priority": "normal" | "high" | "urgent",
  "startHour": 14,
  "duration": 1.5
}
```
- **UUID Catalog Mapping:** Note that the frontend handles raw UUID exposure natively using cached TanStack catalog queries (`useMajors`, `useCourses`). You do not need to stitch `major_name` or `course_name` strings into base returned entities like `RecentFiles` or `User` fields if doing so adds unwanted backend JOIN complexity. The frontend resolves UUIDs dynamically.

---

## 13. Notifications (✅ Completed May 29)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/notifications` | List notifications | ✅ |
| `GET` | `/api/v1/me/notifications/unread-count` | Badge count | ✅ |
| `PATCH` | `/api/v1/me/notifications/{id}/read` | Mark as read | ✅ |
| `PATCH` | `/api/v1/me/notifications/read-all` | Mark all read | ✅ |

---

## 14. Implementation Priority

### 🔴 P0 — App is broken without these (frontend calls them NOW)
1. `GET /api/v1/lecturers` (DB query) ✅
2. `GET /api/v1/courses/{course_id}` (single course lookup) ✅
3. `GET /api/v1/files` (list approved files with filters) ✅
6. `GET /api/v1/admin/requests` (admin moderation queue) ✅

### 🔴 P1 — Admin dashboard is broken without these
9. `GET /api/v1/admin/requests/stats` ✅
10. `POST /api/v1/admin/requests/{id}/approve` ✅
11. `POST /api/v1/admin/requests/{id}/reject` ✅
12. `POST /api/v1/admin/requests/bulk-approve` ✅
13. `POST /api/v1/admin/requests/bulk-reject` ✅
14. `POST /api/v1/admin/requests/{id}/undo-approve` ✅
15. `POST /api/v1/admin/requests/{id}/undo-reject` ✅
16. `DELETE /api/v1/me/requests/{id}` (withdraw) ✅

### 🔴 P2 — Needs new DB tables
17. `GET /api/v1/me/reputation` ✅
18. `GET /api/v1/reputation/leaderboard` ✅
19. `GET /api/v1/admin/audit-logs` (needs `audit_logs`) ✅
20. Recent files CRUD (needs `user_recent_files`) ✅

### 🔴 P3 — AI features
21. `POST /api/v1/assistant/chat` (needs LLM integration) ✅
22. Notes CRUD (needs `user_notes`) ✅

### 🟡 P4 — Nice-to-have (frontend still uses localStorage)
23. Settings, Tasks, Pinned Courses, Notifications

---

## 15. Security Reminders

- **Row-level security**: Students should only see their own requests via `/me/requests`
- **Idempotent approvals**: Use `UNIQUE(source_id)` on `points_transactions` to prevent double-awarding
- **Concurrency**: Use DB transactions for approve/reject workflows (lock row, check status, update, commit)
- **Rate limiting**: Limit `POST /courses/{id}/upload` to 10/hour per student
- **File validation**: Already implemented via `validate_uploaded_file()` — max 15MB, magic bytes check




# GeeksHub — Backend Guide

> How the FastAPI backend is built and how a request travels through it. Read [ARCHITECTURE.md](./ARCHITECTURE.md) first; file‑by‑file notes are in [FILES_OVERVIEW.md](./FILES_OVERVIEW.md). The AI endpoint has its own deep dive in [AI_INTEGRATION.md](./AI_INTEGRATION.md).

---

## 1. Backend Architecture at a Glance

- **Framework:** FastAPI (Python), served by uvicorn.
- **ORM / models:** SQLModel (SQLAlchemy core + Pydantic), one class per table in `models.py`.
- **API contract:** Pydantic schemas in `schemas.py` (request payloads + response models).
- **Database:** PostgreSQL on Neon, with the `pgvector` extension for AI embeddings.
- **Auth:** Auth0 issues JWTs; the backend verifies them and looks up the local `User`. The JWT is delivered to the browser as an HttpOnly cookie.
- **External services:** Google Cloud Storage (file bytes) and Google Gemini (chat + embeddings).

There is no separate "controller/service/repository" split — FastAPI **routers** play the controller role and call SQLModel directly. Cross‑cutting logic (auth, AI, storage) is factored into `utils/`. This is a deliberately flat, pragmatic layout.

---

## 2. Request Lifecycle (the layers)

```
HTTP request  (cookie: auth_token=<JWT>)
   │
   ▼
FastAPI router endpoint        server/routers/<domain>.py
   │   Depends(get_session)    ── opens a DB session (server/database.py)
   │   Depends(get_verified_user / get_admin_user)
   │        └─ validates the Auth0 JWT against JWKS, loads the User row
   │
   ├─ validate body via Pydantic schema   server/schemas.py
   ├─ query / mutate tables via SQLModel   server/models.py  ──►  Neon Postgres
   ├─ (optional) call GCS / Gemini via utils/
   ├─ (optional) schedule BackgroundTasks  (e.g. PDF embedding)
   │
   ▼
return a Pydantic response model  ──►  JSON  ──►  frontend
```

### Application setup (`server/main.py`)
- A `lifespan` context runs `init_db()` on startup (`SQLModel.metadata.create_all` — tables are created if missing; there is no migration framework, just `add_column.py` for ad‑hoc changes).
- CORS allows the frontend origin **with credentials** so the auth cookie is accepted cross‑origin in dev.
- All 12 routers are registered with `app.include_router(...)`.
- `GET /api/v1/health` pings the DB.

### Database (`server/database.py`)
- One SQLAlchemy `engine` against `DATABASE_URL` (Neon). Tuned for Neon's serverless quirks: `pool_pre_ping=True`, small `pool_size`, and `pool_recycle=300` to survive Neon dropping idle connections.
- `get_session()` is the FastAPI dependency that yields a request‑scoped `Session`.

---

## 3. Authentication & Authorization

Identity is owned by **Auth0**; the backend trusts but verifies.

`server/utils/auth_utils.py`:
- `get_verified_user(request, session)`:
  1. Reads the token from the `auth_token` cookie (falls back to an `Authorization: Bearer` header for API clients).
  2. Fetches Auth0's public keys (JWKS, cached in memory for an hour) and validates the JWT signature, audience, and issuer (RS256).
  3. Looks up the `User` whose `auth0_id` matches the token's `sub`. Returns it, or raises `401/403`.
- `get_admin_user(...)` wraps the above and additionally requires `role == "ADMIN"`.

Every protected endpoint declares one of these as a dependency, so authorization is uniform and the database is always the source of truth for role. The auth router (`auth.py`) is what sets the HttpOnly `auth_token` cookie on sign‑in and clears it on sign‑out.

---

## 4. The Data Model (`server/models.py`)

Grouped by purpose:

**Identity & catalog**
- `User` — `auth0_id`, `email`, `name`, `role` (default `STUDENT`), `major_id`, denormalized `total_points` (for fast leaderboards).
- `Major`, `Course` (`code`, `major_id`, `year_id`, `semester`), `Lecturer`, `MaterialType`, `CourseLecturer` (junction: which lecturers teach which courses).

**Content & contributions**
- `Material` — an *approved* file (title, years, FKs to course/lecturer/type/uploader, GCS `file_url`).
- `FileRequest` — a *pending* upload awaiting moderation (status `pending`/`approved`/`rejected`, temp GCS path, optional `admin_note`).
- `PointsTransaction` — the reputation ledger. A unique constraint on `(request_id, action)` plus a unique `source_id` prevent double‑awarding XP.

**Activity & study tracking**
- `UserRecentFile` (composite PK), `UserPlatformSession`, `UserCourseActivity`, `FileViewingSession` (reading‑time completion scoring), `UserNote` (one note doc per user/file).

**Moderation & per‑user state**
- `AuditLog` — every admin action (`action`, `target_ids` JSON, `meta_data` JSON).
- `UserNotification`, `PinnedCourse` (composite PK), `UserSettings` (one row per user, defaults on first read), `UserTask` (learning‑plan tasks; date stored as `"YYYY-MM-DD"` string to avoid TZ issues; composite index on `(user_id, date)`).

**AI / RAG**
- `MaterialChunk` — a chunk of a document's text plus its 1536‑dim embedding `Vector`, with an **HNSW** index (`vector_cosine_ops`, `m=16`, `ef_construction=64`) for fast cosine similarity search. See [AI_INTEGRATION.md](./AI_INTEGRATION.md).

---

## 5. The API Contract (`server/schemas.py`)

Pydantic models define what comes in and goes out:
- **Auth:** `UserSignUp` enforces password strength (length, uppercase, number, special char) and that the two passwords match; `UserSignIn`, `ForgotPassword`.
- **Files / moderation:** `FileRequestCreate`, `FileRequestEnriched` (denormalized course/lecturer names + `points_awarded`), `BulkActionPayload`, `AdminRejectPayload`, `BulkRejectPayload`.
- **Gamification / activity:** `MyReputationResponse`, `TransactionResponse`, `LeaderboardEntry`, `RecentFileResponse`, viewer session payloads.
- **AI:** `AIChatRequest` (`fileId`, `message`, `history`) and `ChatMessage`.
- **Per‑user state:** `NotificationResponse`, `SettingsResponse`/`SettingsPatch`, `TaskCreate`/`TaskPatch`/`TaskResponse`.

> **Casing note:** most models use `snake_case` (converted to camelCase by the frontend's `apiClient`), but tasks, settings, notifications, and reputation responses deliberately emit **camelCase** field names so the frontend gets them as‑is.

---

## 6. Routers (Endpoints by Domain)

| Router | Mounted endpoints | Responsibilities |
|---|---|---|
| `auth.py` | `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/me`, `/signout` | Bridge Auth0 ↔ local `User`; set/clear the auth cookie. |
| `catalog.py` | `/majors`, `/courses`, `/lecturers`, `/years`, `/semesters`, `/types`, course‑lecturer lists | Read the academic catalog; cascading filters. |
| `files.py` | `/files`, `/files/{id}` | List approved `Material`s; return one file with a `downloadUrl`. |
| `tasks.py` | `/me/tasks` (GET/POST/PATCH/DELETE) | Personal learning‑plan task CRUD with ownership checks. |
| `admin.py` | `/admin/requests/*`, `/admin/audit-logs`, `/admin/courses/{id}/lecturers` | Moderation engine (below). |
| `gamification.py` | `/me/reputation`, `/reputation/leaderboard` | Reputation summary + leaderboard via denormalized points. |
| `activity.py` | `/me/recent-files`, `/me/activity/summary`, `/me/session/start` | Dashboard widget data. |
| `viewer.py` | viewer session start / heartbeat / end | Reading‑time tracking → completion points. |
| `ai.py` | `/assistant/chat`, `/me/notes` | RAG tutor + per‑file notes. |
| `settings.py` | `/me/settings` (GET/PATCH) | Per‑user preferences; auto‑creates defaults. |
| `pinned_courses.py` | `/me/pinned-courses` (GET/POST/DELETE) | Pinned courses. |
| `notifications.py` | `/me/notifications`, `/unread-count`, `/{id}/read`, `/read-all` | In‑app notifications. |

All endpoints are under the `/api/v1` prefix.

---

## 7. The Moderation Engine (`server/routers/admin.py`)

The most involved router. When an admin **approves** a `FileRequest`:

1. Verify the admin role (`get_admin_user`).
2. Create a `Material` row from the request.
3. Move the file in GCS out of the temporary/`trash_bin/` area into permanent storage.
4. Award `XP_UPLOAD_APPROVAL` (25) points to the uploader — recorded as a `PointsTransaction` and rolled into `User.total_points`. The `(request_id, action)` unique constraint makes this idempotent.
5. Write an `AuditLog` entry and a `UserNotification` for the uploader.
6. Schedule a `BackgroundTask` (`embed_single` / `embed_batch`) that downloads the PDF and runs `process_and_embed_pdf` so the file becomes searchable by the AI tutor.

**Reject** moves the file to GCS `trash_bin/` (soft delete; a lifecycle rule purges after a few days) and supports **undo**. Bulk variants apply the same logic across many request IDs.

> **Why background tasks open their own session:** FastAPI closes the request‑scoped session before a `BackgroundTask` runs, so `embed_single`/`embed_batch` each create a fresh `Session(engine)`.

---

## 8. External Integrations

- **Google Cloud Storage** (`utils/shared.py`, `utils/upload_utils.py`): a shared `storage_client` + `BUCKET_NAME`. Uploads land as pending; approval promotes them; rejection moves them to `trash_bin/`. File serving uses GCS URLs.
- **Google Gemini** (`utils/ai_utils.py`): chat + embeddings. Covered in detail in [AI_INTEGRATION.md](./AI_INTEGRATION.md).
- **Auth0**: identity provider; JWKS verification in `utils/auth_utils.py`.

---

## 9. Resilience & Operational Notes

- **Retries:** Gemini calls use Tenacity (exponential backoff). Embedding retries up to 5×; chat retries up to 3× but **excludes `HTTPException`** so 404/auth errors bubble up immediately.
- **Connection pooling:** tuned for Neon (`pool_pre_ping`, `pool_recycle=300`).
- **No migration tool:** schema is created via `init_db()`; column changes are done manually (`add_column.py`). Treat model changes carefully in production.
- **Secrets:** `DATABASE_URL`, `AUTH0_*`, `GEMINI_API_KEY`, and the GCS service‑account key live in `server/.env` / `gcp_key.json` — never commit real values.

---

## 10. Running the Backend

```bash
# install deps into the venv
server\venv\Scripts\python.exe -m pip install -r requirements.txt

# run just the backend (http://localhost:8000)
npm run dev:back        # = uvicorn main:app --reload --port 8000 --app-dir server

# run frontend + backend together
npm run dev:all
```

The frontend talks to `/api/v1` (Vite proxies it to `:8000` in dev so the HttpOnly cookie stays same‑origin); in production set `VITE_API_URL` to the backend URL.
