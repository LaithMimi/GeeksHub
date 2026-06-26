# GeeksHub — Gamified Learning System
## AI Agent Implementation Prompt

---

You are implementing the **Gamified Learning System** for GeeksHub — a viewer-first academic file platform built with **FastAPI + SQLModel + PostgreSQL (Neon DB)** on the backend and **React + TypeScript + TanStack Query** on the frontend.

Read every section carefully before writing any code. Resolve all schema and logic questions from this prompt — do not invent assumptions.

Read GUIDELINES.md file for BETTER APPROACH.
NEVER WRITE BACKEND CODE, ONLT FRONTEND CODE, FOR EACH BACKEND CODE, WRITE NEW TASKS TO THE BACKEND ENGINEER IN BACKEND_TASKS.md FILE.
---

## CONTEXT & CONSTRAINTS

- Files are **never downloaded**. They open in an embedded in-platform viewer only.
- Every point award must be **verified server-side**. The frontend sends signals — the backend is the sole authority on whether points are awarded.
- All protected endpoints extract user identity from the **HTTP-Only JWT cookie** (`auth_token`). Never trust any user ID sent in the request body.
- All point events must be **idempotent** — enforced by a unique database constraint on `source_id` in `points_transactions`, not just code checks.
- The existing codebase uses `server/models.py` (SQLModel) and `server/main.py` (FastAPI). Add new models and routes following the same patterns already in place.
- Base URL: `/api/v1`. All new endpoints follow this convention.

---

## PART 1 — DATABASE: ADD THESE TABLES

Add the following SQLModel table definitions to `server/models.py`. Run migrations against the Neon DB.

---

### Table: `file_viewing_sessions`
Tracks a single student's viewing session for a specific file.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `user_id` | UUID | FK → users.id, NOT NULL | Extracted from JWT |
| `file_id` | UUID | FK → files.id, NOT NULL | |
| `course_id` | UUID | FK → courses.id, NOT NULL | Denormalized for fast course-level queries |
| `started_at` | Timestamp | NOT NULL | Wall-clock session start |
| `last_heartbeat_at` | Timestamp | NOT NULL | Updated every heartbeat call |
| `active_seconds` | Integer | NOT NULL, DEFAULT 0 | Cumulative server-verified active time |
| `visited_pages` | Integer[] | NOT NULL, DEFAULT [] | Server-maintained list of page indices visited at dwell threshold |
| `total_pages` | Integer | NOT NULL | Snapshotted from file metadata at session start |
| `completion_score` | Float | NOT NULL, DEFAULT 0.0 | Recomputed on every heartbeat |
| `is_complete` | Boolean | NOT NULL, DEFAULT false | Immutable once set to true |
| `completed_at` | Timestamp | NULLABLE | Set when is_complete becomes true |

---

### Table: `user_course_activity`
Materialized activity state per user per course. Recomputed on every relevant heartbeat.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | UUID | FK → users.id, NOT NULL | Composite PK with course_id |
| `course_id` | UUID | FK → courses.id, NOT NULL | Composite PK with user_id |
| `status` | String | NOT NULL, DEFAULT 'not_started' | Enum: not_started / exploring / engaged / completed |
| `files_completed` | Integer | NOT NULL, DEFAULT 0 | Count of files where is_complete = true |
| `total_files` | Integer | NOT NULL | Total approved files in this course at last check |
| `completed_at` | Timestamp | NULLABLE | Set when status becomes 'completed' |
| `updated_at` | Timestamp | NOT NULL | Updated on every heartbeat that changes state |

**Unique constraint:** `(user_id, course_id)`

---

### ~~Table: `user_platform_sessions`~~
> **REMOVED** — Platform session tracking (25-minute break/points intervals) has been removed from scope.

---

### Table: `motivational_quotes`
Quotes shown on course completion. Manageable by admins without a code deploy.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `text` | String | NOT NULL | The quote text |
| `author` | String | NULLABLE | Optional attribution |
| `is_active` | Boolean | NOT NULL, DEFAULT true | Disabled quotes are excluded from random selection |

Seed this table with the following quotes on migration:
1. "The expert in anything was once a beginner."
2. "Every file you opened was a door you unlocked."
3. "You just finished what most people never start."
4. "Progress is progress, no matter how small — keep going."
5. "Rest now. You've earned it."
6. "One course down. The future version of you thanks you."

---

## PART 2 — BACKEND: IMPLEMENT THESE ENDPOINTS

Add all routes to `server/main.py`. All endpoints require authentication via the JWT cookie unless stated otherwise.

---

### POST `/api/v1/me/viewer/session-start`

**Purpose:** Called when a student opens a file in the viewer. Creates a `file_viewing_sessions` row.

**Request body:**
```json
{ "file_id": "uuid" }
```

**Logic:**
1. Extract `user_id` from JWT.
2. Fetch file from DB. If not found → 404.
3. Fetch `total_pages` from file metadata. If unavailable → default to 1.
4. Insert a new `file_viewing_sessions` row with `active_seconds = 0`, `visited_pages = []`, `is_complete = false`.
5. Compute `required_active_seconds` based on file type:
   - PDF: `total_pages × 45 × 0.60` (rounded to int)
   - Slides: `total_pages × 30 × 0.60` (rounded to int)
