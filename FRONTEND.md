# GeeksHub — Frontend Guide

> How the React app is built and wired. Read [ARCHITECTURE.md](./ARCHITECTURE.md) first for the system view; this file zooms into the browser side. File‑by‑file notes are in [FILES_OVERVIEW.md](./FILES_OVERVIEW.md).

---

## 1. Frontend Architecture at a Glance

- **Framework:** React 19 + TypeScript, built with Vite 7.
- **Routing:** react-router-dom v7 with `createBrowserRouter`. All pages are lazy‑loaded.
- **Server state:** TanStack Query v5. There is **no Redux/Zustand** — server data lives in the query cache, not a global store.
- **Local/UI state:** React `useState` + Context for the two truly global concerns (auth, theme).
- **Styling:** Tailwind CSS + a custom "Liquid Glass" token system (`src/index.css`). UI primitives come from shadcn/ui (`src/components/ui/`).
- **Layout:** feature‑first. Everything for one domain lives under `src/features/<name>/` in `api/ hooks/ components/ pages/`.

### The layered data pattern (the most important idea)

```
Page / Component
   │  calls
   ▼
Query / Mutation hook   (features/<name>/hooks/*)   ← caching, loading, invalidation
   │  calls
   ▼
Service function        (features/<name>/api/*)     ← returns a Promise, knows the endpoint
   │  calls
   ▼
api<T>()                (lib/apiClient.ts)          ← fetch, auth cookie, snake→camel, ApiError
   │
   ▼
FastAPI  /api/v1/*
```

**Why it matters:** components never call `fetch` directly and never know endpoint URLs. Hooks never build requests. If an endpoint changes, only the service file changes; if caching changes, only the hook changes. This separation is enforced consistently across every feature.

---

## 2. Bootstrap & Provider Stack

`src/main.tsx` renders the provider tree (outer → inner):

```
ErrorBoundary            ← catches render crashes app-wide
 └ AuthProvider          ← current user + signIn/signUp/signOut (useAuth)
    └ ThemeProvider      ← dark/light theme
       └ QueryClientProvider   ← TanStack Query cache
          ├ MouseGlow + mesh background  (ambient UI)
          ├ RouterProvider     ← the whole app
          └ Toaster            ← Sonner toasts
```

The `QueryClient` is configured to **not retry 4xx** responses and to skip refetch‑on‑focus, which keeps the console quiet against endpoints that may 404 and avoids surprise refetches.

---

## 3. Routing & Guards

`src/app/router/index.tsx` defines three groups:

1. **Public:** `/auth`, `/auth/reset-password`.
2. **Protected app:** wrapped by `ProtectedRoute` → `AppShell`. Children: Dashboard (`/`), `uploads`, `recent`, `settings`, `profile`, and the `courses` subtree (`courses` → `courses/:courseId` in `CourseShell` → materials/notes/exams → `files/:fileId` in `FileShell`).
3. **Protected admin:** `/admin` wrapped by `ProtectedRoute requiredRole="ADMIN"` → `AdminShell`. Children: Home, `requests`, `audit`, `catalog`.

Every page is wrapped in `Loadable(React.lazy(...))` so it code‑splits and shows a spinner while loading. Route‑level errors render `RouteError`; the catch‑all `*` renders `NotFound`.

**`ProtectedRoute`** (`src/shared/components/routing/`) reads `useAuth()`: it redirects to `/auth` when there's no user and enforces the role for the admin subtree. Because `AuthContext` reconciles the cached user against the server on boot, a tampered `localStorage` role cannot grant admin access — and even if the UI were fooled, the backend re‑checks the role on every admin endpoint.

---

## 4. State Management Details

| Concern | Where it lives | Notes |
|---|---|---|
| Server data (courses, files, tasks, reputation, notifications, settings, pinned courses) | TanStack Query cache | Keyed via `lib/queryKeys.ts`; mutations invalidate keys to refresh. |
| Auth (current user, role) | `AuthContext` | Persisted to `localStorage` (remember‑me) or `sessionStorage`; server is authoritative. |
| Theme | `ThemeProvider` (`useTheme`) | dark/light. |
| Ephemeral UI (modals, form fields, drag state) | local `useState` | e.g. drag state in `LearningPlan`. |

Several hooks use **optimistic updates** (`onMutate`) so the UI reacts instantly and rolls back on error — notably tasks (`useTasks`) and pinned courses (`usePinnedCourses`).

---

## 5. Feature Walkthroughs

### Auth
`AuthPage` → `SlidingAuth` → `forms/*`. Forms validate locally then call `useAuth().signIn/signUp`. `AuthContext.signIn` calls `authService.signIn`, persists the user, and lets the backend set the HttpOnly cookie. `signUp` does **not** auto‑login (email verification is required first). On boot, `AuthContext` calls `authService.getMe()` to reconcile identity/role; a 401/403 clears the session, a network error keeps the optimistic cached user.

