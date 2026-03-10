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
