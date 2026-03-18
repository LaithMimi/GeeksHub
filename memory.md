# GeeksHub — Project Memory

> This file is intended for AI agents and future developers to quickly understand the GeeksHub project structure, conventions, tech stack, and current state.

---

## 1. What is GeeksHub?

A university course materials platform where students **share, browse, and study** lecture files (PDFs, slides, notes, exams). Students earn **reputation points** for approved uploads. Admins moderate file requests via a moderation queue.

---

## 1.1 Highlights of Recent Updates (March 2026)
- **Auth Hardening:** Switched to `HttpOnly` cookie-based JWTs. `credentials: 'include'` now applied to all API calls. Added 403 blocks for unverified emails on sign-in.
- **Backend APIs Connected:** Real integration with live Neon Postgres endpoints for `/majors`, `/courses`, and `/types`.
- **Course Library Rework:** Reverted the UI to cascading dropdowns (Major → Year → Semester → Course). The user's major is now auto-fetched from their profile via `useAuth().user.majorId`.
- **Mock Data Fully Removed (March 19):** All 6 services (`catalogService`, `fileService`, `requestService`, `reputationService`, `auditService`, `assistantService`) now call live API endpoints via `apiClient.ts`. Both `Courses.tsx` and `Settings.tsx` were cleaned of direct mock imports and switched to `useCourses()`, `useMajors()`, `useYears()` hooks. **`src/mock/mock-db.ts` and the `src/mock/` directory have been deleted.**
- **Frontend Upload Fix:** Fixed the `422 Unprocessable Content` error on file upload. Corrected the lecturer ID mapping in `Courses.tsx` (was sending name instead of UUID) and the FormData key in `requestService.ts` (`"description"` → `"notes"`).
- **PDF Viewer + AI Assistant Integration:** Created `FilePage.tsx` to bridge `FileViewer` and `AssistantPanel`. Added text-selection tooltip ("Ask AI") over PDF content. Simplified `FileShell.tsx` to a passthrough layout.
- **Consolidated Backend Tasks:** Merged `BACKEND_TASKS.md` and `backend.md` into a single prioritized task document aligned with the current frontend service calls.

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
| **Backend** | FastAPI + SQLModel + Auth0 (partially implemented) |
| **Storage** | Google Cloud Storage (backend, for file uploads) |
| **Database** | PostgreSQL via Neon DB (backend) |

---

## 3. Project Structure

```
src/
├── main.tsx                    # Entry point: ErrorBoundary → AuthProvider → ThemeProvider → QueryClientProvider → Router
├── index.css                   # Global styles + Liquid Glass design system tokens
├── types/domain.ts             # All TypeScript domain interfaces (User, Course, File, FileRequest, etc.)
├── services/                   # Service layer — ALL migrated to live API calls
│   ├── authService.ts          # Real fetch calls to /api/v1/signin, /api/v1/signup. Mock for password reset.
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
├── hooks/                      # React hooks (localStorage-based state)
│   ├── useTasks.ts             # Learning plan tasks (CRUD, localStorage)
│   ├── usePinnedCourses.ts     # Pinned course IDs (localStorage)
│   ├── useTheme.tsx            # Theme provider + useTheme hook (light/dark/system)
│   ├── useReducedMotion.ts     # Accessibility: prefers-reduced-motion
│   └── use-mobile.tsx          # Breakpoint detection (768px)
├── context/
│   └── AuthContext.tsx          # Auth state (user, signIn, signUp, signOut). Persists to localStorage.
├── lib/
│   ├── apiClient.ts            # Centralized fetch wrapper (typed, token injection, error handling)
│   ├── router.tsx              # All route definitions
│   └── utils.ts                # cn() — Tailwind class merge helper
├── components/
│   ├── pages/                  # Route-level page components
│   │   ├── Dashboard.tsx       # Main dashboard (1053 lines — largest file)
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
│   │   └── FilePage.tsx        # NEW — bridges FileViewer + AssistantPanel + selectedText state
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
- Auth state is persisted to `localStorage` via a mock user session
- `authService.ts` makes **real** `fetch` calls to `http://localhost:8000/api/v1` for sign-in and sign-up
- `ProtectedRoute` checks `AuthContext` for auth + optional role guard (`requiredRole="ADMIN"`)

### State Management
- **Server state**: TanStack Query (all data fetching)
- **Local state**: React `useState` + `localStorage` (tasks, pinned courses, recent files, theme)
- **Auth state**: React Context (`AuthContext`). Token stored in `localStorage` (future: HTTP-only cookies)
- **Theme state**: React Context (`ThemeProvider`)

