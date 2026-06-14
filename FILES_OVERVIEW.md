# GeeksHub — Files Overview

> A per‑file reference grouped by domain. For each important file: what it does, what it depends on, what depends on it, and where it sits (frontend / backend / shared / AI / config). This complements [FOLDERS.md](./FOLDERS.md) (folder purposes) and the deeper [FRONTEND.md](./FRONTEND.md), [BACKEND.md](./BACKEND.md), and [AI_INTEGRATION.md](./AI_INTEGRATION.md).

Tiny one‑line helpers are intentionally omitted. The focus is files that define routes, controllers, services, models, hooks, core UI, AI logic, and configuration.

---

## App Bootstrap & Shared Foundation (Frontend)

### `src/main.tsx` — *frontend / entry point*
Mounts the React app and stacks the global providers in order: `ErrorBoundary` → `AuthProvider` → `ThemeProvider` → `QueryClientProvider` → `RouterProvider`, plus `MouseGlow` and the Sonner `Toaster`. Configures the `QueryClient` to skip retries on 4xx errors. **Depends on:** the router, all provider modules, `apiClient.ApiError`. **Depended on by:** nothing (it's the root).

### `src/app/router/index.tsx` — *frontend / routing*
Defines the entire route tree with `createBrowserRouter`. Lazy‑loads every page via a `Loadable` + `React.lazy` wrapper. Splits routes into public (`/auth`), protected app (wrapped in `ProtectedRoute` + `AppShell`), and protected admin (`ProtectedRoute requiredRole="ADMIN"` + `AdminShell`). **Depends on:** all feature `pages/`, `app/layouts/`, `ProtectedRoute`, `RouteError`. **Depended on by:** `main.tsx`.

### `src/app/layouts/AppShell.tsx` — *frontend / layout*
Main authenticated chrome: sidebar navigation, command palette trigger, and the notifications menu (polls unread count every 30s). Renders child routes via `<Outlet/>`. **Depends on:** `useInAppNotifications`, `useAuth`, UI primitives. **Depended on by:** the router.

### `src/app/layouts/AdminShell.tsx` / `CourseShell.tsx` / `FileShell.tsx` — *frontend / layout*
Section‑specific chrome. `AdminShell` holds admin nav (Home, Requests, Audit, Catalog). `CourseShell` provides the materials/notes/exams tab bar for a course. `FileShell` frames the PDF viewer page. Each renders `<Outlet/>`. **Depended on by:** the router.

### `src/types/domain.ts` — *frontend / shared types*
The single source of truth for frontend data shapes: `User`, `Major`, `Course`, `Lecturer`, `File`, `FileRequest`, `ReputationSummary`, `AuditLogEntry`, `RequestStats`, plus enums (`Role`, `FileStatus`, `MaterialType`, `BadgeTier`, `AuditAction`). **Depended on by:** nearly every service, hook, and component.

### `src/lib/apiClient.ts` — *frontend / infrastructure*
The one HTTP wrapper all services use. `api<T>(path, init?)` adds JSON headers, sends `credentials: "include"`, throws a typed `ApiError` on non‑OK responses, handles `204`, and recursively converts response keys `snake_case → camelCase` (`snakeToCamel`, exported for tests). On `401` to a protected path it clears the cached session and redirects to `/auth`. **Depends on:** `lib/constants.SESSION_KEY`. **Depended on by:** every `features/*/api/*.ts` service.

### `src/lib/queryKeys.ts` — *frontend / infrastructure*
Centralized TanStack Query key factories (e.g. `queryKeys.catalog.courses(filters)`). Keeps cache keys consistent so invalidation is reliable. **Depended on by:** all query hooks.

### `src/lib/utils.ts` — *frontend / utilities*
`cn()` (Tailwind class merge), `isMac`, `getGreeting`, `formatDeadline`, `formatHour`. Covered by `lib/__tests__/utils.test.ts`. **Depended on by:** many components.

### `src/lib/constants.ts` — *frontend / config*
Holds `SESSION_KEY = "gh_user_session"`. **Depended on by:** `apiClient.ts`, `AuthContext.tsx`.

### `src/index.css` — *frontend / styling*
Global Tailwind layers plus the "Liquid Glass" design tokens (CSS custom properties for both `:root` and `.light`). **Depended on by:** the whole UI via class names.

---

## Auth (Frontend)

### `src/features/auth/context/AuthContext.tsx` — *frontend / state*
Owns auth state and exposes `useAuth()`, `useIsAdmin()`, `useIsSuperAdmin()`. Optimistically renders the cached session, then reconciles it against the server (`/me`) on boot — the server's role always wins. Provides `signIn`, `signUp`, `signOut`. Stores the user in `localStorage` (remember‑me) or `sessionStorage`. **Depends on:** `authService`, `constants`, `apiClient.ApiError`, `domain` types. **Depended on by:** `ProtectedRoute`, shells, and any component needing the current user.

### `src/features/auth/api/authService.ts` — *frontend / service*
Fully‑typed calls to `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/me`, `/signout`. Defines DTOs (`AuthUserDTO`, `SignInResponse`, …) and `extractAuthErrorMessage` for clean error text. **Depends on:** `apiClient`. **Depended on by:** `AuthContext`.

### `src/features/auth/pages/AuthPage.tsx`, `ResetPasswordPage.tsx` — *frontend / pages*
Route entry points for auth. `AuthPage` drives the sliding sign‑in/sign‑up UI. **Depend on:** the form components + `useAuthMode`.

### `src/features/auth/components/` — *frontend / components*
`SlidingAuth`, `AuthCard`, `AuthLayout`, and `forms/` (`SignInForm`, `SignUpForm`, `ForgotForm`, `ResetPasswordForm`). Forms collect input, do client‑side validation, and call `useAuth` actions. **Depend on:** `AuthContext`, UI primitives.

### `src/shared/components/routing/ProtectedRoute.tsx` — *frontend / shared routing*
Route guard. Reads `useAuth()`; redirects unauthenticated users to `/auth`, and enforces `requiredRole` for the admin tree. **Depended on by:** the router.

---

## Catalog & Courses (Frontend)

### `src/features/courses/api/catalogService.ts` — *frontend / service*
Calls `/majors`, `/types`, `/years`, `/semesters`, `/courses`, `/lecturers`. The data source for the cascading course browser. **Depends on:** `apiClient`. **Depended on by:** `useCatalog`.

### `src/features/courses/hooks/useCatalog.ts` — *frontend / hooks*
TanStack Query hooks: `useMajors`, `useYears`, `useSemesters`, `useCourses`, `useCourse`, `useLecturers`, `useTypes`. Encodes caching policy (static lists cached `Infinity`) and the cascading "enabled when parent selected" logic. **Depends on:** `catalogService`, `queryKeys`. **Depended on by:** `Courses`, `Settings`, request modals, dashboard.

### `src/features/courses/hooks/usePinnedCourses.ts` — *frontend / hooks*
Backs pinned courses with `/me/pinned-courses` using TanStack Query + optimistic updates. Public API (`pinnedIds`, `togglePin`, `isPinned`) is stable. **Depends on:** `apiClient`. **Depended on by:** course pages, dashboard.

### `src/features/courses/pages/Courses.tsx` — *frontend / page*
The course library: Major → Year → Semester → Course cascade. Auto‑selects the user's major from `useAuth().user.majorId`. Resolves UUIDs to names so raw IDs never leak to the UI. **Depends on:** `useCatalog`, `usePinnedCourses`.

### `src/features/courses/pages/CourseMaterials.tsx`, `CourseNotes.tsx`, `CourseExams.tsx` — *frontend / pages*
Tab pages inside `CourseShell`, each listing files of a given type for the course. **Depend on:** `useFiles`.

---

## Files, Viewer & Uploads (Frontend)

### `src/features/files/api/fileService.ts` — *frontend / service*
Calls `/files`, `/files/{id}`, `/me/recent-files`. Returns approved files and per‑file metadata (incl. `downloadUrl`). **Depended on by:** `useFiles`.

### `src/features/files/api/requestService.ts` — *frontend / service*
Upload + moderation surface: `/courses/{id}/upload` (multipart), `/me/requests`, `/admin/requests/*`. **Depended on by:** `useRequests`, upload modal.

### `src/features/files/hooks/useFiles.ts` / `useRequests.ts` / `useViewerSession.ts` — *frontend / hooks*
`useFiles` wraps file queries. `useRequests` holds approve/reject mutations with cache invalidation. `useViewerSession` runs the PDF reading heartbeat and completion logic, using a `useRef` (`isCompletedRef`) to avoid a stale‑closure bug in the 5‑second interval. **Depend on:** the file services + `apiClient`.

### `src/features/files/components/FileViewer.tsx` — *frontend / component*
The react‑pdf viewer. Renders the PDF, lets users select text and click "Ask AI" (a tooltip that pre‑fills the assistant). **Depends on:** `react-pdf`, the assistant panel ref. **Depended on by:** `FilePage`.

### `src/features/files/pages/FilePage.tsx` — *frontend / page*
Composes the PDF viewer alongside the AI assistant panel. **Depends on:** `FileViewer`, `AssistantPanel`, `useViewerSession`.

### `src/features/files/pages/Recent.tsx`, `UserUploads.tsx` — *frontend / pages*
"Recently viewed" list and the user's own upload requests with statuses.

---

## Dashboard & Tasks (Frontend)

### `src/features/dashboard/pages/Dashboard.tsx` — *frontend / page*
Composition root (~580 lines) for the dashboard: greeting, recent courses with progress, weekly activity, reputation, and the learning‑plan calendar. **Depends on:** `useDashboardData`, `useTasks`, the dashboard components.

### `src/features/dashboard/hooks/useDashboardData.ts` — *frontend / hooks*
Memoizes `recentCourses` (joins recent files → courses → requests → majors for progress %, via an O(n) `Map` lookup) and `weeklyActivity`. Prevents expensive per‑render recomputation. **Depends on:** catalog/file/reputation hooks.

### `src/features/dashboard/api/taskService.ts` — *frontend / service*
Typed CRUD for `/me/tasks` (`listMyTasks`, `createTask`, `updateTask`, `deleteTask`). Exports `Task`, `CreateTaskPayload`, `PatchTaskPayload`. **Depended on by:** `useTasks`.

### `src/features/dashboard/hooks/useTasks.ts` — *frontend / hooks*
Five TanStack Query hooks (`useTasksQuery`, `useCreateTask`, `useToggleTask`, `useUpdateTask`, `useDeleteTask`) with optimistic updates, plus a compatibility `useTasks()` wrapper exposing `{ tasks, taskDates, addTask, toggleTask, moveTask, deleteTask }`. **Depends on:** `taskService`. **Depended on by:** Dashboard + `LearningPlan`.

### `src/features/dashboard/components/LearningPlan.tsx` — *frontend / component*
The 7‑day drag‑to‑schedule calendar (7 AM–10 PM). Supports within‑day and cross‑day drag moves with a ghost preview, click‑to‑open details, and stable color mapping via `useRef`. **Depends on:** `useTasks`, `AddTaskModal`, `TaskDetailsDialog`.

### `src/features/dashboard/components/MiniCalendar.tsx`, `AddTaskModal.tsx`, `TaskDetailsDialog.tsx` — *frontend / components*
Month mini‑calendar, the create/edit task modal (supports arbitrary durations), and the task detail dialog. **Depend on:** `useTasks`, UI primitives.

---

## AI Assistant (Frontend)

### `src/features/assistant/api/assistantService.ts` — *frontend / service*
`sendMessage(fileId, message, history)` → `POST /assistant/chat` (replays only the last 10 messages), plus `getNotes`/`saveNotes` → `/me/notes`. Returns `{ reply, agentAction }`. **Depends on:** `apiClient`. **Depended on by:** `AssistantChat`.

### `src/features/assistant/components/AssistantPanel.tsx` — *frontend / component*
The side panel with two tabs (Chat / Notes), both `forceMount`ed so the notes board ref is never null. Exposes a `forwardRef` API so the PDF viewer can push selected text in. **Depends on:** `AssistantChat`, `NotesBoard`. **Depended on by:** `FilePage`.

### `src/features/assistant/components/AssistantChat.tsx`, `NotesBoard.tsx` — *frontend / components*
The chat thread (renders markdown replies, copy / pin‑to‑notes actions) and the sticky‑notes board (scrollable cards, no truncation). **Depend on:** `assistantService`.

---

## Admin (Frontend)

### `src/features/admin/pages/ModerationQueue.tsx` — *frontend / page*
The moderation queue: approve/reject single or bulk file requests, with stats. **Depends on:** `useRequests`, `BulkActionBar`, `RejectDialog`, `RequestDetailSheet`.

### `src/features/admin/pages/AdminHome.tsx` — *frontend / page*
Admin dashboard landing, restyled to the liquid‑glass language. **Depends on:** admin hooks.

### `src/features/admin/pages/AuditLog.tsx` — *frontend / page*
Renders the moderation audit trail. Uses lowercase action keys to match the backend, with a fallback so unknown actions can't crash. Reads `metaData` (camelCase, converted from `meta_data`). **Depends on:** `useAudit`, `auditService`, `domain` types.

### `src/features/admin/pages/CatalogManager.tsx` — *frontend / page*
Expandable course rows for assigning/unassigning lecturers, with a per‑row live lecturer search. **Depends on:** `catalogAdminService`.

### `src/features/admin/api/auditService.ts`, `catalogAdminService.ts` — *frontend / services*
`auditService` → `/admin/audit-logs`. `catalogAdminService` → course/lecturer listing + assign/unassign endpoints. **Depend on:** `apiClient`.

### `src/features/admin/components/RequestFileModal.tsx` + `request-modal/` — *frontend / components*
Multi‑step upload request modal (`StepMajor` → `StepCourse` → `StepDetails` → `StepUpload`, with `SummaryChip` and a `useRequestForm` state hook). Sends `multipart/form-data` with both `academic_year` and `material_year`. **Depends on:** `useCatalog`, `requestService`.

---

## Gamification, Profile, Settings (Frontend)

### `src/features/gamification/api/*.ts` + `hooks/*.ts` — *frontend / service + hooks*
`reputationService` (`/me/reputation`), `gamificationService`, `learningPathService` and their hooks (`useReputation`, `useGamification`, `useLearningPath`) power reputation summaries and the leaderboard (`/reputation/leaderboard`). `CourseCompletionCelebration` is the reward animation.

### `src/features/profile/pages/UserProfile.tsx` — *frontend / page*
Shows the signed‑in user's profile and stats.

### `src/features/settings/pages/Settings.tsx` + `services/settingsService.ts` — *frontend / page + service*
Loads `/me/settings` on mount, debounces a `PATCH` 600ms after each change, and falls back to localStorage if the API is unreachable. **Depend on:** `apiClient`, `useCatalog` (for default major/year dropdowns).

---

## Shared Hooks & Components (Frontend)

### `src/shared/hooks/useInAppNotifications.ts` — *frontend / shared hook*
TanStack Query over `/me/notifications` (+ unread count polling). Creation is owned by the backend, so there is no client‑side `addNotification`. **Depended on by:** `AppShell`.

### `src/shared/hooks/useTheme.tsx`, `useActivityTracker.ts`, `useDebounce.ts`, `use-mobile.tsx`, `useReducedMotion.ts` — *frontend / shared hooks*
Theme context, platform activity heartbeat, debounce utility, responsive + reduced‑motion helpers.

### `src/shared/components/` — *frontend / shared components*
`ErrorBoundary` (top‑level crash catcher), `errors/RouteError` (route‑level error element), `NotFound`, `CommandPalette`, `EmptyState`, `MouseGlow`, `PriorityBadge`.

---

## Backend — Core

### `server/main.py` — *backend / entry point*
Creates the FastAPI app, resolves the GCS credentials path, runs `init_db()` on startup via the lifespan, configures CORS for the frontend origin with credentials, and registers all 12 routers. Adds a `/api/v1/health` check. **Depends on:** `database`, every `routers/*`. **Depended on by:** uvicorn.

### `server/database.py` — *backend / infrastructure*
Builds the SQLAlchemy `engine` for Neon (with pool pre‑ping, small pool, 5‑min recycle for Neon's idle drops). Exposes the `get_session` dependency and `init_db()`. **Depended on by:** every router and `ai_utils`/`admin` background tasks.

### `server/models.py` — *backend / data model*
All SQLModel tables (the schema): `User`, `Major`, `Course`, `Lecturer`, `MaterialType`, `Material` (approved files), `FileRequest`, `PointsTransaction`, `UserRecentFile`, `UserPlatformSession`, `UserCourseActivity`, `FileViewingSession`, `UserNote`, `AuditLog`, `MaterialChunk` (1536‑dim vectors + HNSW index), `CourseLecturer`, `UserNotification`, `PinnedCourse`, `UserSettings`, `UserTask`. **Depended on by:** every router + `ai_utils`.

### `server/schemas.py` — *backend / API contract*
Pydantic request/response models: auth payloads (with password‑strength + match validators), file‑request shapes, admin payloads, gamification responses, viewer payloads, `AIChatRequest`/`ChatMessage`, notification, settings, and task schemas. Several response models intentionally use camelCase to match the frontend directly. **Depended on by:** the routers.

### `server/seed.py`, `add_column.py` — *backend / scripts*
Seed reference data; one‑off column migration helper.

---

## Backend — Routers

> Each router verifies identity with `get_verified_user` (or `get_admin_user`) and gets a DB session from `get_session`. See [BACKEND.md](./BACKEND.md) for request‑flow detail.

### `server/routers/auth.py` — *backend / auth*
`/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/me`, `/signout`. Bridges Auth0 (identity) with the local `User` table and sets/clears the HttpOnly `auth_token` cookie. **Depends on:** Auth0, `models.User`, `schemas` auth payloads.

### `server/routers/catalog.py` — *backend / catalog*
Read endpoints for `/majors`, `/courses`, `/lecturers`, `/years`, `/semesters`, `/types`, plus course‑lecturer assignment queries. **Depends on:** catalog models.

### `server/routers/files.py` — *backend / files*
`/files` (list approved `Material`s, filterable by course) and `/files/{id}` (single file + `downloadUrl`). **Depends on:** `Material`, `utils/shared` for signed GCS URLs.

### `server/routers/admin.py` — *backend / moderation*
The moderation engine: approve/reject (single + bulk) and undo, `/admin/audit-logs`, course‑lecturer assignment. On approve it creates a `Material`, moves the GCS file out of `trash_bin/`, awards `XP_UPLOAD_APPROVAL` points (idempotently), writes an `AuditLog` + `UserNotification`, and schedules a `BackgroundTask` to embed the PDF. **Depends on:** `get_admin_user`, `ai_utils.process_and_embed_pdf`, `utils/shared`, many models.

### `server/routers/tasks.py` — *backend / tasks*
CRUD for `/me/tasks` (GET list ordered by date/start_hour, POST 201, PATCH partial with ownership check, DELETE 204). **Depends on:** `UserTask`, task schemas.

### `server/routers/ai.py` — *backend / AI*
`POST /assistant/chat` — the RAG tutor endpoint — and `/me/notes`. Loads all chunks for the current file, builds the tutor system prompt, runs Gemini with the `search_course_knowledge` function‑calling tool, applies context caching for very large documents, and retries transient failures. **Depends on:** `ai_utils` (client + `search_material_context`), `Material`, `MaterialChunk`, `get_verified_user`. See [AI_INTEGRATION.md](./AI_INTEGRATION.md).

### `server/routers/gamification.py` — *backend / gamification*
`/me/reputation` (summary + transactions + badge) and `/reputation/leaderboard` (uses the denormalized `User.total_points` for speed). **Depends on:** `PointsTransaction`, `User`.

### `server/routers/activity.py` — *backend / activity*
`/me/recent-files`, `/me/activity/summary`, `/me/session/start`. Feeds the dashboard widgets. **Depends on:** `UserRecentFile`, `UserCourseActivity`, `UserPlatformSession`.

### `server/routers/viewer.py` — *backend / viewer*
PDF viewing session lifecycle (start / heartbeat / end) that drives reading‑time completion scoring and completion points. **Depends on:** `FileViewingSession`, viewer schemas.

### `server/routers/settings.py`, `pinned_courses.py`, `notifications.py` — *backend / per‑user state*
`/me/settings` (GET auto‑creates defaults, PATCH), `/me/pinned-courses` (GET/POST/DELETE), `/me/notifications` (list, unread‑count, mark read, read‑all). **Depend on:** `UserSettings`, `PinnedCourse`, `UserNotification`.

---

## Backend — Utils

### `server/utils/auth_utils.py` — *backend / auth*
`get_verified_user`: reads the JWT from the `auth_token` cookie (or `Authorization` header), validates it against Auth0's JWKS, and returns the matching local `User`. `get_admin_user` adds a role check. JWKS keys are cached in memory. **Depended on by:** every protected router.

### `server/utils/ai_utils.py` — *backend / AI core*
Initializes the Gemini `client`. `process_and_embed_pdf` extracts PDF text (pypdf), creates 1000‑char chunks with 200‑char overlap, embeds them in batches of 100 (`gemini-embedding-001`, truncated to 1536 dims), and writes `MaterialChunk` rows. `search_material_context` embeds a query and runs a pgvector cosine‑distance search filtered by `course_id`. Both paths retry with Tenacity. **Depended on by:** `routers/ai.py`, `routers/admin.py`.

### `server/utils/upload_utils.py`, `shared.py` — *backend / storage*
GCS helpers and the shared `storage_client` + `BUCKET_NAME`. **Depended on by:** `admin.py`, `files.py`, upload paths.

---

## Tests & Config

- **`src/test/`** — Vitest setup + MSW (`setup.ts`, `mocks/handlers.ts`, `mocks/server.ts`).
- **Frontend tests** — `lib/__tests__/utils.test.ts`, `dashboard/hooks/__tests__/useTasks.test.tsx` & `useDashboardData.test.ts`, `auth/api/__tests__/authService.test.ts`, `admin/components/__tests__/RequestFileModal.test.tsx`, `dashboard/pages/__tests__/Dashboard.test.tsx`.
- **Config** — `vite.config.ts` (dev proxy to backend), `vitest.config.ts`, `tailwind.config.js`, `components.json` (shadcn), `eslint.config.js` (`react-hooks/exhaustive-deps: 'error'`), `tsconfig*.json`.
- **Infra** — `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `requirements.txt`, `package.json`.
