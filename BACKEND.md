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
