# GeeksHub — Project Memory

> This file is intended for AI agents and future developers to quickly understand the GeeksHub project structure, conventions, tech stack, and current state.

---

## 1. What is GeeksHub?

A university course materials platform where students **share, browse, and study** lecture files (PDFs, slides, notes, exams). Students earn **reputation points** for approved uploads. Admins moderate file requests via a moderation queue.

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
├── mock/mock-db.ts             # In-memory mock data (seed data for all entities)
├── services/                   # Service layer (mock implementations with @backend annotations)
│   ├── authService.ts          # Real fetch calls to /api/v1/signin, /api/v1/signup. Mock for password reset.
│   ├── fileService.ts          # File listing, details, recent files, top contributors
│   ├── catalogService.ts       # Majors, years, semesters, courses, lecturers
│   ├── requestService.ts       # File request CRUD + admin approval/rejection + audit logging
│   ├── reputationService.ts    # User reputation/points summary
│   ├── assistantService.ts     # AI chat + user notes (localStorage)
│   └── auditService.ts         # Admin audit log queries
├── queries/                    # TanStack Query hooks (thin wrappers over services)
│   ├── useFiles.ts             # useFiles, useFile, useTopContributors, useRecentFiles
│   ├── useCatalog.ts           # useMajors, useYears, useSemesters, useCourses, useLecturers
│   ├── useRequests.ts          # useMyRequests, useAllRequests, useApproveRequest, etc.
│   ├── useReputation.ts        # useReputation
│   └── useAudit.ts             # useAuditLogs
├── hooks/                      # React hooks (localStorage-based state)
│   ├── useTasks.ts             # Learning plan tasks (CRUD, localStorage)
│   ├── usePinnedCourses.ts     # Pinned course IDs (localStorage)
│   ├── useRecentFiles.ts       # Recent file history (localStorage) — DUPLICATE of queries/useFiles
│   ├── useTheme.tsx            # Theme provider + useTheme hook (light/dark/system)
│   ├── useReducedMotion.ts     # Accessibility: prefers-reduced-motion
│   └── use-mobile.tsx          # Breakpoint detection (768px)
├── context/
│   └── AuthContext.tsx          # Auth state (user, signIn, signUp, signOut). Persists to localStorage.
├── lib/
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
│   │   └── FileShell.tsx       # File viewer shell (resizable panels)
│   ├── viewer/
│   │   └── FileViewer.tsx      # Adobe PDF Embed API viewer
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
Component → Query Hook (queries/) → Service (services/) → Mock Data (mock/mock-db.ts)
                                                          └→ Real API (authService only)
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
- **Auth state**: React Context (`AuthContext`)
- **Theme state**: React Context (`ThemeProvider`)

---

## 5. Domain Model (key types in `types/domain.ts`)

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

## 6. Known Issues & Technical Debt

### Critical
1. **Backend approval flow bug**: `POST /api/v1/admin/requests/{id}/approve` deletes file metadata instead of persisting it to a `files` table. Approved files are lost.
2. **No `GET /api/v1/files` endpoint**: Backend has no way to list approved files. Frontend uses mock data.

### High
3. **Duplicate recent files system**: `hooks/useRecentFiles.ts` (localStorage) and `queries/useFiles.ts` → `services/fileService.ts` (mock) both track recent files. Consolidate into the query-based approach when backend is ready.
4. **Hardcoded `DEMO_USER_ID`**: `UserUploads.tsx` and `RequestFileModal.tsx` both hardcode `"u1"` instead of reading from `AuthContext`.
5. **Hardcoded `DEMO_ADMIN`**: Admin query hooks import `DEMO_ADMIN` from mock-db. Replace with actual auth when backend is ready.
6. **Dashboard greeting hardcoded**: `Dashboard.tsx` line 756 says "Welcome back, Deena" — should use `user.name` from `AuthContext`.

### Medium
7. **`lecturerId` filter not implemented**: `fileService.listFiles()` accepts `lecturerId` but doesn't filter (empty block was removed during cleanup).
8. **`MyPath.tsx` is a placeholder**: The learning path page has no real content.
9. **Course metadata hardcoded in Dashboard**: `COURSE_META` map in `Dashboard.tsx` duplicates data from `mock-db.ts`.
10. **`requestPasswordReset` is mock-only**: Uses `delay()` and returns static success. Backend endpoint not implemented yet.

### Low / Polish
11. **Adobe PDF Embed API key hardcoded**: `FileViewer.tsx` line 58 has a hardcoded `clientId`.
12. **`listTopContributors` returns mock stubs**: Data is seeded in `mock-db.ts`, not ever calculated.
13. **`useYears` enabled logic**: `enabled: !!majorId || true` — the `|| true` makes the `majorId` guard useless.

---

## 7. Conventions

- **File naming**: PascalCase for components, camelCase for services/hooks/queries
- **JSDoc `@backend`**: Annotates mock functions with the real API endpoint they should call
- **Migration guide headers**: Each service file has a block comment explaining backend migration steps
- **Shadcn/ui**: The `components/ui/` directory contains generated primitives — do NOT modify directly
- **Tailwind**: Custom design tokens defined in `index.css` under the Liquid Glass system
- **Error boundaries**: Route-level (`RouteError`) + top-level (`ErrorBoundary`)
- **Toast notifications**: Use `toast()` from `sonner` for user feedback on mutations

---

## 8. How to Run

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

## 9. Backend Connection

The frontend expects the backend at `http://localhost:8000/api/v1`. Currently only `authService.ts` makes real API calls. All other services use mock data from `mock/mock-db.ts`.

To connect the full backend:
1. Update each service file to replace mock implementations with `fetch` calls
2. Query hooks (`queries/`) need **no changes** — they call services which return Promises
3. Remove `@backend` annotations and migration guide headers once migration is complete
4. Delete `mock/mock-db.ts` and `hooks/useRecentFiles.ts` (consolidated into query layer)
