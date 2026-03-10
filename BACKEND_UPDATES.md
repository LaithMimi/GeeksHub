# Frontend → Backend Handoff: What Changed & What's Needed

> **Date**: March 9, 2026  
> **Author**: AI Assistant (frontend refactoring session)

---

## Summary

The frontend has been refactored to eliminate hardcoded identities, create a centralized API client, and prepare for real backend integration. This document lists what changed and what the backend needs to support.

## 1. New Signup Flow & `major_id` Requirement
The Signup frontend form no longer uses OAuth and now requires the student to select an academic major from a dropdown.

**Backend Changes Made**:
- `models.py`: Added `major_id` (foreign key UUID linking to the `majors` table) to the `User` DB model and `UserSignUp` Pydantic payload. Added clear Docstrings to all DB models.
- `main.py`: Updated the `POST /api/v1/signup` endpoint to extract `major_id` from the payload and insert it during User creation. 
- `main.py`: Removed the `current_user` dependency from `GET /api/v1/majors`. **This endpoint must remain public** because unauthenticated users need to fetch the list of majors to populate the dropdown during signup.
- **Database Migration**: A quick python script (`add_column.py`) was executed to manually run `ALTER TABLE users ADD COLUMN major_id UUID REFERENCES majors(id);` against the Neon database.

---

## 2. New API Client — `src/lib/apiClient.ts`

A centralized fetch wrapper is now in place:

```ts
import { api, ApiError } from "@/lib/apiClient";

// Usage example
const majors = await api<Major[]>("/majors");
```

**Key behaviors:**
- Base URL: `VITE_API_URL` env var or defaults to `http://localhost:8000/api/v1`
- Auto-injects `Authorization: Bearer <token>` from `localStorage`
- Sends `credentials: "include"` (ready for HTTP-only cookies)
- Throws `ApiError` with `status`, `message`, `data` on non-`2xx` responses
- Handles `204 No Content` gracefully

### 🔴 Backend Action Required: HTTP-Only Cookies

The frontend is ready to switch from `localStorage` tokens to HTTP-only cookies. When the backend is ready:

1. On `POST /api/v1/signin` → set response header:
   ```
   Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/
   ```
2. On `POST /api/v1/signout` → clear the cookie:
   ```
   Set-Cookie: token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0
   ```
3. Frontend will remove the `Authorization` header logic from `apiClient.ts` (marked with `@backend` comment)

---

## 2. Admin Identity No Longer Hardcoded

Previously, admin actions (approve, reject, bulk operations, undo) used a hardcoded `DEMO_ADMIN` object:

```ts
// OLD
DEMO_ADMIN = { id: "admin1", name: "Admin User", role: "ADMIN" }
```

**Now**, admin identity comes from `useAuth()` — the actually logged-in user's `id`, `displayName`, and `email`.

### Backend Expectations

Admin endpoints should validate the admin's identity server-side:

| Endpoint | Auth |
|---|---|
| `PATCH /api/admin/file-requests/:id/approve` | Verify JWT belongs to admin role |
| `PATCH /api/admin/file-requests/:id/reject` | Same |
| `POST /api/admin/file-requests/bulk-approve` | Same |
| `POST /api/admin/file-requests/bulk-reject` | Same |
| `POST /api/admin/file-requests/:id/undo-approve` | Same |
| `POST /api/admin/file-requests/:id/undo-reject` | Same |

The `adminId` and `adminName` should come from the JWT claims, **not** from the request body. The frontend sends them for audit logging in the mock, but the backend should derive them from the authenticated user.

---

## 3. User Identity No Longer Hardcoded

Previously, `userId: "u1"` was hardcoded in file upload requests and user uploads pages.

**Now**, the frontend reads `user.id` from `AuthContext` (populated from the auth response).

### Backend Expectation

The user ID for operations like `POST /api/file-requests` should come from the JWT, not from the request body. The backend should:

1. Extract `userId` from the JWT token (not trust the client-sent `userId`)
2. Return the user's `id`, `name`, `email`, and `role` in the signin response

---

## 4. Service Layer — Function Signature Changes

### `requestService.ts`

