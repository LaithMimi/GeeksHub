# GeeksHub – Backend Implementation Tasks

> **For:** Backend Engineer  
> **Frontend Stack:** React + TypeScript + TanStack Query  
> **Last Updated:** March 10, 2026  

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
| **Base URL** | `/api/v1` |
| **Auth** | `HttpOnly` JWT cookie (`auth_token`) — Sent automatically via `credentials: "include"` |
| **User context** | All protected endpoints extract user from the JWT cookie automatically |
| **Responses** | JSON, with appropriate HTTP status codes |
| **Errors** | HTTPException JSON structure |
| **Pagination** | `?page=1&limit=20` where applicable, response: `{ data: T[], total: number }` |
| **Timestamps** | ISO 8601 strings (e.g. `2026-03-10T10:00:00Z`) |

---

## 2. Database Schema

*(Schema remains unchanged — verify against `server/models.py` for exact SQLModel implementations).*

---

## 3. Authentication – Task 1 (✅ COMPLETED)

> **Status: Implemented in `main.py`** 

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/signup` | Register via Auth0 + local Neon DB | ✅ |
| `POST` | `/api/v1/signin` | Login, sets HTTP-only `auth_token` cookie | ✅ |
| `POST` | `/api/v1/signout`| Clears `auth_token` cookie | ✅ |
| `POST` | `/api/v1/forgot-password` | Send Auth0 password reset email | ✅ |
| `GET`  | `/api/v1/me` | Get current user profile from JWT cookie | ✅ |

---

## 4. Catalog API – Task 2

> **Frontend source:** `src/services/catalogService.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/majors` | List all majors | ✅ |
| `GET` | `/api/v1/courses?major_id=&year_id=&query=` | List courses with filters | ✅ |
| `GET` | `/api/v1/years` | List all academic years | 🔴 |
| `GET` | `/api/v1/semesters` | List all semesters | 🔴 |
| `GET` | `/api/v1/lecturers?course_id=` | List lecturers for a course | 🔴 |

---

## 5. Files API – Task 3

> **Frontend source:** `src/services/fileService.ts`, `src/queries/useFiles.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/files/{file_id}/download` | Generate signed GCS URL | ✅ |
| `GET` | `/api/v1/files?course_id=&type=&lecturer_id=&search=` | List files with filters | 🔴 |
| `GET` | `/api/v1/files/:id` | Get single file metadata | 🔴 |
| `GET` | `/api/v1/files/:id/contributors` | Top contributors for a file/course | 🔴 |

---

## 6. Tasks API – Task 4 (🟡 MOCKED)

> **Frontend source:** `src/hooks/useTasks.ts` (Currently LocalStorage)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/tasks` | List all tasks for current user | 🔴 |
| `POST` | `/api/v1/me/tasks` | Create a new task | 🔴 |
| `PATCH` | `/api/v1/me/tasks/:taskId` | Update task (toggle complete, edit title) | 🔴 |
| `DELETE` | `/api/v1/me/tasks/:taskId` | Delete a task | 🔴 |

---

## 7. Pinned Courses API – Task 5 (🟡 MOCKED)

> **Frontend source:** `src/hooks/usePinnedCourses.ts` (Currently LocalStorage)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/pinned-courses` | Get list of pinned course IDs | 🔴 |
| `POST` | `/api/v1/me/pinned-courses/:courseId` | Pin a course | 🔴 |
| `DELETE` | `/api/v1/me/pinned-courses/:courseId`| Unpin a course | 🔴 |

---

## 8. Recent Files API – Task 6 

> **Frontend source:** `src/queries/useFiles.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/recent-files` | Get recently viewed files | 🔴 |
| `POST` | `/api/v1/me/recent-files/:fileId` | Mark file as recently viewed (UPSERT) | 🔴 |
| `DELETE` | `/api/v1/me/recent-files` | Clear all recent files | 🔴 |

---

## 9. File Requests API – Task 7 (🚧 PARTIAL)

> **Frontend source:** `src/services/requestService.ts`, `src/queries/useRequests.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/courses/{course_id}/upload` | Upload file to GCS & submit request | ✅ |
| `PATCH` | `/api/v1/admin/requests/{request_id}/approve` | Approve/reject (moves/deletes GCS blob) | ✅ |
| `GET` | `/api/v1/me/requests` | List current user's requests | 🔴 |
| `DELETE` | `/api/v1/me/requests/:id` | Withdraw a pending request | 🔴 |
| `GET` | `/api/v1/admin/requests?status=` | *(Admin)* List all requests | 🔴 |
| `POST` | `/api/v1/admin/requests/bulk` | *(Admin)* Bulk approve/reject | 🔴 |

---

## 10. Reputation API – Task 8

> **Frontend source:** `src/services/reputationService.ts`, `src/queries/useReputation.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/reputation` | Get current user's reputation summary | 🔴 |
| `GET` | `/api/v1/leaderboard` | Top users by points | 🔴 |

---

## 11. User Settings API – Task 9 (🟡 MOCKED)

> **Frontend source:** `src/components/pages/Settings.tsx` (Currently LocalStorage)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/settings` | Get user preferences | 🔴 |
| `PATCH` | `/api/v1/me/settings` | Update user preferences | 🔴 |

---

## 12. Notifications API – Task 10

> **Frontend source:** `src/components/layout/AppShell.tsx`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/notifications` | List notifications (paginated) | 🔴 |
| `GET` | `/api/v1/me/notifications/unread-count`| Get unread badge count | 🔴 |
| `PATCH` | `/api/v1/me/notifications/:id/read` | Mark one as read | 🔴 |
| `PATCH` | `/api/v1/me/notifications/read-all`| Mark all as read | 🔴 |

---

## 13. AI Assistant API – Task 11 

> **Frontend source:** `src/components/assistant/AssistantPanel.tsx`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/assistant/chat` | Send message, get AI response | 🔴 |
| `GET` | `/api/v1/me/notes?fileId=` | Get user's notes for a file | 🔴 |
| `POST` | `/api/v1/me/notes` | Create/update a note | 🔴 |

---

## 14. Admin Statistics Endpoints – Task 12

> **Frontend source:** `src/components/pages/admin/AdminHome.tsx`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/admin/stats/users` | Total users, active users | 🔴 |
| `GET` | `/api/v1/admin/stats/requests`| Pending, approved, rejected today | 🔴 |

---

## 15. Audit Logs API – Task 13

> **Frontend source:** `src/services/auditService.ts`, `src/queries/useAudit.ts`

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/admin/audit-logs?page=&limit=` | List audit log entries | 🔴 |

---

## 16. Implementation Priority & Status Summary

**Completed:**
✅ Full Authentication & Cookie Security
✅ Active Profile fetching
✅ Major & Course catalog lookups
✅ GCS File Upload routing
✅ Adobe PDF Download URL generation
✅ Admin single-file approve/reject via GCS move operations

**Pending Priority (Do Next):**
🟡 **P1:** `GET /api/v1/files` (Course Materials list)
🟡 **P1:** `GET /api/v1/me/requests` and `GET /api/v1/admin/requests` (Moderation Dashboard)
🟡 **P2:** Reputation & Points tracking (Triggered on Approval)
🟡 **P3:** Local Storage Migrations (Tasks, Recent Files, Pinned Courses)
🔵 **P4:** AI Assistant chat & Notes

> 💡 **Tip:** The frontend routing intercepts all requests sent to `/api/v1/*`. Use the "Status" columns above to find the next logical blank spot to build out inside `server/main.py`.
