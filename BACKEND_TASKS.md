# GeeksHub – Backend Implementation Tasks

> **For:** Backend Engineer  
> **Frontend Stack:** React + TypeScript + TanStack Query  
> **Last Updated:** February 15, 2026  

The frontend is fully built with mock data. Every API integration point is tagged with `@backend` in the source code. Your job is to implement the real REST API so the frontend can swap out its mocks.

---

## Table of Contents

1. [Tech Stack & Conventions](#1-tech-stack--conventions)
2. [Database Schema](#2-database-schema)
3. [Authentication](#3-authentication--task-1)
4. [Catalog API](#4-catalog-api--task-2)
5. [Files API](#5-files-api--task-3)
6. [Tasks API](#6-tasks-api--task-4)
7. [Pinned Courses API](#7-pinned-courses-api--task-5)
8. [Recent Files API](#8-recent-files-api--task-6)
9. [File Requests API](#9-file-requests-api--task-7)
10. [Reputation API](#10-reputation-api--task-8)
11. [User Settings API](#11-user-settings-api--task-9)
12. [Notifications API](#12-notifications-api--task-10)
13. [AI Assistant API](#13-ai-assistant-api--task-11)
14. [Admin Endpoints](#14-admin-endpoints--task-12)
15. [Audit Logs API](#15-audit-logs-api--task-13)
16. [Implementation Priority](#16-implementation-priority)

---

## 1. Tech Stack & Conventions

| Item | Convention |
|------|-----------|
| **Base URL** | `/api` |
| **Auth** | JWT Bearer token in `Authorization` header |
| **User context** | All `/api/me/*` endpoints extract `userId` from the JWT – no userId param needed |
| **Responses** | JSON, with appropriate HTTP status codes |
| **Errors** | `{ error: string, details?: any }` with 4xx/5xx status |
| **Pagination** | `?page=1&limit=20` where applicable, response: `{ data: T[], total: number }` |
| **Timestamps** | ISO 8601 strings (e.g. `2026-02-15T10:00:00Z`) |

---

## 2. Database Schema

Run these in order (foreign keys depend on earlier tables).

```sql
-- =============================================
-- USERS & AUTH
-- =============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    avatar_url      TEXT,
    role            VARCHAR(20) NOT NULL DEFAULT 'student',  -- 'student' | 'admin'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- CATALOG (mostly static / admin-managed)
-- =============================================
CREATE TABLE majors (
    id      VARCHAR(50) PRIMARY KEY,
    name    VARCHAR(100) NOT NULL
);

CREATE TABLE years (
    id      VARCHAR(50) PRIMARY KEY,
    name    VARCHAR(100) NOT NULL
);

CREATE TABLE semesters (
    id      VARCHAR(50) PRIMARY KEY,
    name    VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    major_id    VARCHAR(50) REFERENCES majors(id),
    year_id     VARCHAR(50) REFERENCES years(id),
    semester_id VARCHAR(50) REFERENCES semesters(id)
);

CREATE TABLE lecturers (
    id      VARCHAR(50) PRIMARY KEY,
    name    VARCHAR(100) NOT NULL
);

-- =============================================
-- FILES / MATERIALS
-- =============================================
CREATE TABLE files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    course_id       VARCHAR(50) NOT NULL REFERENCES courses(id),
    type            VARCHAR(20) NOT NULL,     -- 'summary' | 'exam' | 'notes' | 'slides'
    lecturer_id     VARCHAR(50) REFERENCES lecturers(id),
    uploader_id     UUID NOT NULL REFERENCES users(id),
    file_url        TEXT NOT NULL,
    download_count  INTEGER NOT NULL DEFAULT 0,
    rating          REAL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_files_course ON files(course_id);

-- =============================================
-- FILE REQUESTS (user submissions for approval)
-- =============================================
CREATE TABLE file_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    course_id       VARCHAR(50) NOT NULL REFERENCES courses(id),
    title           VARCHAR(255) NOT NULL,
    type            VARCHAR(20) NOT NULL,
    file_url        TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    admin_note      TEXT,
    reviewed_by     UUID REFERENCES users(id),
    points_awarded  INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ
);
CREATE INDEX idx_requests_user ON file_requests(user_id);
CREATE INDEX idx_requests_status ON file_requests(status);

-- =============================================
-- TASKS (personal learning plan)
-- =============================================
CREATE TABLE tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    date        DATE NOT NULL,
    start_hour  REAL NOT NULL DEFAULT 12,        -- 0–23, supports 0.5 steps
    duration    REAL NOT NULL DEFAULT 1,          -- hours
    priority    VARCHAR(10) NOT NULL DEFAULT 'normal',  -- 'urgent' | 'high' | 'normal'
    completed   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tasks_user_date ON tasks(user_id, date);

-- =============================================
-- PINNED COURSES
-- =============================================
CREATE TABLE pinned_courses (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id   VARCHAR(50) NOT NULL REFERENCES courses(id),
    pinned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, course_id)
);

-- =============================================
-- RECENT FILES
-- =============================================
CREATE TABLE user_recent_files (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id     UUID NOT NULL REFERENCES files(id),
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, file_id)
);
CREATE INDEX idx_recent_user_time ON user_recent_files(user_id, viewed_at DESC);

-- =============================================
-- REPUTATION / POINTS
-- =============================================
CREATE TABLE reputation_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    action      VARCHAR(50) NOT NULL,   -- 'upload_approved', 'download_milestone', etc.
    points      INTEGER NOT NULL,
    source_id   UUID,                   -- FK to the request/file that triggered it
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rep_user ON reputation_events(user_id);

-- =============================================
-- USER SETTINGS
-- =============================================
CREATE TABLE user_settings (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language            VARCHAR(5) NOT NULL DEFAULT 'en',
    theme               VARCHAR(10) NOT NULL DEFAULT 'system',
    text_size           VARCHAR(10) NOT NULL DEFAULT 'medium',
    notif_materials     BOOLEAN NOT NULL DEFAULT TRUE,
    notif_admin         BOOLEAN NOT NULL DEFAULT TRUE,
    default_major_id    VARCHAR(50),
    default_year_id     VARCHAR(50),
    ai_scope            VARCHAR(10) NOT NULL DEFAULT 'file',
    reduce_motion       BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    body        TEXT,
    type        VARCHAR(30) NOT NULL,   -- 'material_new' | 'request_approved' | 'admin_update'
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read);

-- =============================================
-- AI ASSISTANT
-- =============================================
CREATE TABLE chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    file_id     UUID NOT NULL REFERENCES files(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL,   -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id     UUID NOT NULL REFERENCES files(id),
    content     TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_notes_user_file ON user_notes(user_id, file_id);

-- =============================================
-- AUDIT LOG (admin)
-- =============================================
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID NOT NULL REFERENCES users(id),
    action      VARCHAR(50) NOT NULL,
    target_type VARCHAR(30),
    target_id   UUID,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);
```

---

## 3. Authentication – Task 1

> **Frontend source:** `src/services/authService.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/sign-up` | Register a new user |
| `POST` | `/api/auth/sign-in` | Login, returns JWT |
| `POST` | `/api/auth/forgot-password` | Send password reset email |
| `POST` | `/api/auth/reset-password` | Reset password with token |
| `GET`  | `/api/me/profile` | Get current user profile from JWT |

### Sign Up
```
POST /api/auth/sign-up
Body: { name: string, email: string, password: string }
Response 201: { user: User, token: string }
Errors: 409 if email exists
```

### Sign In
```
POST /api/auth/sign-in
Body: { email: string, password: string }
Response 200: { user: User, token: string }
Errors: 401 if credentials invalid
```

### Forgot Password
```
POST /api/auth/forgot-password
Body: { email: string }
Response 200: { message: "Reset email sent" }
→ Send email with reset link containing a short-lived token
```

### Reset Password
```
POST /api/auth/reset-password
Body: { token: string, newPassword: string }
Response 200: { message: "Password updated" }
```

---

## 4. Catalog API – Task 2

> **Frontend source:** `src/services/catalogService.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/majors` | List all majors |
| `GET` | `/api/years` | List all academic years |
| `GET` | `/api/semesters` | List all semesters |
| `GET` | `/api/courses?major_id=&semester_id=` | List courses with optional filters |
| `GET` | `/api/lecturers?course_id=` | List lecturers for a course |

These are simple read-only endpoints. Consider caching with `Cache-Control` headers (data rarely changes).

---

## 5. Files API – Task 3

> **Frontend source:** `src/services/fileService.ts`, `src/queries/useFiles.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files?course_id=&type=&lecturer_id=&search=` | List files with filters |
| `GET` | `/api/files/:id` | Get single file details |
| `GET` | `/api/files/:id/contributors` | Top contributors for a file/course |
| `GET` | `/api/files/:id/download` | Download a file (increment counter) |

### List Files
```
GET /api/files?course_id=cs101&type=summary&search=algo
Response 200: File[]
SQL: SELECT * FROM files WHERE course_id = ? AND type = ? AND title ILIKE '%' || ? || '%'
```

### Get File
```
GET /api/files/:id
Response 200: File
SQL: SELECT * FROM files WHERE id = ?
```

---

## 6. Tasks API – Task 4

> **Frontend source:** `src/hooks/useTasks.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me/tasks` | List all tasks for current user |
| `POST` | `/api/me/tasks` | Create a new task |
| `PATCH` | `/api/me/tasks/:taskId` | Update task (toggle complete, edit title, etc.) |
| `DELETE` | `/api/me/tasks/:taskId` | Delete a task |

### Create Task
```
POST /api/me/tasks
Body: { title: string, date: string, startHour: number, duration: number, priority: "urgent"|"high"|"normal" }
Response 201: Task (with server-generated id & createdAt)
SQL: INSERT INTO tasks (user_id, title, date, start_hour, duration, priority) VALUES (?, ?, ?, ?, ?, ?)
```

### Toggle Completion
```
PATCH /api/me/tasks/:taskId
Body: { completed: boolean }
Response 200: Task
SQL: UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?
```

### Delete Task
```
DELETE /api/me/tasks/:taskId
Response 204
SQL: DELETE FROM tasks WHERE id = ? AND user_id = ?
```

---

## 7. Pinned Courses API – Task 5

> **Frontend source:** `src/hooks/usePinnedCourses.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me/pinned-courses` | Get list of pinned course IDs |
| `POST` | `/api/me/pinned-courses/:courseId` | Pin a course |
| `DELETE` | `/api/me/pinned-courses/:courseId` | Unpin a course |

### Pin Course
```
POST /api/me/pinned-courses/:courseId
Response 201
SQL: INSERT INTO pinned_courses (user_id, course_id) VALUES (?, ?) ON CONFLICT DO NOTHING
```

### Unpin Course
```
DELETE /api/me/pinned-courses/:courseId
Response 204
SQL: DELETE FROM pinned_courses WHERE user_id = ? AND course_id = ?
```

---

## 8. Recent Files API – Task 6

> **Frontend source:** `src/hooks/useRecentFiles.ts`, `src/services/fileService.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me/recent-files` | Get recently viewed files (sorted by viewedAt DESC) |
| `POST` | `/api/me/recent-files/:fileId` | Mark file as recently viewed (UPSERT) |
| `DELETE` | `/api/me/recent-files` | Clear all recent files |

### Mark as Viewed
```
POST /api/me/recent-files/:fileId
Response 201
SQL: INSERT INTO user_recent_files (user_id, file_id, viewed_at) VALUES (?, ?, NOW())
     ON CONFLICT (user_id, file_id) DO UPDATE SET viewed_at = NOW()
```

### List Recent
```
GET /api/me/recent-files
Response 200: RecentFile[]
SQL: SELECT f.*, urf.viewed_at FROM user_recent_files urf
     JOIN files f ON f.id = urf.file_id
     WHERE urf.user_id = ? ORDER BY urf.viewed_at DESC LIMIT 20
```

---

## 9. File Requests API – Task 7

> **Frontend source:** `src/services/requestService.ts`, `src/queries/useRequests.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/requests` | Submit a new file request |
| `GET` | `/api/me/requests` | List current user's requests |
| `DELETE` | `/api/me/requests/:id` | Withdraw a pending request |
| `GET` | `/api/admin/requests?status=` | *(Admin)* List all requests |
| `PATCH` | `/api/admin/requests/:id/approve` | *(Admin)* Approve a request |
| `PATCH` | `/api/admin/requests/:id/reject` | *(Admin)* Reject a request |
| `POST` | `/api/admin/requests/bulk` | *(Admin)* Bulk approve/reject |

### Submit Request
```
POST /api/requests
Body: { courseId: string, title: string, type: string, fileUrl: string }
Response 201: FileRequest
```

### Approve Request
```
PATCH /api/admin/requests/:id/approve
Body: { adminNote?: string, pointsAwarded: number }
Response 200: FileRequest
→ Must: create the File entry, award points (idempotent!), log to audit
```

### Reject Request
```
PATCH /api/admin/requests/:id/reject
Body: { adminNote: string }
Response 200: FileRequest
→ Must: log to audit
```

> ⚠️ **Security:** All `/api/admin/*` endpoints must verify `user.role === "admin"`.  
> ⚠️ **Idempotency:** Points awarding on approval must be idempotent (don't double-award on retry).

---

## 10. Reputation API – Task 8

> **Frontend source:** `src/services/reputationService.ts`, `src/queries/useReputation.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me/reputation` | Get current user's reputation summary |
| `GET` | `/api/leaderboard` | *(Optional)* Top users by points |

### Reputation Summary
```
GET /api/me/reputation
Response 200: {
    totalPoints: number,
    uploadsApproved: number,
    currentBadge: "newcomer" | "contributor" | "expert" | "legend",
    nextBadge: string | null,
    pointsToNext: number
}

SQL:
  SELECT COALESCE(SUM(points), 0) AS total_points,
         COUNT(*) FILTER (WHERE action = 'upload_approved') AS uploads_approved
  FROM reputation_events WHERE user_id = ?
```

### Badge Tiers
| Badge | Min Points |
|-------|-----------|
| Newcomer | 0 |
| Contributor | 50 |
| Expert | 200 |
| Legend | 500 |

---

## 11. User Settings API – Task 9

> **Frontend source:** `src/components/pages/Settings.tsx`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me/settings` | Get user preferences |
| `PATCH` | `/api/me/settings` | Update user preferences (partial) |

### Get Settings
```
GET /api/me/settings
Response 200: {
    language: string,
    theme: "system" | "light" | "dark",
    textSize: "small" | "medium" | "large",
    notifications: { newMaterials: boolean, adminUpdates: boolean },
    defaultMajorId: string | null,
    defaultYearId: string | null,
    aiScope: "file" | "course" | "all",
    reduceMotion: boolean
}
→ Auto-create default row on first GET if none exists (UPSERT pattern)
```

### Update Settings
```
PATCH /api/me/settings
Body: Partial<UserSettings>  (only send changed fields)
Response 200: UserSettings (full updated object)
```

---

## 12. Notifications API – Task 10

> **Frontend source:** `src/components/layout/AppShell.tsx`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me/notifications` | List notifications (paginated) |
| `GET` | `/api/me/notifications/unread-count` | Get unread badge count |
| `PATCH` | `/api/me/notifications/:id/read` | Mark one as read |
| `PATCH` | `/api/me/notifications/read-all` | Mark all as read |

### Unread Count
```
GET /api/me/notifications/unread-count
Response 200: { count: number }
SQL: SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = FALSE
→ Frontend polls this every 30 seconds (or use WebSocket)
```

### Trigger Notifications
Create notifications server-side when:
- A user's file request is approved/rejected
- New material is added to a course the user is enrolled in
- Admin broadcasts an update

---

## 13. AI Assistant API – Task 11

> **Frontend source:** `src/components/assistant/AssistantPanel.tsx`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/assistant/chat` | Send message, get AI response |
| `GET` | `/api/me/notes?fileId=` | Get user's notes for a file |
| `POST` | `/api/me/notes` | Create/update a note |

### Chat Endpoint
```
POST /api/assistant/chat
Headers: Accept: text/event-stream  (for streaming)
Body: {
    fileId: string,
    message: string,
    conversationHistory: { role: "user"|"assistant", content: string }[]
}
Response 200 (streaming SSE):
    data: {"token": "The"}
    data: {"token": " answer"}
    data: {"token": " is..."}
    data: {"done": true, "sources": [{"page": 12, "title": "Algorithm Complexity"}]}

Response 200 (non-streaming fallback):
    { content: string, sources: { page: number, title: string }[] }
```

### Implementation Notes
1. Extract text from the uploaded file (PDF/DOCX parsing)
2. Create embeddings for RAG (Retrieval-Augmented Generation)
3. Build prompt with: system instructions + file context + conversation history + user question
4. Call LLM API (OpenAI, Gemini, etc.)
5. Stream response tokens back via SSE
6. Optionally persist chat history in `chat_sessions` / `chat_messages`

### Notes CRUD
```
GET /api/me/notes?fileId=xxx
Response 200: { id: string, content: string, updatedAt: string }[]

POST /api/me/notes
Body: { fileId: string, content: string }
Response 201: { id, content, updatedAt }
SQL: INSERT ... ON CONFLICT (user_id, file_id) DO UPDATE SET content = ?, updated_at = NOW()
```

---

## 14. Admin Endpoints – Task 12

> **Frontend source:** `src/services/requestService.ts`

All admin endpoints require middleware: `requireRole("admin")`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/requests?status=&page=&limit=` | List all requests |
| `PATCH` | `/api/admin/requests/:id/approve` | Approve + create file + award points |
| `PATCH` | `/api/admin/requests/:id/reject` | Reject with note |
| `POST` | `/api/admin/requests/bulk` | Bulk approve/reject |
| `GET` | `/api/admin/audit-logs?page=&limit=` | View audit trail |

### Approve Flow (important!)
When approving a request, the backend must:
1. Update `file_requests` status to `'approved'`
2. Create a new entry in `files` table from the request data
3. Award reputation points (INSERT into `reputation_events`) — **must be idempotent**
4. Create a notification for the uploader
5. Log the action in `audit_logs`

All of these should be in a **database transaction**.

---

## 15. Audit Logs API – Task 13

> **Frontend source:** `src/services/auditService.ts`, `src/queries/useAudit.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/audit-logs?page=&limit=` | List audit log entries |

```
GET /api/admin/audit-logs?page=1&limit=50
Response 200: {
    data: AuditLog[],
    total: number
}
SQL: SELECT al.*, u.name AS admin_name FROM audit_logs al
     JOIN users u ON u.id = al.admin_id
     ORDER BY al.created_at DESC LIMIT ? OFFSET ?
```

### When to Write Audit Logs
- Request approved/rejected
- User role changed
- File deleted
- Bulk operations

---

## 16. Implementation Priority

Recommended order (dependencies flow downward):

| Priority | Task | Why |
|----------|------|-----|
| 🔴 P0 | **Auth** (Task 1) | Everything depends on JWT |
| 🔴 P0 | **Catalog** (Task 2) | Core navigation depends on it |
| 🔴 P0 | **Files** (Task 3) | Main content of the app |
| 🟡 P1 | **File Requests** (Task 7) | Users need to upload content |
| 🟡 P1 | **Reputation** (Task 8) | Tied to request approval |
| 🟡 P1 | **Tasks** (Task 4) | Learning plan feature |
| 🟢 P2 | **Recent Files** (Task 6) | Dashboard "Continue Studying" |
| 🟢 P2 | **Pinned Courses** (Task 5) | Quick access feature |
| 🟢 P2 | **Settings** (Task 9) | User preferences |
| 🟢 P2 | **Notifications** (Task 10) | Nice to have |
| 🔵 P3 | **Admin + Audit** (Tasks 12–13) | Admin panel |
| 🔵 P3 | **AI Assistant** (Task 11) | Requires LLM integration |

---

## Quick Reference: All Endpoints

```
POST   /api/auth/sign-up
POST   /api/auth/sign-in
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/me/profile

GET    /api/majors
GET    /api/years
GET    /api/semesters
GET    /api/courses
GET    /api/lecturers

GET    /api/files
GET    /api/files/:id
GET    /api/files/:id/contributors
GET    /api/files/:id/download

GET    /api/me/tasks
POST   /api/me/tasks
PATCH  /api/me/tasks/:taskId
DELETE /api/me/tasks/:taskId

GET    /api/me/pinned-courses
POST   /api/me/pinned-courses/:courseId
DELETE /api/me/pinned-courses/:courseId

GET    /api/me/recent-files
POST   /api/me/recent-files/:fileId
DELETE /api/me/recent-files

POST   /api/requests
GET    /api/me/requests
DELETE /api/me/requests/:id

GET    /api/me/reputation
GET    /api/leaderboard

GET    /api/me/settings
PATCH  /api/me/settings

GET    /api/me/notifications
GET    /api/me/notifications/unread-count
PATCH  /api/me/notifications/:id/read
PATCH  /api/me/notifications/read-all

POST   /api/assistant/chat
GET    /api/me/notes
POST   /api/me/notes

GET    /api/admin/requests
PATCH  /api/admin/requests/:id/approve
PATCH  /api/admin/requests/:id/reject
POST   /api/admin/requests/bulk
GET    /api/admin/audit-logs
```

**Total: 37 endpoints**

---

> 💡 **Tip:** Search the frontend codebase for `@backend` to see exactly where each endpoint is consumed and what response shape is expected.
