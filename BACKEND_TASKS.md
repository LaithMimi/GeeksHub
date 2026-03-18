# GeeksHub — Backend Implementation Tasks

> **For:** Backend Engineer
> **Frontend Stack:** React + TypeScript + TanStack Query
> **Backend Stack:** FastAPI + SQLModel + Neon PostgreSQL + Auth0 + Google Cloud Storage
> **Last Updated:** March 19, 2026

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

---

## 2. Database Schema (Current State)

These tables **exist** in `server/models.py`:

| Table | Model | Notes |
|-------|-------|-------|
| `users` | `User` | Has `major_id` FK to `majors` |
| `majors` | `Major` | `id` is UUID, has `name` + `slug` |
| `courses` | `Course` | Has `major_id`, `year_id` (int), `semester` (int) |
| `lecturers` | `Lecturer` | `id` (UUID), `name`, `email` |
| `material_types` | `MaterialType` | `id` (string slug), `display_name` |
| `files` | `File` | Approved files with `course_id`, `type`, `lecturer`, `file_url` |
| `file_requests` | `FileRequest` | Pending uploads with `lecturer_id` FK, `type_id` FK |

### Tables That Need to Be Created

| Table | Purpose |
|-------|---------|
| `points_transactions` | Points ledger for reputation (`user_id`, `amount`, `reason`, `source_id` → idempotent) |
| `audit_logs` | Admin action log (`actor_id`, `action`, `target_ids`, `metadata`) |
| `user_recent_files` | Recently viewed files per user (`user_id`, `file_id`, `viewed_at`) |

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
| `GET` | `/api/v1/courses/{course_id}` | `getCourse(courseId)` | 🔴 |
| `GET` | `/api/v1/years` | `listYears()` | 🔴 |
| `GET` | `/api/v1/semesters` | `listSemesters()` | 🔴 |
| `GET` | `/api/v1/lecturers?course_id=` | `listLecturers(filters)` | 🔴 |

### Implementation Notes

**`GET /years`** — No DB table exists. Return a static JSON array:
```json
[
  { "id": "1", "label": "Freshman" },
  { "id": "2", "label": "Sophomore" },
  { "id": "3", "label": "Junior" },
  { "id": "4", "label": "Senior" }
]
```

**`GET /semesters`** — No DB table exists. Return a static JSON array:
```json
[
  { "id": "1", "name": "Fall" },
  { "id": "2", "name": "Spring" }
]
```

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
| `GET` | `/api/v1/files?course_id=&type_id=&lecturer_id=&search=` | `listFiles(filters)` | 🔴 |
| `GET` | `/api/v1/files/{file_id}` | `getFile(fileId)` | 🔴 |
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
| `GET` | `/api/v1/me/recent-files` | `listRecentFiles()` | 🔴 |
| `POST` | `/api/v1/me/recent-files/{file_id}` | `addRecentFile(file)` | 🔴 |
| `DELETE` | `/api/v1/me/recent-files` | `clearRecentFiles()` | 🔴 |

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
| `GET` | `/api/v1/me/requests` | `listMyRequests(userId)` | 🔴 |
| `DELETE` | `/api/v1/me/requests/{request_id}` | `withdrawRequest(id)` | 🔴 |
| `GET` | `/api/v1/admin/requests?status=` | `listAllRequests(filters)` | 🔴 |
| `GET` | `/api/v1/admin/requests/stats` | `getRequestStats()` | 🔴 |
| `POST` | `/api/v1/admin/requests/{id}/approve` | `approveRequest(id, ...)` | 🔴 |
| `POST` | `/api/v1/admin/requests/{id}/reject` | `rejectRequest(id, ...)` | 🔴 |
| `POST` | `/api/v1/admin/requests/bulk-approve` | `bulkApprove(ids, ...)` | 🔴 |
| `POST` | `/api/v1/admin/requests/bulk-reject` | `bulkReject(ids, ...)` | 🔴 |
| `POST` | `/api/v1/admin/requests/{id}/undo-approve` | `undoApprove(id, ...)` | 🔴 |
| `POST` | `/api/v1/admin/requests/{id}/undo-reject` | `undoReject(id, ...)` | 🔴 |

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
| `GET` | `/api/v1/me/reputation` | `getMyReputation(userId)` | 🔴 |
| `GET` | `/api/v1/reputation/leaderboard` | `listTopContributors()` | 🔴 |

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

## 9. AI Assistant API

> **Frontend source:** `src/services/assistantService.ts` (⚠️ STILL USES MOCK — needs migration)

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `POST` | `/api/v1/assistant/chat` | `sendMessage(fileId, message, history)` | 🔴 |
| `GET` | `/api/v1/me/notes?fileId=` | `getNotes(fileId)` | 🔴 |
| `POST` | `/api/v1/me/notes` | `saveNotes(fileId, content)` | 🔴 |

