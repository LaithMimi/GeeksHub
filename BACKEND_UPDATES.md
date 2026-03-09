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
