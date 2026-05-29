# GeeksHub — Project Memory

> This file is intended for AI agents and future developers to quickly understand the GeeksHub project structure, conventions, tech stack, and current state.

---

## 1. What is GeeksHub?

A university course materials platform where students **share, browse, and study** lecture files (PDFs, slides, notes, exams). Students earn **reputation points** for approved uploads. Admins moderate file requests via a moderation queue.

---

## 1.1 Highlights of Recent Updates (Late May 2026)

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

---

## 1.2 Highlights of Recent Updates (Mid May 2026 — May 18)

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

## 1.3 Highlights of Recent Updates (Late March 2026)
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
├── types/domain.ts             # All TypeScript domain interfaces (User, Course, File, FileRequest, etc.)
├── services/                   # Service layer — ALL migrated to live API calls
│   ├── authService.ts          # Real fetch calls to /api/v1/signin, /api/v1/signup. Fully typed (AuthUserDTO, etc.)
│   ├── taskService.ts          # ✅ calls /me/tasks (list, create, update, delete). Typed Task, CreateTaskPayload, PatchTaskPayload.
│   ├── fileService.ts          # ✅ calls /files, /reputation/leaderboard, /me/recent-files
│   ├── catalogService.ts       # ✅ calls /majors, /types, /years, /semesters, /courses, /lecturers
│   ├── requestService.ts       # ✅ calls /courses/{id}/upload, /me/requests, /admin/requests/*
│   ├── reputationService.ts    # ✅ calls /me/reputation
│   ├── assistantService.ts     # ✅ calls /assistant/chat, /me/notes
│   └── auditService.ts         # ✅ calls /admin/audit-logs
├── queries/                    # TanStack Query hooks (thin wrappers over services)
│   ├── useFiles.ts             # useFiles, useFile, useTopContributors, useRecentFiles
│   ├── useCatalog.ts           # useMajors, useYears, useSemesters, useCourses, useLecturers
│   ├── useRequests.ts          # useMyRequests, useAllRequests, useApproveRequest, etc.
│   ├── useReputation.ts        # useReputation
│   └── useAudit.ts             # useAuditLogs
├── hooks/                      # React hooks
│   ├── useTasks.ts             # Learning plan tasks via TanStack Query (list, create, toggle, update, delete). Wrapper exposes { tasks, taskDates, addTask, toggleTask, moveTask, deleteTask }.
│   ├── useDashboardData.ts     # Memoized dashboard derivations (recentCourses, weeklyActivity). Exports DAY_LABELS.
│   ├── useViewerSession.ts     # PDF viewer heartbeat + completion tracking (uses isCompletedRef to avoid stale-closure re-renders).
│   ├── usePinnedCourses.ts     # Pinned course IDs (localStorage) — backend migration still pending.
│   ├── useTheme.tsx            # Theme provider + useTheme hook (light/dark/system)
│   ├── useReducedMotion.ts     # Accessibility: prefers-reduced-motion
│   ├── use-mobile.tsx          # Breakpoint detection (768px)
│   └── __tests__/              # Hook tests (useTasks.test.tsx — 4 tests using MSW)
├── context/
│   └── AuthContext.tsx          # Auth state (user, signIn, signUp, signOut). Persists to localStorage via SESSION_KEY.
├── lib/
│   ├── apiClient.ts            # Centralized fetch wrapper. Exports api, apiFetch, ApiError, snakeToCamel.
│   ├── router.tsx              # All route definitions. Loadable<T> generic typed (no more (props: any)).
│   ├── constants.ts            # Shared constants. SESSION_KEY = "gh_user_session".
│   ├── utils.ts                # cn (Tailwind merge), isMac, getGreeting, formatDeadline, formatHour.
│   └── __tests__/              # Utility tests (utils.test.ts — 14 tests).
├── test/                       # Test infrastructure
│   ├── setup.ts                # Vitest setup — wires up MSW server lifecycle + jest-dom matchers.
│   └── mocks/                  # MSW handlers + server (handlers.ts, server.ts).
├── components/
│   ├── dashboard/              # Dashboard sub-components extracted from Dashboard.tsx (May 22 refactor)
│   │   ├── LearningPlan.tsx    # 7-day schedule, drag-to-create, drag-to-move with shadow/ghost UX, H:MM time labels
│   │   ├── MiniCalendar.tsx    # Month-view calendar with task-date dots
│   │   └── AddTaskModal.tsx    # New-task dialog. Accepts arbitrary durations injected from drag.
│   ├── pages/                  # Route-level page components
│   │   ├── Dashboard.tsx       # Composition root only (~580 lines, down from 1,127). Wires hooks and sub-components.
│   │   ├── Courses.tsx         # Course browser with cascading filters
│   │   ├── CourseMaterials.tsx # File listing for a course (materials tab)
│   │   ├── CourseNotes.tsx     # File listing for a course (notes tab)
│   │   ├── CourseExams.tsx     # File listing for a course (exams tab)
│   │   ├── UserUploads.tsx     # User's file requests + upload form
│   │   ├── Recent.tsx          # Recently viewed files page
│   │   ├── Settings.tsx        # User settings (theme, language, notifications)
│   │   ├── MyPath.tsx          # Placeholder learning path page
│   │   ├── NotFound.tsx        # 404 page
│   │   └── admin/
│   │       ├── AdminHome.tsx   # Admin dashboard with request stats
│   │       ├── ModerationQueue.tsx  # Approve/reject file requests
│   │       └── AuditLog.tsx    # Audit trail viewer
│   ├── layout/                 # Shell layouts (sidebar, header, content)
│   │   ├── AppShell.tsx        # Main app shell with sidebar
│   │   ├── AdminShell.tsx      # Admin area shell
│   │   ├── CourseShell.tsx     # Course detail shell (tabs: materials/notes/exams)
│   │   └── FileShell.tsx       # File viewer shell (simplified passthrough layout)
│   ├── pages/
│   │   └── FilePage.tsx        # Bridges FileViewer + AssistantPanel + selectedText state
│   ├── viewer/
│   │   └── FileViewer.tsx      # react-pdf viewer with text selection tooltip ("Ask AI")
│   ├── auth/                   # Auth UI components
│   │   ├── SlidingAuth.tsx     # Sign-in / sign-up sliding panel
│   │   ├── AuthCard.tsx        # Auth card wrapper
│   │   ├── AuthLayout.tsx      # Auth page layout
│   │   ├── useAuthMode.ts      # Auth mode state (sign-in vs sign-up)
│   │   └── forms/              # SignInForm, SignUpForm, ForgotPasswordForm, ResetPasswordForm
│   ├── features/
│   │   └── RequestFileModal.tsx # Upload file request modal
│   ├── routing/
│   │   └── ProtectedRoute.tsx  # Auth + role guard
│   ├── errors/
│   │   └── RouteError.tsx      # Error boundary for routes
│   ├── ErrorBoundary.tsx       # Top-level error boundary
│   └── ui/                     # Shadcn/ui primitives (27 files — do not modify)

server/
├── main.py                     # FastAPI app entry point. Registers all routers.
├── models.py                   # SQLModel ORM models (User, Course, Lecturer, UserTask, FileRequest, MaterialChunk, etc.)
├── schemas.py                  # Pydantic request/response schemas (TaskCreate, TaskPatch, TaskResponse, etc.)
├── database.py                 # Neon DB connection + get_session dependency
├── routers/
│   ├── auth.py                 # /signin, /signup, /forgot-password, /reset-password
│   ├── catalog.py              # /majors, /courses, /lecturers, /years, /semesters, /types
│   ├── files.py                # /files, /files/{id}
│   ├── tasks.py                # ✅ /me/tasks CRUD (GET, POST, PATCH, DELETE) — live as of May 18
│   ├── admin.py                # /admin/requests/*, /admin/audit-logs
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
- **Local state**: React `useState` + `localStorage` (pinned courses, recent files, theme)
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
6. **`usePinnedCourses` still localStorage-only**: No backend sync. Pins are device-local. Migration plan is in the file's header comment but the endpoint hasn't landed.
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