6. Return:
```json
{
  "session_id": "uuid",
  "total_pages": 10,
  "required_active_seconds": 270,
  "file_type": "pdf"
}
```

---

### POST `/api/v1/me/viewer/heartbeat`

**Purpose:** Called every 5 seconds by the frontend while the student is viewing a file. This is the core of the completion verification system.

**Request body:**
```json
{
  "session_id": "uuid",
  "visited_pages": [0, 1, 2, 3],
  "active_seconds": 95
}
```

**Logic — execute in a single DB transaction:**

1. Fetch the `file_viewing_sessions` row. If not found or `user_id` mismatch → 404.
2. If `is_complete` is already `true` → return current state immediately, skip all computation (idempotency).
3. **Plausibility check:** `active_seconds` from request must be ≤ `(now - started_at).total_seconds()`. If not → reject with 400: "active_seconds exceeds elapsed wall-clock time."
4. Merge `visited_pages`: union of stored `visited_pages` and request `visited_pages`. Only accept page indices in range `[0, total_pages - 1]`.
5. Update `active_seconds` to the request value (client is accumulating; server validates it's plausible).
6. Update `last_heartbeat_at` to now.
7. **Compute completion score:**
```python
coverage_score = len(visited_pages) / total_pages          # 0.0 – 1.0
required = file.required_active_seconds                     # precomputed at session start
time_score = min(active_seconds / required, 1.0)           # 0.0 – 1.0, capped
completion_score = coverage_score * time_score
```
8. Update `completion_score` on the session row.
9. **If `completion_score >= 0.85` and `is_complete = false`:**
   a. Set `is_complete = true`, `completed_at = now`.
   b. Award +5 points: insert into `points_transactions` with `source_id = f"file_complete:{user_id}:{file_id}"`. Skip if source_id already exists (DB unique constraint handles this).
   c. Recompute `user_course_activity` for this course:
      - Count all `file_viewing_sessions` where `user_id = current`, `course_id = current`, `is_complete = true`.
      - Count total approved files in the course.
      - Derive new status: `not_started` (0), `exploring` (1 to <50%), `engaged` (≥50%), `completed` (all files done).
      - Upsert into `user_course_activity`.
   d. **If status became `completed`:**
      - Award +90 points: insert into `points_transactions` with `source_id = f"course_complete:{user_id}:{course_id}"`. Skip if exists.
      - Set `completed_at` on the `user_course_activity` row.
      - Select one random `motivational_quotes` row where `is_active = true`.
      - Set `course_completed = true` in the response.
10. Commit transaction.
11. Return:
```json
{
  "session_id": "uuid",
  "completion_score": 0.72,
  "is_complete": false,
  "points_awarded": 0,
  "course_completed": false,
  "course_id": null,
  "motivational_quote": null,
  "break_reminder": false,
  "next_interval_in": 412
}
```
`break_reminder` and `next_interval_in` come from the platform session system (see below). If no platform session exists for this user, default `break_reminder = false`, `next_interval_in = 1500`.

---

### POST `/api/v1/me/viewer/session-end`

**Purpose:** Called when the student closes or navigates away from the viewer. Closes the session without awarding points (only the heartbeat awards points).

**Logic:** Fetch session by ID + user_id. If not found → 404. Update `last_heartbeat_at = now`. Return 204.

---

### ~~POST `/api/v1/me/session/start`~~

> **REMOVED** — Platform session tracking has been removed from scope.

---

### ~~POST `/api/v1/me/session/heartbeat`~~

> **REMOVED** — Platform session tracking has been removed from scope.

---

### ~~POST `/api/v1/me/session/end`~~

> **REMOVED** — Platform session tracking has been removed from scope.

---

### GET `/api/v1/me/learning-path`

**Purpose:** Returns the student's full learning path — their major's courses ordered by `year_id` → `semester`, each annotated with activity state.

**Logic:**
1. Extract `user_id` from JWT. Fetch user's `major_id`.
2. Fetch all courses where `major_id = user.major_id`, ordered by `year_id ASC`, `semester ASC`.
3. For each course, fetch (or default) the `user_course_activity` row for this user.
4. Check if any approved files exist for each course (`has_files`).
5. Group into years and semesters.
6. Return:
```json
{
  "major": { "id": "software-engineering", "name": "Software Engineering" },
  "years": [
    {
      "year_id": 1,
      "label": "Freshman",
      "semesters": [
        {
          "semester": 1,
          "label": "Fall",
          "courses": [
            {
              "id": "uuid",
              "code": "10036",
              "name": "Introduction to Programming",
              "has_files": true,
              "status": "exploring",
              "files_completed": 2,
              "total_files": 5
            }
          ]
        }
      ]
    }
  ]
}
```

Year labels: `{ 1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior" }`.
Semester labels: `{ 1: "Fall", 2: "Spring" }`.

---

### GET `/api/v1/me/activity/summary`

**Purpose:** Powers the Dashboard. Returns reputation totals and per-course activity breakdown.

**Response:**
```json
{
  "total_points": 340,
  "badge_tier": "bronze",
  "recent_transactions": [
    { "id": "uuid", "action": "file_complete", "points": 5, "created_at": "..." }
  ],
  "course_activity": [
    { "course_id": "uuid", "course_name": "...", "status": "engaged", "files_completed": 3, "total_files": 5 }
  ]
}
```

Badge tier thresholds: `{ newcomer: 0, bronze: 100, silver: 500, gold: 1000, diamond: 2500 }`. Compute on-the-fly from `total_points` — no separate column.

---

### GET `/api/v1/files/:file_id/share`

**Purpose:** Returns the canonical share URL for a file. **No authentication required.**

**Logic:**
1. Fetch file by ID. If not found → 404.
2. Return:
```json
{ "share_url": "https://geekshub.com/files/{file_id}" }
```

The base domain should be read from an environment variable `FRONTEND_BASE_URL`, defaulting to `https://geekshub.com`.

---

## PART 3 — POINTS TRANSACTIONS: ACTION SLUGS

All inserts into `points_transactions` must use these exact `action` values and `source_id` formats:

| Action Slug | Points | source_id Format |
|---|---|---|
| `file_complete` | +5 | `file_complete:{user_id}:{file_id}` |
| `upload_approved` | +25 | `approved:{file_request_id}` (already implemented) |
| `course_complete` | +90 | `course_complete:{user_id}:{course_id}` |

The unique constraint on `source_id` in `points_transactions` is the sole idempotency enforcement. Do not add additional code-level checks — rely on the DB constraint and catch the integrity error gracefully (return the existing state, do not re-raise as 500).

---

## PART 4 — COURSE ACTIVITY STATUS LOGIC

Apply this status derivation everywhere `user_course_activity.status` is computed:

```python
def derive_status(files_completed: int, total_files: int) -> str:
    if total_files == 0:
        return "not_started"
    if files_completed == 0:
        return "not_started"
    ratio = files_completed / total_files
    if ratio < 0.5:
        return "exploring"
    if ratio < 1.0:
        return "engaged"
    return "completed"
```

`total_files` is the count of approved files currently in the course — recount it on every relevant heartbeat, do not cache it.

---

## PART 5 — WHAT NOT TO IMPLEMENT (SCOPE BOUNDARY)

Do not implement the following — they are out of scope for this task:

- Any frontend code, React components, or TypeScript changes.
- Sound playback, animations, or UI celebrations — those are frontend responsibilities triggered by the heartbeat response flags.
- The AI Assistant endpoints (`/assistant/chat`, `/me/notes`) — separate task.
- Study Hours (`/me/study-hours`) — requires separate session tracking infrastructure beyond this spec.
- The `verified` course status — reserved for Option B (AI comprehension verification), not implemented in this version.
- Any admin UI or admin endpoints beyond what already exists.

---

## PART 6 — VALIDATION & ERROR HANDLING

Follow the existing FastAPI HTTPException pattern in `main.py`.

| Condition | Status | Message |
|---|---|---|
| Session not found or wrong user | 404 | "Session not found" |
| File not found | 404 | "File not found" |
| `active_seconds` exceeds wall-clock elapsed time | 400 | "active_seconds exceeds elapsed session time" |
| `visited_pages` contains out-of-range indices | 400 | "visited_pages contains invalid page indices" |
| DB unique constraint violation on `source_id` | — | Catch silently, return current state — do not raise 500 |
| Non-admin accessing admin routes | 403 | "Insufficient permissions" |

---

## PART 7 — IMPLEMENTATION ORDER

Implement in this order to avoid dependency issues:

1. DB tables: `motivational_quotes` → `file_viewing_sessions` → `user_course_activity` → `user_platform_sessions`
2. Seed `motivational_quotes`
3. `POST /me/viewer/session-start`
4. `POST /me/viewer/heartbeat` (core — most complex)
5. `POST /me/viewer/session-end`
6. `GET /me/learning-path`
7. `GET /me/activity/summary`
8. `GET /files/:id/share`

Test the heartbeat completion score formula manually against these cases before integrating:

| Scenario | Expected Result |
|---|---|
| 10-page PDF, 10/10 pages visited, 270s active | score = 1.0 × 1.0 = 1.0 → complete |
| 10-page PDF, 10/10 pages visited, 100s active | score = 1.0 × 0.37 = 0.37 → not complete |
| 10-page PDF, 5/10 pages visited, 270s active | score = 0.5 × 1.0 = 0.5 → not complete |
| 10-page PDF, 9/10 pages visited, 270s active | score = 0.9 × 1.0 = 0.9 → complete (≥ 0.85) |
| Client sends active_seconds > wall clock time | Reject with 400 |
| Heartbeat called after is_complete = true | Return current state, no re-award |

---

Begin with the DB migrations. Confirm the schema is correct before implementing any routes.