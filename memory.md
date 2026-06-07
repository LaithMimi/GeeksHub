# GeeksHub — Project Memory

> This file is intended for AI agents and future developers to quickly understand the GeeksHub project structure, conventions, tech stack, and current state.

---

## 1. What is GeeksHub?

A university course materials platform where students **share, browse, and study** lecture files (PDFs, slides, notes, exams). Students earn **reputation points** for approved uploads. Admins moderate file requests via a moderation queue.

---

## 1.0 Highlights of Recent Updates (June 7 2026 — Latest)

- **OCR Fallback for Image-Heavy PDF/Slide Pages (June 7):**

  The embedding pipeline previously skipped pages with no selectable text (scanned slides, photo pages, image-only diagrams). Added a Google Cloud Vision OCR fallback that kicks in automatically for those pages.

  **How it works:**
  - `process_and_embed_pdf()` loops through every page as before, extracting text with `pypdf`.
  - If a page yields **zero characters** of selectable text, `pypdfium2` renders it as a 2x-resolution PNG.
  - That PNG is sent to **Google Cloud Vision** (`text_detection`), which reads any visible text from the image.
  - The OCR result replaces the empty text for that page and flows into the normal chunking + Gemini embedding pipeline — nothing else changes.
  - The Vision client is lazy-initialized (`_vision_client` global) so there's no startup cost when OCR isn't needed.
  - OCR only fires on pages with **zero** extractable text — title-only slides (e.g. "Introduction to Algorithms") still have selectable text and pass through normally without hitting the API.

  **Files changed:**
  - `server/utils/ai_utils.py` — added `_get_vision_client()`, `_ocr_page()`, and the OCR branch in the page loop.
  - `requirements.txt` — added `pypdfium2==5.9.0`, `google-cloud-vision==3.14.0`, `Pillow==12.2.0`.

  **Note:** Cloud Vision API must be enabled in the GCP project. Free tier is 1,000 pages/month; $1.50 per 1,000 after that. Existing GCP service account credentials cover it automatically.

- **PPTX Upload Support with Google Drive Conversion (June 7):**

  The system already accepted `.pptx` uploads but had no conversion — the file was stored as-is and the PDF viewer/embedding pipeline couldn't handle it. Added automatic PPTX → PDF conversion at admin approval time using the Google Drive API (no system dependencies required).

  **How it works:**
  - When an admin approves a `.pptx` file, `convert_pptx_to_pdf()` is called before the GCS move.
  - The PPTX bytes are uploaded to Google Drive with `mimeType: application/vnd.google-apps.presentation` — Drive auto-converts it to Google Slides.
  - The Google Slides file is immediately exported as PDF via `files().export_media()`.
  - The temp Drive file is deleted in a `finally` block (always cleaned up).
  - The PDF is uploaded to the final GCS path with a `.pdf` extension; the original PPTX is deleted.
  - `Material.file_url` always ends up pointing to a PDF — the viewer, streaming, and embedding pipeline are completely unchanged.
  - Drive service is lazy-initialized (`_drive_service` global).
  - Both `approve_file` and `bulk_approve_requests` use the same conversion logic.

  **Files changed:**
  - `server/utils/pptx_utils.py` — new file with `convert_pptx_to_pdf()` and `_get_drive_service()`.
  - `server/routers/admin.py` — both approval endpoints check for `.pptx` and call `convert_pptx_to_pdf()` before GCS move.
  - `requirements.txt` — added `google-api-python-client==2.197.0`.

  **Note:** Google Drive API must be enabled in the GCP project (GCP Console → APIs & Services → "Google Drive API" → Enable). Existing service account credentials cover it automatically. No installation needed on developer machines.

---

## 1.1 Highlights of Recent Updates (May 30 2026)