### Implementation Notes
- **Chat**: Integrate with Google Gemini or OpenAI. Send the file content + conversation history as context. Return the AI response string.
- **Notes**: Store per-user, per-file JSON strings. Simple `user_notes(user_id, file_id, content TEXT, updated_at)` table.

---

## 10. Audit Logs API

> **Frontend source:** `src/services/auditService.ts` (⚠️ STILL USES MOCK — needs migration)

| Method | Endpoint | Frontend Call | Status |
|--------|----------|---------------|--------|
| `GET` | `/api/v1/admin/audit-logs?action=&actorId=&limit=` | `listAuditLogs(filters)` | 🔴 |

### Implementation Notes
Requires new `audit_logs` table:
```
audit_logs(id UUID PK, timestamp TIMESTAMP, actor_id UUID FK, actor_name TEXT, action TEXT, target_type TEXT, target_ids UUID[], metadata JSONB)
```
- Write audit entries inside the approve/reject/bulk flows
- Return paginated, sorted by `timestamp DESC`

---

## 11. User Settings & Preferences (🟡 localStorage)

> **Frontend source:** `src/components/pages/Settings.tsx` — currently uses localStorage

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/settings` | Get user preferences | 🟡 |
| `PATCH` | `/api/v1/me/settings` | Update user preferences | 🟡 |

---

## 12. Tasks / Pinned Courses (🟡 localStorage)

> **Frontend source:** `src/hooks/useTasks.ts`, `src/hooks/usePinnedCourses.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/tasks` | List user tasks | 🟡 |
| `POST` | `/api/v1/me/tasks` | Create task | 🟡 |
| `PATCH` | `/api/v1/me/tasks/{id}` | Toggle/edit task | 🟡 |
| `DELETE` | `/api/v1/me/tasks/{id}` | Delete task | 🟡 |
| `GET` | `/api/v1/me/pinned-courses` | Get pinned courses | 🟡 |
| `POST` | `/api/v1/me/pinned-courses/{courseId}` | Pin course | 🟡 |
| `DELETE` | `/api/v1/me/pinned-courses/{courseId}` | Unpin course | 🟡 |

---

## 13. Notifications (🟡 Not Yet Built)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/notifications` | List notifications | 🟡 |
| `GET` | `/api/v1/me/notifications/unread-count` | Badge count | 🟡 |
| `PATCH` | `/api/v1/me/notifications/{id}/read` | Mark as read | 🟡 |
| `PATCH` | `/api/v1/me/notifications/read-all` | Mark all read | 🟡 |

---

## 14. Implementation Priority

### 🔴 P0 — App is broken without these (frontend calls them NOW)
1. `GET /api/v1/years` (static return)
2. `GET /api/v1/semesters` (static return)
3. `GET /api/v1/lecturers` (DB query)
4. `GET /api/v1/courses/{course_id}` (single course lookup)
5. `GET /api/v1/files` (list approved files with filters)
6. `GET /api/v1/files/{file_id}` (single file + downloadUrl)
7. `GET /api/v1/me/requests` (user's own submissions)
8. `GET /api/v1/admin/requests` (admin moderation queue)

### 🔴 P1 — Admin dashboard is broken without these
9. `GET /api/v1/admin/requests/stats`
10. `POST /api/v1/admin/requests/{id}/approve`
11. `POST /api/v1/admin/requests/{id}/reject`
12. `POST /api/v1/admin/requests/bulk-approve`
13. `POST /api/v1/admin/requests/bulk-reject`
14. `POST /api/v1/admin/requests/{id}/undo-approve`
15. `POST /api/v1/admin/requests/{id}/undo-reject`
16. `DELETE /api/v1/me/requests/{id}` (withdraw)

### 🔴 P2 — Needs new DB tables
17. `GET /api/v1/me/reputation` (needs `points_transactions`)
18. `GET /api/v1/reputation/leaderboard` (needs `points_transactions`)
19. `GET /api/v1/admin/audit-logs` (needs `audit_logs`)
20. Recent files CRUD (needs `user_recent_files`)

### 🔴 P3 — AI features
21. `POST /api/v1/assistant/chat` (needs LLM integration)
22. Notes CRUD (needs `user_notes`)

### 🟡 P4 — Nice-to-have (frontend still uses localStorage)
23. Settings, Tasks, Pinned Courses, Notifications

---

## 15. Security Reminders

- **Row-level security**: Students should only see their own requests via `/me/requests`
- **Idempotent approvals**: Use `UNIQUE(source_id)` on `points_transactions` to prevent double-awarding
- **Concurrency**: Use DB transactions for approve/reject workflows (lock row, check status, update, commit)
- **Rate limiting**: Limit `POST /courses/{id}/upload` to 10/hour per student
- **File validation**: Already implemented via `validate_uploaded_file()` — max 15MB, magic bytes check