The following functions had their signatures updated (removed default parameters):

| Function | Old Params | New Params |
|---|---|---|
| `approveRequest` | `(requestId, adminId, adminName = DEMO_ADMIN.name)` | `(requestId, adminId, adminName)` |
| `rejectRequest` | `(requestId, adminId, reason, note?, adminName = DEMO_ADMIN.name)` | `(requestId, adminId, reason, adminName, note?)` |
| `bulkApprove` | `(requestIds, adminId, adminName = DEMO_ADMIN.name)` | `(requestIds, adminId, adminName)` |
| `bulkReject` | `(requestIds, adminId, reason, adminName = DEMO_ADMIN.name)` | `(requestIds, adminId, reason, adminName)` |
| `undoApprove` | `(requestId, adminId, adminName = DEMO_ADMIN.name)` | `(requestId, adminId, adminName)` |
| `undoReject` | `(requestId, adminId, adminName = DEMO_ADMIN.name)` | `(requestId, adminId, adminName)` |

> **Note**: `rejectRequest` param order changed — `adminName` moved before `note?`.

---

## 5. Files Deleted

| File | Reason |
|---|---|
| `src/hooks/useRecentFiles.ts` | Duplicate of `queries/useFiles.ts` (`useRecentFiles` query hook). localStorage-based version removed. |

---

## 6. Auth Flow Changes

- `signOut()` now clears **both** `mock_user_session` and `token` from `localStorage`
- Frontend sends `credentials: "include"` on all API calls (ready for cookies)

---

## 7. Still Pending (Backend Blockers)

These issues remain open and require backend work:

| # | Issue | Backend Endpoint Needed |
|---|---|---|
| 1 | Approved files are lost — approval flow deletes metadata | Fix `POST /api/v1/admin/requests/{id}/approve` to persist to `files` table |
| 2 | No file listing | Implement `GET /api/v1/files?courseId=&type=&lecturerId=` |
| 3 | No real recent files | Implement `GET /api/v1/me/recent-files` + `POST /api/v1/me/recent-files` |
| 4 | No password reset | Implement `POST /api/v1/reset-password` |
| 5 | No user reputation API | Implement `GET /api/v1/me/reputation` |
| 6 | No top contributors API | Implement `GET /api/v1/contributors/top` |
| 7 | No audit log API | Implement `GET /api/v1/admin/audit-logs` |

---

## 8. Dashboard Metric Endpoints Required

The frontend Dashboard currently has 4 "Metric Cards" that require real data from the backend to be fully accurate. Please implement the following endpoints in priority order:

| Priority | Feature / Card | Endpoint Needed | Expected Response | Rationale |
|---|---|---|---|---|
| **1** | XP Earned | `GET /api/me/reputation` | `{ totalPoints: number, level: number, ... }` | Easiest. Data already exists in mock; just needs a real query returning user's points based on approved uploads. |
| **2** | Courses Active | `GET /api/me/courses/active` | `[ { courseId: string, ... } ]` | Returns distinct courses the user has file activity in or is explicitly enrolled in. Currently, frontend artificially guesses this from recent files. |
| **3** | Tasks Done | `GET /api/me/tasks` | `[ { id: string, completed: boolean, ... } ]` | Required to move user schedule/tasks off `localStorage` so they sync across devices. Used to calculate the completion rate. |
| **4** | Study Hours | `GET /api/me/study-hours` | `{ hours: number }` | Requires building dedicated session tracking (recording `session_start` when a file opens and `session_end` when closed). Dashboard displays `"—"` until this exists. |

# GeeksHub — Backend API Tasks

The frontend logic is currently decoupled using TanStack Query, which points to a mocked `mock-db` service layer. To fully integrate the frontend with the live database, the following endpoints must be implemented.

## 🟢 Completed & Working
* **`POST /api/v1/signup`** – Returns `auth_token` HttpOnly cookie.
* **`POST /api/v1/signin`** – Returns `auth_token` HttpOnly cookie & validates emails.
* **`POST /api/v1/forgot-password`** – Calls Auth0 to issue a reset link.
* **`GET /api/v1/me`** – Fetches current verified profile.
* **`GET /api/v1/majors`** – Lists all available majors.
* **`GET /api/v1/courses`** – Lists courses (supports search and UUID filters).
* **`POST /api/v1/requests`** – Submits a file upload request.