- **Admin UI Consistency + CatalogManager Enhancements (May 30):**

  **Lecturer search in CatalogManager:**
  - Each expanded `CourseRow` now has a live search input in the "Add Lecturer" section, filtering available lecturers by name as you type.
  - `lecturerSearch` state is scoped per row and resets automatically when the row is collapsed (`handleToggle` clears it on close).
  - Shows "No lecturers match your search." when the filter yields nothing.
  - Files changed: `src/features/admin/pages/CatalogManager.tsx`

  **AdminHome UI consistency:**
  - Rewrote `AdminHome.tsx` to match the liquid-glass design language used by CatalogManager and the rest of the admin pages.
  - Replaced shadcn `Card` components with `liquid-glass-subtle rounded-xl` divs.
  - Updated header to `text-[28px] font-display font-bold tracking-[-0.03em]` with a `LayoutDashboard` icon (same pattern as CatalogManager's `BookOpen` header).
  - Added `animate-fade-in max-w-3xl mx-auto pb-20` wrapper and `bg-foreground/10` kbd styling.
  - Files changed: `src/features/admin/pages/AdminHome.tsx`

- **AuditLog Bug Fixes (May 30):** See Bug Fixes table in §1.1 below.

---

## 1.2 Highlights of Recent Updates (Late May 2026)

- **Frontend Cleanliness Audit + 3-Phase Cleanup (May 22):** Full senior-engineer code review producing a 6.1/10 baseline score, followed by a four-phase incremental refactor. All changes verified via `tsc --noEmit`, `vitest run` (18/18 passing), `eslint .` (45 issues — down from 58 baseline), and `vite build`. No behavior changes intended; pure cleanup.

  **Phase 1 — Bug fixes & landmines:**
  - **Stale closure bug fixed** in `useViewerSession.ts`. The 5-second heartbeat interval was capturing initial `viewerEvents` state and calling `setViewerEvents` on every tick after completion. Replaced state-based guard with a `useRef` (`isCompletedRef`).
  - **Self-referential CSS deleted**: `--glow-blue: var(--glow-blue)` and `--glow-blue-soft: var(--glow-blue-soft)` removed from both `:root` and `.light` blocks in `index.css` (4 lines that produced no useful value).
  - **`SESSION_KEY` constant extracted** to `src/lib/constants.ts` (new file). Renamed `"mock_user_session"` → `"gh_user_session"` and replaced 8 hardcoded literals in `AuthContext.tsx`. Note: existing logged-in sessions are invalidated by the key change.
  - **Abandoned `usePinnedCourses()` call removed** from `Dashboard.tsx` (was being called with no destructuring — a no-op that ran a stale localStorage read every render).
  - **`BLOCK_COLORS` duplicate fixed**: index 3 changed from blue (duplicate of index 1) to violet. `progressColors` key renamed from `"purple"` to `"blue"` (matched the actual color it mapped to).

  **Phase 2 — Structural extraction:**
  - **Dashboard.tsx split** from 1,127 lines into ~580 lines plus three new files under `src/components/dashboard/`: `LearningPlan.tsx`, `MiniCalendar.tsx`, `AddTaskModal.tsx`. Each component has a typed Props interface and a single responsibility.
  - **`useDashboardData` hook** created in `src/hooks/`. Memoizes `recentCourses` (joins recent files → courses → requests → majors to compute progress %) and `weeklyActivity` (was running up to 350 filter passes per render unmemoized).
  - **`Loadable` generic typed**: `(props: any)` in `router.tsx` replaced with `<T extends object>(Component: React.ComponentType<T>) => (props: T) => ...`.
  - **`confirmPasswordReset` mock replaced** with a real `api()` call to `/reset-password`. Removed the unused `delay()` helper. Password length validation moved to `ResetPasswordForm.tsx` (form-level concern).
  - **Redundant `?? snake_case` fallbacks removed** from `AuthContext.tsx` (trusts `apiClient`'s `snakeToCamel` converter).

  **Phase 3 — Foundation hardening:**
  - **`authService.ts` typed end-to-end**: defined `AuthUserDTO`, `SignInResponse`, `SignUpResponse`, `SignInPayload`, `SignUpPayload`. All `any` removed. Replaced the `indexOf('{')`/`lastIndexOf('}')` string-parsing `formatAuthError` with `extractAuthErrorMessage(err: unknown, fallback)` that inspects `ApiError.data` directly. Lint errors dropped by 11.
  - **Vitest + React Testing Library + MSW installed** and configured. Added `vitest.config.ts`, `src/test/setup.ts`, `src/test/mocks/handlers.ts`, `src/test/mocks/server.ts`. Added npm scripts: `test`, `test:ui`, `test:run`.
  - **18 tests written**: 14 in `src/lib/__tests__/utils.test.ts` (covering `snakeToCamel`, `getGreeting`, `formatDeadline`); 4 in `src/hooks/__tests__/useTasks.test.tsx` (sort order, taskDates derivation, happy-path + error-path with MSW).
  - **`react-hooks/exhaustive-deps: 'error'`** enforced in `eslint.config.js`. Two pre-existing violations fixed: `defaultForm` hoisted out of `RequestFileModal` render scope; `FileViewer`'s PDF-stream effect deps narrowed from `file?.id` to the actually-read `fileTitle` + `fileDownloadUrl`.
  - **LearningPlan time window** changed from "now to now+8 hours" (which hid tasks outside that band) to fixed 7 AM – 10 PM.
  - **Utility extraction**: `getGreeting`, `formatDeadline` moved from Dashboard to `src/lib/utils.ts`. `snakeToCamel` exported from `apiClient.ts` for testability.

  **Phase 4 — Misc cleanups:**
  - **`.claude/**` added to `eslint.config.js` globalIgnores** — was scanning a stale worktree and inflating error counts.
  - **Backend venv re-synced** to `requirements.txt`. Installed missing packages: `pgvector` (0.3.6), `pypdf`, `google-genai`, `tenacity`.

- **LearningPlan UX rework (May 22, post-cleanup):** Major dashboard schedule rework based on user feedback.
  - **Day/Week toggle removed**. Schedule now shows 7 days starting from today. Navigation chevrons step by 7 days; "Today" resets to the current window. Day labels are `EEE d` (e.g. "Thu 22").
  - **Drag-to-move existing tasks**: clicking and dragging a task block repositions it. Supports both within-day and cross-day moves. Mutation flows through `useUpdateTask` hook → `PATCH /me/tasks/:id`.
  - **Drag-shadow UX**: while moving, the original spot stays visible at 30% opacity with a dashed border; a separate "ghost" preview block with bright ring + drop shadow follows the cursor in the destination row.
  - **Time format**: `2.5` → `2:30` everywhere on task blocks. New `formatHour(decimalHour)` helper in `src/lib/utils.ts`.
  - **AddTaskModal accepts arbitrary durations**: if the drag creates a block longer than 4 hours (the standard DURATIONS list cap), the dragged duration is dynamically added to the select options via a `useMemo`.

- **Bug Fixes (May 25):**

  | Bug | Where | Fix |
  |-----|-------|-----|
  | **UUID UI Leak** — Raw UUID strings (e.g. `123e4567-...`) were momentarily visible in the Course Library and Settings page dropdowns before real names loaded from the backend | `Courses.tsx`, `Settings.tsx`, `select.tsx` | Added a `displayValue` prop to `GlassSelect` / dropdown implementations that renders `"Loading…"` or a placeholder instead of the raw ID until data resolves |
  | **Notes Board Truncation** — Long AI responses were silently cut to 220 characters when pinned to the Notes Board | `NotesBoard.tsx` | Removed the 220-char hard truncation; added `max-h-[200px] overflow-y-auto` scroll container to `StickyCard` so full messages display without breaking the grid layout |
  | **Pin-to-Notes No-op** — Clicking "Pin to notes" from the Chat tab did nothing; `notesBoardRef.current` was always `null` because Radix `TabsContent` unmounts inactive tabs | `AssistantPanel.tsx` | Added `forceMount={true}` to both `TabsContent` nodes so the Notes board stays mounted in the DOM even when the Chat tab is active |
  | **LearningPlan Click-vs-Drag Drop** — Clicking a task to open its details modal failed intermittently; `pointer-events-none` was applied on `mousedown`, and if React batched before `mouseup` the click event was silently dropped | `LearningPlan.tsx` | Moved the click-to-open logic into the row-level `handleMouseUp` handler so quick taps with no drag movement reliably open the details dialog |
  | **Task Mutation Lag** — Adding or dragging a task caused a visible delay because the UI waited for the full server round-trip before re-rendering | `useTasks.ts` | Added `onMutate` optimistic-update handlers to all four mutations (`useCreateTask`, `useUpdateTask`, `useToggleTask`, `useDeleteTask`); UI updates instantly and rolls back on error |
  | **LearningPlan colorMap Re-render Loop** — `colorMap` was recreated on every render, causing cascade re-renders across all task blocks | `LearningPlan.tsx` | Shifted `colorMap` from `useState`/inline object to `useRef` so the reference is stable across renders |
  | **Dashboard O(n²) Filter** — `recentCourses` derivation in `useDashboardData` ran up to 350 nested `.filter()` passes per render on realistic data sizes | `useDashboardData.ts` | Replaced nested array iteration with an O(n) `Map` lookup keyed by course ID |

- **Bug Fixes (May 30):**

  | Bug | Where | Fix |
  |-----|-------|-----|
  | **AuditLog crash — `Cannot read properties of undefined (reading 'variant')`** — `actionConfig` keys were uppercase (`APPROVE`, `REJECT`, etc.) but the backend sends lowercase (`approve`, `reject`, etc.). `actionConfig[log.action]` returned `undefined`, and `undefined.variant` crashed the entire Admin area via the error boundary | `AuditLog.tsx`, `domain.ts` (`AuditAction` type) | Changed `AuditAction` type and `actionConfig` keys to lowercase to match what the backend actually sends; added `?? { label: log.action, variant: "outline" }` fallback so unknown future action values never crash |
  | **AuditLog crash — `meta_data` vs `metadata` field mismatch** — `snakeToCamel` in `apiClient.ts` converts the backend field `meta_data` → `metaData` (camelCase). The `AuditLogEntry` interface had `metadata` (no capital D) and `formatDetails` accessed `log.metadata.reason`, which was `undefined` at runtime, throwing a second crash after the first was fixed | `domain.ts` (`AuditLogEntry.metadata`), `AuditLog.tsx` (`formatDetails`) | Renamed `metadata` → `metaData` in `AuditLogEntry`; updated `formatDetails` to use `log.metaData ?? {}` with optional chaining |

---

## 1.3 Highlights of Recent Updates (May 29 2026)

- **P4 Backend + Frontend Completed (May 29):** All remaining localStorage-only features migrated to live API endpoints.

  **User Settings (`/me/settings`):**
  - New `UserSettings` table (1:1 with users, auto-created on first GET with defaults).
  - `GET /api/v1/me/settings` + `PATCH /api/v1/me/settings` — stores language, defaultMajorId, defaultYearId, notifyNewMaterials, notifyAdminUpdates, reduceMotion, compactMode.
  - `src/features/settings/services/settingsService.ts` (new). `Settings.tsx` loads from API on mount, debounces PATCH 600ms after each change, falls back to localStorage if API unreachable.

  **Pinned Courses (`/me/pinned-courses`):**
  - New `PinnedCourse` table (composite PK: user_id + course_id).
  - `GET`, `POST /{course_id}`, `DELETE /{course_id}` endpoints in `server/routers/pinned_courses.py`.
  - `usePinnedCourses.ts` rewritten with TanStack Query + optimistic updates. Public API (`pinnedIds`, `togglePin`, `isPinned`) unchanged — no component edits needed.

  **Notifications (`/me/notifications`):**
  - New `UserNotification` table (`id`, `user_id`, `title`, `message`, `read`, `created_at`).
  - `GET /me/notifications`, `GET /me/notifications/unread-count` (polled every 30s), `PATCH /me/notifications/{id}/read`, `PATCH /me/notifications/read-all`.
  - Backend creates notifications for the uploader inside `approve_file` and `reject_request` in `admin.py`.
  - `useInAppNotifications.ts` rewritten with TanStack Query. `addNotification` / `clearAll` removed — backend owns creation. `AppShell.tsx` updated (`timestamp` → `createdAt`). Stale `addNotification` calls removed from `useRequests.ts`.

  **Course-Lecturer Assignment (`/admin/courses/{id}/lecturers`):**
  - `GET /admin/courses/{courseId}/lecturers`, `POST /admin/courses/{courseId}/lecturers/{lecturerId}`, `DELETE /admin/courses/{courseId}/lecturers/{lecturerId}` added to `server/routers/admin.py` and `server/routers/catalog.py`.
  - `src/features/admin/pages/CatalogManager.tsx` (new): expandable course rows showing assigned lecturers + add/remove UI, with search filter.
  - `src/features/admin/api/catalogAdminService.ts` (new): `listAllCourses`, `listAllLecturers`, `getCourseLecturers`, `assignLecturer`, `unassignLecturer`.
  - "Catalog" nav item promoted from "coming soon" to a live link in `AdminShell.tsx`; `/admin/catalog` route wired in `router/index.tsx`.

---

## 1.4 Highlights of Recent Updates (Mid May 2026 — May 18)

- **Tasks Backend Fully Implemented (May 18):** Full CRUD API for user learning-plan tasks brought live.
  - **`server/models.py`**: Added `UserTask` SQLModel table with fields: `id` (UUID PK), `user_id` (FK → users), `title`, `date` (`"YYYY-MM-DD"` string — avoids TZ issues), `start_hour` (float, 0.5-step resolution), `duration` (float hours), `priority` (`"normal"` | `"high"` | `"urgent"`), `completed` (bool), `created_at`. Composite index on `(user_id, date)` for fast per-user day queries.
  - **`server/schemas.py`**: Added `TaskCreate`, `TaskPatch` (all fields optional), and `TaskResponse` Pydantic schemas. `TaskResponse` uses camelCase field names (`startHour`, `createdAt`) to match frontend conventions directly.
  - **`server/routers/tasks.py`**: New router mounted at `/api/v1/me/tasks`. Endpoints:
    - `GET /me/tasks` — returns all tasks for the authenticated user, ordered by date then start_hour.
    - `POST /me/tasks` (201) — creates a task; strips whitespace from title.
    - `PATCH /me/tasks/{task_id}` — partial update; 404 if task doesn't belong to current user.
    - `DELETE /me/tasks/{task_id}` (204) — deletes task; 404 if not owned by user.
  - **`server/main.py`**: `tasks.router` registered alongside the other routers.
  - **`server/models.py` (lecturers)**: `Lecturer.name` made `unique=True` (was just indexed). `email` field removed entirely — backend no longer stores lecturer email.

- **Frontend Tasks Refactor (May 18):** `useTasks.ts` rewritten to use the live backend; `taskService.ts` extracted.
  - **`src/services/taskService.ts`** (new file): Typed service layer with `listMyTasks`, `createTask`, `updateTask`, `deleteTask`. All four use `api()` from `apiClient.ts`. Exports `Task`, `CreateTaskPayload`, `PatchTaskPayload` interfaces.
  - **`src/hooks/useTasks.ts`**: Slimmed from 324 lines to ~100 lines. Now delegates to `taskService.ts` via five TanStack Query hooks: `useTasksQuery`, `useCreateTask`, `useToggleTask`, `useUpdateTask`, `useDeleteTask`. The compatibility wrapper `useTasks()` preserves the existing `{ tasks, taskDates, addTask, toggleTask, moveTask, deleteTask }` API so no component changes were needed. Tasks are no longer localStorage-backed — all mutations go to the backend and invalidate the `["my-tasks"]` query key.

---

## 1.5 Highlights of Recent Updates (Late March 2026)
- **Cyber-Neon UI Overhaul:** Rebranded the entire application to a high-contrast Deep Teal and Cyan global aesthetic, deprecating local hardcoded properties and archaic light-mode hacks. 
- **UUID Exposure Fixes:** Refactored `Dashboard.tsx` and `Recent.tsx` to stop exposing raw Postgres UUIDs to the end user. Implemented a "resolve-on-render" pattern utilizing existing highly-cached TanStack catalog queries (`useMajors`, `useCourses`) to dynamically map UUIDs to human-readable names.
- **Accessibility & Modal Polish:** Repaired massive breakage on the Dashboard "New Task" modal, stripping legacy `liquid-glass-heavy` hacks destroying Tailwind transform matrices. Achieved full a11y compliance and React render loop optimizations on the modal.
- **Auth Hardening:** Switched to `HttpOnly` cookie-based JWTs. `credentials: 'include'` now applied to all API calls. Added 403 blocks for unverified emails on sign-in.
- **Backend APIs Connected:** Real integration with live Neon Postgres endpoints for `/majors`, `/courses`, and `/types`.
- **Course Library Rework:** Reverted the UI to cascading dropdowns (Major → Year → Semester → Course). The user's major is now auto-fetched from their profile via `useAuth().user.majorId`.
- **Mock Data Fully Removed (March 19):** All 6 services (`catalogService`, `fileService`, `requestService`, `reputationService`, `auditService`, `assistantService`) now call live API endpoints via `apiClient.ts`. Both `Courses.tsx` and `Settings.tsx` were cleaned of direct mock imports and switched to `useCourses()`, `useMajors()`, `useYears()` hooks. **`src/mock/mock-db.ts` and the `src/mock/` directory have been deleted.**
- **Frontend Upload Fix:** Fixed the `422 Unprocessable Content` error on file upload. Corrected the lecturer ID mapping in `Courses.tsx` (was sending name instead of UUID) and the FormData key in `requestService.ts` (`"description"` → `"notes"`).
- **QueryClient Retry Config (March 19):** Configured `QueryClient` in `main.tsx` to not retry queries on 4xx errors (like 404 Not Found), preventing console spam for unimplemented backend endpoints.
- **Request File Modal Rework (March 19):** Updated `RequestFileModal.tsx` to use the same cascading filter pattern as the Course Library (Major → Year → Semester → Course). Years and semesters are now derived dynamically from the `useCourses` data instead of hardcoded lists. Added max-height scrolling to all dropdowns. Add support for "Homework" material type.
- **Consolidated Backend Tasks:** Merged `BACKEND_TASKS.md` and `backend.md` into a single prioritized task document aligned with the current frontend service calls.
- **Phase 2 Backend Update (March 24):** Major backend update brought multiple endpoints live:
  - **Dashboard Widgets Live:** `/me/recent-files`, `/me/activity/summary`, `/me/session/start` now return real data. Dashboard 404 errors resolved.
  - **Gamification Live:** `/me/reputation` and `/reputation/leaderboard` endpoints fully implemented with Ledger + Cache pattern (denormalized `total_points` on User table for fast leaderboard queries).
  - **Admin Reject/Undo Payloads:** `AdminRejectPayload` and `BulkRejectPayload` now live. Frontend already sends matching `{ reason, note }` shapes.
  - **Upload Form Year Fix:** Backend now requires **two separate year fields**: `academic_year` (1–4 program level) and `material_year` (e.g. 2024 calendar year). Updated `requestService.ts` and `RequestFileModal.tsx` to send both via `multipart/form-data`. Program Year selector is now **required** (was optional).
  - **Soft Deletion Architecture:** Rejected files move to GCS `trash_bin/` folder instead of instant deletion. Undo-reject rescues files. Auto-cleanup via GCS lifecycle rule after 3 days.
  - **422 / 500 API Bug Squashes:** Fixed frontend router passing `"undefined"` strings to Tanstack Query hooks causing 422s. Also fixed missing `created_at` and `course_id` missing from the `FileRequestEnriched` model causing 500s and broken links in the Uploads UI.
  - **Missing React Keys Fix:** Fixed React warnings mapping the backend's `LeaderboardEntry.userId` to the frontend's expected `Contributor.id`.
---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite |
| **Routing** | react-router-dom v6 (createBrowserRouter) |
| **Data Fetching** | TanStack Query (useQuery / useMutation) |
| **Styling** | Tailwind CSS + custom "Liquid Glass" design system |
| **UI Components** | Shadcn/ui (Radix primitives) |
| **Icons** | lucide-react |
| **Toasts** | Sonner |
| **Testing** | Vitest + React Testing Library + MSW |
| **Backend** | FastAPI + SQLModel + Auth0 (partially implemented) |
| **Storage** | Google Cloud Storage (backend, for file uploads) |
| **Database** | PostgreSQL via Neon DB (backend) |

---

## 3. Project Structure

> **Refactored to feature-first on May 25 2026.** Code is now colocated by domain, not by file type.
> Rule: `shared/` → cross-feature only. `features/<name>/` → everything that belongs to one domain. `app/` → bootstrap only. `components/ui/` and `lib/` stay put (shadcn convention).

```
src/
├── main.tsx                    # Entry point: ErrorBoundary → AuthProvider → ThemeProvider → QueryClientProvider → Router
├── index.css                   # Global styles + Liquid Glass design system tokens
├── types/domain.ts             # All TypeScript domain interfaces (User, Course, File, FileRequest, Lecturer, Task, etc.)
├── app/
│   ├── layouts/
│   │   ├── AppShell.tsx        # Main app shell with sidebar + NotificationsMenu (polls unread count every 30s)
│   │   ├── AdminShell.tsx      # Admin area shell (Catalog now a live nav link, not "coming soon")
│   │   ├── CourseShell.tsx     # Course detail shell (tabs: materials/notes/exams)
│   │   └── FileShell.tsx       # File viewer shell
│   └── router/
│       └── index.tsx           # All route definitions with Loadable lazy-loading
├── features/
│   ├── admin/
│   │   ├── api/
│   │   │   ├── auditService.ts         # ✅ /admin/audit-logs
│   │   │   └── catalogAdminService.ts  # ✅ /courses, /lecturers, /admin/courses/{id}/lecturers (assign/unassign)
│   │   ├── components/
│   │   │   ├── BulkActionBar.tsx
│   │   │   ├── RejectDialog.tsx
│   │   │   ├── RequestDetailSheet.tsx
│   │   │   ├── RequestFileModal.tsx    # Upload file request modal (multi-step)
│   │   │   └── request-modal/          # StepCourse, StepDetails, StepMajor, StepUpload, SummaryChip, useRequestForm
│   │   ├── hooks/
│   │   │   └── useAudit.ts
│   │   └── pages/
│   │       ├── AdminHome.tsx           # Admin dashboard — liquid-glass-subtle cards, LayoutDashboard header (rewritten May 30)
│   │       ├── AuditLog.tsx            # Audit trail viewer
│   │       ├── CatalogManager.tsx      # ✅ Assign/unassign lecturers; per-row lecturer search (May 30)
│   │       └── ModerationQueue.tsx     # Approve/reject file requests
│   ├── assistant/
│   │   ├── api/assistantService.ts     # ✅ /assistant/chat, /me/notes
│   │   └── components/                 # AssistantChat, AssistantPanel, NotesBoard
│   ├── auth/
│   │   ├── api/authService.ts          # ✅ /signin, /signup, /forgot-password, /reset-password. Fully typed.
│   │   ├── components/                 # SlidingAuth, AuthCard, AuthLayout, forms/
│   │   ├── context/AuthContext.tsx     # Auth state. SESSION_KEY = "gh_user_session" (src/lib/constants.ts).
│   │   ├── hooks/useAuthMode.ts
│   │   └── pages/                      # AuthPage, ResetPasswordPage
│   ├── courses/
│   │   ├── api/catalogService.ts       # ✅ /majors, /types, /years, /semesters, /courses, /lecturers
│   │   ├── hooks/
│   │   │   ├── useCatalog.ts           # useMajors, useYears, useSemesters, useCourses, useLecturers
│   │   │   └── usePinnedCourses.ts     # ✅ TanStack Query + optimistic updates → /me/pinned-courses (was localStorage)
│   │   └── pages/                      # Courses, CourseMaterials, CourseNotes, CourseExams
│   ├── dashboard/
│   │   ├── api/taskService.ts          # ✅ /me/tasks (list, create, update, delete)
│   │   ├── components/                 # LearningPlan, MiniCalendar, AddTaskModal, TaskDetailsDialog
│   │   ├── hooks/
│   │   │   ├── useDashboardData.ts     # Memoized recentCourses + weeklyActivity derivations
│   │   │   └── useTasks.ts             # TanStack Query hooks; exposes { tasks, taskDates, addTask, toggleTask, moveTask, deleteTask }
│   │   └── pages/Dashboard.tsx         # Composition root (~580 lines)
│   ├── files/
│   │   ├── api/
│   │   │   ├── fileService.ts          # ✅ /files, /files/{id}, /me/recent-files
│   │   │   └── requestService.ts       # ✅ /courses/{id}/upload, /me/requests, /admin/requests/*
│   │   ├── components/FileViewer.tsx   # react-pdf viewer with text selection → "Ask AI" tooltip
│   │   ├── hooks/
│   │   │   ├── useFiles.ts
│   │   │   ├── useRequests.ts          # approve/reject mutations (no longer fires local addNotification)
│   │   │   └── useViewerSession.ts     # PDF heartbeat + completion (isCompletedRef avoids stale closure)
│   │   └── pages/                      # FilePage, Recent, UserUploads
│   ├── gamification/
│   │   ├── api/                        # gamificationService, learningPathService, reputationService
│   │   ├── components/                 # CourseCompletionCelebration
│   │   └── hooks/                      # useGamification, useLearningPath, useReputation
│   ├── profile/
│   │   └── pages/UserProfile.tsx
│   └── settings/
│       ├── pages/Settings.tsx          # ✅ Loads from /me/settings on mount; debounce-PATCHes 600ms after change; localStorage fallback
│       └── services/settingsService.ts # ✅ NEW (May 29): getSettings, updateSettings → /me/settings
├── shared/
│   ├── components/                     # CommandPalette, EmptyState, ErrorBoundary, MouseGlow, NotFound, PriorityBadge
│   │   ├── errors/RouteError.tsx
│   │   └── routing/ProtectedRoute.tsx
│   └── hooks/
│       ├── useInAppNotifications.ts    # ✅ TanStack Query → /me/notifications (was localStorage). addNotification/clearAll removed.
│       ├── useActivityTracker.ts
│       ├── useDebounce.ts
│       ├── use-mobile.tsx
│       ├── useReducedMotion.ts
│       └── useTheme.tsx
├── components/ui/                      # Shadcn/ui primitives — do NOT modify
├── lib/
│   ├── apiClient.ts                    # api<T>, ApiError, snakeToCamel. Auto-injects Bearer token. credentials: include.
│   ├── constants.ts                    # SESSION_KEY = "gh_user_session"
│   ├── queryKeys.ts                    # Centralized TanStack Query key factories
│   ├── utils.ts                        # cn, isMac, getGreeting, formatDeadline, formatHour
│   └── __tests__/utils.test.ts         # 14 utility tests
└── test/                               # Vitest + MSW setup (setup.ts, mocks/handlers.ts, mocks/server.ts)

server/
├── main.py                     # FastAPI app entry point. Registers all routers.
├── models.py                   # SQLModel ORM: User, Course, Lecturer, UserTask, FileRequest, PinnedCourse, UserSettings, UserNotification, MaterialChunk, etc.
├── schemas.py                  # Pydantic schemas: TaskCreate/Patch/Response, UserSettings, SettingsPatch, NotificationResponse, etc.
├── database.py                 # Neon DB connection + get_session dependency
├── routers/
│   ├── auth.py                 # /signin, /signup, /forgot-password, /reset-password
│   ├── catalog.py              # /majors, /courses, /lecturers, /years, /semesters, /types + course-lecturer assignment endpoints
│   ├── files.py                # /files, /files/{id}
│   ├── tasks.py                # ✅ /me/tasks CRUD (GET, POST, PATCH, DELETE)
│   ├── admin.py                # /admin/requests/*, /admin/audit-logs, /admin/courses/{id}/lecturers
│   ├── pinned_courses.py       # ✅ NEW (May 29): /me/pinned-courses (GET, POST /{id}, DELETE /{id})
│   ├── settings.py             # ✅ NEW (May 29): /me/settings (GET, PATCH)
│   ├── notifications.py        # ✅ NEW (May 29): /me/notifications, /unread-count, /{id}/read, /read-all
│   ├── gamification.py         # /me/reputation, /reputation/leaderboard
│   ├── activity.py             # /me/recent-files, /me/activity/summary, /me/session/start
│   ├── viewer.py               # Viewer session endpoints
│   └── ai.py                   # /assistant/chat, /me/notes (RAG pipeline)
└── utils/
    ├── auth_utils.py           # get_verified_user dependency (JWT decode + DB lookup)
    └── upload_utils.py         # GCS upload helpers
```

---

## 4. Architecture Patterns

### Data Flow
```
Component → Query Hook (queries/) → Service (services/) → apiClient.ts → /api/v1/* (backend)
```

### Service → Query Separation
Every service returns a `Promise`. Query hooks wrap services with TanStack Query for caching, loading states, and cache invalidation. When the backend is ready, **only the service layer changes** — query hooks remain untouched.

### Authentication
- `AuthContext` manages user state (signIn/signUp/signOut)
- Auth state is persisted to `localStorage` via `SESSION_KEY = "gh_user_session"` (defined in `src/lib/constants.ts`)
- `authService.ts` makes **real** `fetch` calls to `http://localhost:8000/api/v1` for sign-in and sign-up
- `ProtectedRoute` checks `AuthContext` for auth + optional role guard (`requiredRole="ADMIN"`)

### State Management
- **Server state**: TanStack Query (all data fetching, including tasks — fully API-backed as of May 18)
- **Local state**: React `useState` + `localStorage` (recent files, theme; pinned courses and settings now API-backed)
- **Auth state**: React Context (`AuthContext`). Token stored in `localStorage` (future: HTTP-only cookies)
- **Theme state**: React Context (`ThemeProvider`)
- ~~Tasks were once localStorage-only~~ — tasks are now live API calls via `taskService.ts` + `useTasks.ts`.

---

## 5. API Client (`lib/apiClient.ts`)

Centralized HTTP client used by all service files.
- `api<T>(path, init?)` — typed fetch wrapper
- Auto-injects `Authorization: Bearer <token>` from `localStorage`
- Uses `credentials: "include"` (ready for HTTP-only cookies)
- Throws `ApiError` with `status`, `message`, `data` on non-OK responses
- Handles `204 No Content` gracefully
- `snakeToCamel` exported for testability

**Usage**: `import { api, ApiError } from "@/lib/apiClient"`

---

## 6. Domain Model (key types in `types/domain.ts`)

| Type | Purpose |
|---|---|
| `User` | id, name, email, role, majorId |
| `Major` | id, name, slug, icon |
| `AcademicYear` | id, label |
| `Semester` | id, label |
| `Course` | id, name, majorId, semesterId, lecturerIds |
| `Lecturer` | id, name |
| `File` | id, title, type, courseId, uploaderId, status, downloadUrl |
| `FileRequest` | id, userId, courseId, type, title, status, reviewedById |
| `MaterialType` | enum: "slides" \| "notes" \| "exams" \| "homework" |
| `FileStatus` | enum: "pending" \| "approved" \| "rejected" |
| `ReputationSummary` | userId, totalPoints, badge, transactions |
| `AuditLogEntry` | id, action, actorId, targetIds, metadata |
| `RequestStats` | pending, approvedToday, rejectedToday |
| `Task` (taskService.ts) | id, title, date, startHour, duration, priority, completed, createdAt |

---

## 7. Known Issues & Technical Debt

### Critical
1. ~~**Backend approval flow bug**~~: ✅ RESOLVED — `POST /admin/requests/{id}/approve` correctly creates a `Material` record and moves the file in GCS. No data loss.
2. ~~**Many P0 backend endpoints missing**~~: ✅ RESOLVED — All P0–P3 endpoints are now live per `BACKEND_TASKS.md` §14.

### Medium
3. **`MyPath.tsx` is a placeholder**: The learning path page has no real content.
4. **Course metadata hardcoded in Dashboard**: `COURSE_META` map in `Dashboard.tsx` duplicates data.
5. ~~**`requestPasswordReset` is mock-only**~~: ✅ RESOLVED (May 22) — both `requestPasswordReset` and `confirmPasswordReset` now hit real `/forgot-password` and `/reset-password` endpoints.
6. ~~**`usePinnedCourses` still localStorage-only**~~: ✅ RESOLVED (May 29) — pinned courses fully backed by `/me/pinned-courses` API with optimistic updates.
7. **Pre-existing `any` types in services**: `fileService.ts`, `requestService.ts`, `gamificationService.ts`, `learningPathService.ts` still use `any` in places. `authService.ts` is fully typed as of May 22.

### Low / Polish
8. ~~**`listTopContributors` calls `/reputation/leaderboard`**~~: ✅ RESOLVED — endpoint now live (Phase 2).
9. ~~**Adobe PDF Embed API key hardcoded**~~: FileViewer now uses `react-pdf` instead.
10. ~~**Mock data remnants**~~: ✅ RESOLVED — `mock-db.ts` deleted, all services and components fully migrated.
11. ~~**Tasks were localStorage-only**~~: ✅ RESOLVED (May 18) — tasks fully backed by `/me/tasks` backend API.

---

## 7.1 Frontend Next Steps (For Frontend Engineer)

### Security Follow-ups (High Priority)
1. **VULN-08 (CSRF)**: Coordinate with backend to change prod cookie to `samesite="lax"` or add CSRF token on state-changing admin endpoints.
2. **VULN-04 (full)**: Update Auth0 reset email template to emit `#token=` fragment links instead of `?token=` query links.
3. **QA-09**: Confirm backend `activeSeconds` semantics (cumulative vs per-heartbeat) and rename/adjust `useViewerSession.ts` accordingly.

### After Backend P0 Endpoints Land
4. **Test the full course browsing flow** — verify the cascading dropdowns work with real `/years`, `/semesters`, `/lecturers` data.
5. **Test the file listing** — verify `GET /files?course_id=...` returns real approved files for course material pages.
6. **Test the PDF viewer** — verify `GET /files/{id}` returns `downloadUrl` and the `react-pdf` viewer loads it.
7. **Test the upload flow end-to-end** — upload → pending → admin approve → file appears in library.

### After Backend P1–P2 Endpoints Land
8. **Wire up the admin moderation dashboard** — test bulk approve/reject, undo, stats.
9. **Wire up the reputation / leaderboard display** — verify points awarded on approval.
10. **Wire up the audit log viewer** — verify admin actions are logged and displayed.

### Moderator Dashboard (Planned — not yet started)
11. **Implement Moderator Dashboard** — follow [`moderator_dashboard_plan.md`](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/moderator_dashboard_plan.md) (4 phases: backend router, route shell, service+hooks, pages).
    - Extends `ProtectedRoute` from `requiredRole` → `requiredRoles` array
    - New backend: `server/routers/moderator.py` + `LecturerCourse` junction table
    - New frontend: `ModeratorShell`, `ModeratorHome`, `UsersPage`, `LecturersPage`, `CoursesPage`

---

## 8. Conventions

- **File naming**: PascalCase for components, camelCase for services/hooks/queries
- **JSDoc `@backend`**: Annotates mock functions with the real API endpoint they should call
- **Migration guide headers**: Each service file has a block comment explaining backend migration steps
- **Shadcn/ui**: The `components/ui/` directory contains generated primitives — do NOT modify directly
- **Tailwind**: Custom design tokens defined in `index.css` under the Liquid Glass system
- **Error boundaries**: Route-level (`RouteError`) + top-level (`ErrorBoundary`)
- **Toast notifications**: Use `toast()` from `sonner` for user feedback on mutations
- **ESLint**: `react-hooks/exhaustive-deps` is set to `'error'` — all effect deps must be explicit

---

## 9. How to Run

```bash
# Install dependencies
npm install

# Frontend only (Vite — http://localhost:5173)
npm run dev

# Frontend + backend together (concurrently — :5173 + :8000)
npm run dev:all

# Backend deps (Python venv at server/venv/)
server\venv\Scripts\python.exe -m pip install -r requirements.txt

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Tests
npm run test         # watch mode
npm run test:ui      # vitest UI in browser
npm run test:run     # one-shot, exits

# Build for production
npm run build
```

---

## 10. Backend Connection

The frontend expects the backend at `http://localhost:8000/api/v1` (configurable via `VITE_API_URL` env var).

**Migration status:**
- ✅ `authService.ts` — fully live (fully typed as of May 22)
- ✅ `taskService.ts` — fully live (`/me/tasks` — GET, POST, PATCH, DELETE, live as of May 18)
- ✅ `catalogService.ts` — fully live (`/majors`, `/types`, `/years`, `/semesters`, `/courses`, `/lecturers`)
- ✅ `catalogAdminService.ts` — fully live (`/admin/courses/{id}/lecturers` — GET, POST, DELETE; live as of May 29)
- ✅ `settingsService.ts` — fully live (`/me/settings` — GET, PATCH; live as of May 29)
- ✅ `usePinnedCourses.ts` — fully live (`/me/pinned-courses` — GET, POST, DELETE with optimistic updates; live as of May 29)
- ✅ `useInAppNotifications.ts` — fully live (`/me/notifications`, `/unread-count`, `/{id}/read`, `/read-all`; live as of May 29)
- ✅ `fileService.ts` — fully live (`/files`, `/files/{id}`, `/reputation/leaderboard`, `/me/recent-files`)
- ✅ `requestService.ts` — fully live (`/courses/{id}/upload`, `/me/requests`, `/admin/requests/*`)
- ✅ `reputationService.ts` — fully live (`/me/reputation`)
- ✅ `auditService.ts` — fully live (`/admin/audit-logs`)
- ✅ `assistantService.ts` — fully live (`/assistant/chat`, `/me/notes`)

**All mock data has been removed.** `src/mock/mock-db.ts` and the `src/mock/` directory are deleted.

> ⚠️ **Note on 404 Errors in Console:** Some endpoints like `/me/requests`, `/lecturers`, `/files`, and viewer session endpoints still return `404 Not Found`. Dashboard widgets (`/me/recent-files`, `/me/activity/summary`, `/me/reputation`, `/reputation/leaderboard`) are now live as of Phase 2 (March 24). Retries on 4xx errors have been disabled to reduce console spam.

Query hooks (`queries/`) need **no changes** — they call services which return Promises.

**Cookie Auth:** Backend sets `Set-Cookie: auth_token=...; HttpOnly; SameSite=Lax` on signin. The frontend `apiClient` sends `credentials: "include"` automatically.

**See `BACKEND_TASKS.md`** for the full list of endpoints the backend engineer needs to implement.