### Catalog browsing
`Courses.tsx` renders cascading dropdowns powered by `useCatalog` hooks. Each level is `enabled` only once its parent is chosen (`useSemesters`/`useCourses` gate on `majorId`). Static lists (`useMajors`, `useTypes`, `useYears`) are cached with `staleTime: Infinity`. UUIDs are resolved to names before display so raw IDs never flash on screen.

### Files & PDF viewer
A course tab page lists files via `useFiles` → `fileService`. Opening a file routes into `FileShell` → `FilePage`, which mounts `FileViewer` (react-pdf) next to `AssistantPanel`. `useViewerSession` runs a heartbeat that tracks active reading time and triggers completion + reward. Selecting text in the PDF surfaces an "Ask AI" tooltip that pushes the selection into the assistant via a `forwardRef` handle on `AssistantPanel`.

### Dashboard & learning plan
`Dashboard.tsx` composes widgets fed by `useDashboardData` (memoized `recentCourses` + `weeklyActivity`) and the task calendar `LearningPlan`. `LearningPlan` shows 7 days (7 AM–10 PM), supports drag‑to‑move tasks within and across days with a ghost preview, and opens `TaskDetailsDialog` on a click. All task changes flow through `useTasks` → `taskService` → `/me/tasks` with optimistic updates.

### AI assistant
`AssistantPanel` has Chat and Notes tabs, both `forceMount`ed so the notes board ref is always available (Radix would otherwise unmount the inactive tab). `AssistantChat` calls `assistantService.sendMessage`, replaying only the last 10 messages, renders markdown replies, and lets the user copy a reply or pin it to `NotesBoard`. See [AI_INTEGRATION.md](./AI_INTEGRATION.md) for the backend side.

### Admin
`ModerationQueue` drives approve/reject (single + bulk) through `useRequests` mutations. `AuditLog` renders the moderation trail (lowercase action keys + a fallback so unknown actions can't crash; reads `metaData`). `CatalogManager` assigns/unassigns lecturers to courses with a per‑row search via `catalogAdminService`.

### Settings
`Settings.tsx` loads `/me/settings` on mount, then debounces a `PATCH` 600ms after each change (so dragging a toggle doesn't spam the server), with a localStorage fallback if the API is unreachable.

---

## 6. Forms, Data Handling & Errors

- **Forms:** controlled `useState` inputs with inline validation (e.g. password length lives in `ResetPasswordForm`). The upload modal uses a dedicated `useRequestForm` state hook across its steps and submits `multipart/form-data` (with both `academic_year` and `material_year`).
- **Loading / empty / error states:** queries expose `isLoading`/`isError`; pages render spinners (`PageLoader`), `EmptyState`, or error UI accordingly.
- **Mutations:** wrapped in `useMutation`; success shows a Sonner `toast()` and invalidates the relevant query keys; failures surface a toast and roll back optimistic state.
- **Auth errors:** `apiClient` throws typed `ApiError`; a `401` on a protected path auto‑clears the session and redirects to `/auth` (auth endpoints and `/me` are excluded so a failed login doesn't wipe state or loop).
- **Crash safety:** `ErrorBoundary` (global) + `RouteError` (per route) keep one broken page from taking down the app.

---

## 7. Naming Convention Bridge

The backend returns `snake_case`; `apiClient.snakeToCamel` recursively converts every response to `camelCase`, so components and types (`src/types/domain.ts`) are camelCase throughout. A few endpoints (tasks, settings, notifications, reputation) already emit camelCase server‑side. When adding a service, type the response in camelCase and let the converter do the rest — but watch for fields like `meta_data → metaData` that are easy to mismatch.

---

## 8. Testing

Vitest + React Testing Library + MSW. `src/test/setup.ts` wires jest‑dom and the MSW server; `mocks/handlers.ts` defines fake endpoints. Existing suites cover utility functions, the task hooks (sort order, derivations, happy + error paths), `authService`, the upload modal, and the dashboard. Run with `npm run test` (watch) / `npm run test:run` (one‑shot) / `npm run test:ui`.

---

## 9. Conventions

- Components: PascalCase. Services/hooks/utils: camelCase.
- `react-hooks/exhaustive-deps` is an **error** — effect deps must be complete.
- Never edit `src/components/ui/*` by hand (shadcn CLI owns them).
- New domain code goes in `features/<name>/`; only truly cross‑feature code goes in `shared/` or `lib/`.
- Use `@/...` path aliases (e.g. `@/lib/apiClient`, `@/features/...`).