---

## 5. API Client (`lib/apiClient.ts`)

Centralized HTTP client used by all service files.
- `api<T>(path, init?)` — typed fetch wrapper
- Auto-injects `Authorization: Bearer <token>` from `localStorage`
- Uses `credentials: "include"` (ready for HTTP-only cookies)
- Throws `ApiError` with `status`, `message`, `data` on non-OK responses
- Handles `204 No Content` gracefully

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

---

## 7. Known Issues & Technical Debt

### Critical
1. **Backend approval flow bug**: `POST /api/v1/admin/requests/{id}/approve` deletes file metadata instead of persisting it to a `files` table. Approved files are lost.
2. **Many P0 backend endpoints missing**: See `BACKEND_TASKS.md` §14. Frontend calls are wired up but the backend doesn't serve them yet (years, semesters, lecturers, files, requests, etc.).

### Medium
3. **`MyPath.tsx` is a placeholder**: The learning path page has no real content.
4. **Course metadata hardcoded in Dashboard**: `COURSE_META` map in `Dashboard.tsx` duplicates data.
5. **`requestPasswordReset` is mock-only**: Uses `delay()` and returns static success.

### Low / Polish
6. **`listTopContributors` calls `/reputation/leaderboard`** — backend endpoint doesn't exist yet.
7. ~~**Adobe PDF Embed API key hardcoded**~~: FileViewer now uses `react-pdf` instead.
8. ~~**Mock data remnants**~~: ✅ RESOLVED — `mock-db.ts` deleted, all services and components fully migrated.

---

## 7.1 Frontend Next Steps (For Frontend Engineer)

### After Backend P0 Endpoints Land
1. **Test the full course browsing flow** — verify the cascading dropdowns work with real `/years`, `/semesters`, `/lecturers` data.
2. **Test the file listing** — verify `GET /files?course_id=...` returns real approved files for course material pages.
3. **Test the PDF viewer** — verify `GET /files/{id}` returns `downloadUrl` and the `react-pdf` viewer loads it.
4. **Test the upload flow end-to-end** — upload → pending → admin approve → file appears in library.

### After Backend P1–P2 Endpoints Land
5. **Wire up the admin moderation dashboard** — test bulk approve/reject, undo, stats.
6. **Wire up the reputation / leaderboard display** — verify points awarded on approval.
7. **Wire up the audit log viewer** — verify admin actions are logged and displayed.

---

## 8. Conventions

- **File naming**: PascalCase for components, camelCase for services/hooks/queries
- **JSDoc `@backend`**: Annotates mock functions with the real API endpoint they should call
- **Migration guide headers**: Each service file has a block comment explaining backend migration steps
- **Shadcn/ui**: The `components/ui/` directory contains generated primitives — do NOT modify directly
- **Tailwind**: Custom design tokens defined in `index.css` under the Liquid Glass system
- **Error boundaries**: Route-level (`RouteError`) + top-level (`ErrorBoundary`)
- **Toast notifications**: Use `toast()` from `sonner` for user feedback on mutations

---

## 9. How to Run

```bash
# Install dependencies
npm install

# Start dev server (Vite — default http://localhost:5173)
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

---

## 10. Backend Connection

The frontend expects the backend at `http://localhost:8000/api/v1` (configurable via `VITE_API_URL` env var).

**Migration status:**
- ✅ `authService.ts` — fully live
- ✅ `catalogService.ts` — fully live (`/majors`, `/types`, `/years`, `/semesters`, `/courses`, `/lecturers`)
- ✅ `fileService.ts` — fully live (`/files`, `/files/{id}`, `/reputation/leaderboard`, `/me/recent-files`)
- ✅ `requestService.ts` — fully live (`/courses/{id}/upload`, `/me/requests`, `/admin/requests/*`)
- ✅ `reputationService.ts` — fully live (`/me/reputation`)
- ✅ `auditService.ts` — fully live (`/admin/audit-logs`)
- ✅ `assistantService.ts` — fully live (`/assistant/chat`, `/me/notes`)

**All mock data has been removed.** `src/mock/mock-db.ts` and the `src/mock/` directory are deleted.

Query hooks (`queries/`) need **no changes** — they call services which return Promises.

**Cookie Auth:** Backend sets `Set-Cookie: auth_token=...; HttpOnly; SameSite=Lax` on signin. The frontend `apiClient` sends `credentials: "include"` automatically.

**See `BACKEND_TASKS.md`** for the full list of endpoints the backend engineer needs to implement.