***

## 🔴 Missing Endpoints (To Be Built)

### 1. Catalog Service ([catalogService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/catalogService.ts))
The [Courses](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/components/pages/Courses.tsx#18-370) library hierarchy depends on these specific dropdown lookups.
* [ ] **`GET /api/v1/years`** — Return all available academic years. (Or determine if years should just be statically resolved from [courses](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/server/main.py#231-255)).
* [ ] **`GET /api/v1/semesters`** — Return all available semesters. (Or statically resolve from [courses](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/server/main.py#231-255)).
* [ ] **`GET /api/v1/courses/:id`** — Return details for a single specific course.
* [ ] **`GET /api/v1/lecturers?courseId=...`** — Return a distinct list of lecturers who have taught the specified course.

### 2. File Delivery & Material Browsing ([fileService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/fileService.ts))
* [ ] **`GET /api/v1/files?courseId=...&type=...&lecturerId=...`** — Search and list all `APPROVED` material files for a given course. Supports pagination and searching.
* [ ] **`GET /api/v1/files/:id`** — Returns single file metadata (and optionally the pre-signed GCS download URL).
* [ ] **`GET /api/v1/contributors/top?limit=5`** — Calculate and return the users with the highest sum of points across `points_transactions` for the leaderboard.
* [ ] **`GET /api/v1/me/recent-files`** — Fetch the user's recently viewed/opened files history, sorted by `viewed_at`.
* [ ] **`POST /api/v1/me/recent-files/:fileId`** — Mark a specific file ID as recently viewed (using an upsert).
* [ ] **`DELETE /api/v1/me/recent-files`** — Clear the user's recent files history.

### 3. File Requests & Admin Moderation ([requestService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/requestService.ts))
While basic request submission and approval exist in [main.py](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/server/main.py), the frontend dashboard requires comprehensive list endpoints.
* [ ] **`GET /api/v1/me/file-requests`** — List all requests submitted by the current authenticated user.
* [ ] **`DELETE /api/v1/me/file-requests/:requestId`** — Allow a user to withdraw/cancel their own `PENDING` request.
* [ ] **`GET /api/v1/admin/file-requests`** — Return all requests (for Admin dashboard). Must filter by status (`PENDING`, `APPROVED`, etc).
* [ ] **`POST /api/v1/admin/file-requests/bulk-approve`** — Accept an array of UUIDs to approve them all at once.
* [ ] **`POST /api/v1/admin/file-requests/bulk-reject`** — Accept an array of UUIDs (and rejection reason) to reject them all at once.
* [ ] **`GET /api/v1/admin/file-requests/stats`** — Return aggregate counts for the dashboard (total pending, approved today, rejected today, etc).

### 4. Reputation & Gamification ([reputationService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/reputationService.ts))
* [ ] **`GET /api/v1/me/reputation`** — Calculate and return the user's total points and badge tier (e.g., Gold > 1000, Silver > 500), alongside their last ~20 point transactions.

### 5. AI Assistant ([assistantService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/assistantService.ts))
* [ ] **`POST /api/v1/assistant/chat`** — RAG endpoint to send messages to the AI about a specific file.
* [ ] **`GET /api/v1/me/notes?fileId=...`** — Retrieve a user's private text notes associated with a document.
* [ ] **`POST /api/v1/me/notes`** — Save/Update a user's private text notes for a document.

### 6. Admin Audit Log ([auditService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/auditService.ts))
* [ ] **`GET /api/v1/admin/audit-logs`** — Returns an action history trail (e.g., "Admin X approved File Y") sorted by timestamp descending, with pagination.

***

*Notes for Backend Developer: All these frontend services are currently mapped to a mocked in-memory database using local timeouts. Their parameters and expected return contracts are strictly typed inside the frontend repository under [src/types/domain.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/types/domain.ts). As soon as the endpoints are stood up, the frontend can be wired up by simply pointing the Axios wrappers inside `src/services/*` to the live urls.*
