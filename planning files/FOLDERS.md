# GeeksHub — Folder Guide

> What each top‑level folder is for, its key subfolders, and how it connects to the rest of the system. Start with [ARCHITECTURE.md](./ARCHITECTURE.md) for the big picture, then use this to know *where things live*.

The repo holds two applications in one tree:

- **`src/`** — the React frontend (feature‑first layout, refactored May 2026).
- **`server/`** — the FastAPI backend.

Plus build config, docs, and infra files at the root.

---

## Top‑Level Layout

```
GeeksHub/
├── src/            # React + TypeScript frontend
├── server/         # FastAPI + SQLModel backend
├── public/         # Static assets served as‑is by Vite
├── dist/           # Production build output (generated)
├── scripts/        # One‑off maintenance / dev scripts
├── *.md            # Project docs (this file, ARCHITECTURE.md, memory.md, etc.)
├── package.json    # Frontend deps + npm scripts (incl. dev:all, dev:back)
├── requirements.txt# Backend Python deps
├── vite.config.ts  # Vite + dev proxy to the backend
├── tailwind.config.js, postcss.config.js, components.json  # Styling / shadcn config
├── tsconfig*.json, eslint.config.js, vitest.config.ts      # TS / lint / test config
├── Dockerfile, docker-compose.yml, nginx.conf              # Containerization
└── .env            # Shared env vars (DB URL, API keys — not committed in prod)
```

---

## `src/` — Frontend

> **Rule of thumb:** code that belongs to one domain lives in `features/<name>/`. Code shared across features lives in `shared/`. App bootstrap lives in `app/`. `components/ui/` and `lib/` stay put because they're shadcn/ui conventions.

```
src/
├── main.tsx            # Entry point. Wraps the app in ErrorBoundary → AuthProvider
│                       #   → ThemeProvider → QueryClientProvider → RouterProvider.
├── index.css           # Global styles + "Liquid Glass" design tokens.
├── types/domain.ts     # All shared TypeScript domain interfaces.
│
├── app/                # App-level wiring (no business logic)
│   ├── layouts/        # AppShell, AdminShell, CourseShell, FileShell — page chrome + <Outlet/>
│   └── router/         # index.tsx — every route definition, lazy-loaded
│
├── features/           # One folder per domain. Each may contain api/ components/ hooks/ pages/
│   ├── auth/           # Sign in/up, reset password, AuthContext, ProtectedRoute consumer
│   ├── dashboard/      # Learning-plan calendar, tasks, dashboard widgets
│   ├── courses/        # Catalog browsing, course tabs, pinned courses
│   ├── files/          # File listing, PDF viewer, upload requests, viewer sessions
│   ├── admin/          # Moderation queue, audit log, catalog manager
│   ├── assistant/      # AI chat panel + sticky notes board
│   ├── gamification/   # Reputation, leaderboard, learning path, celebrations
│   ├── profile/        # User profile page
│   └── settings/       # User settings page + service
│
├── shared/             # Cross-feature building blocks
│   ├── components/     # CommandPalette, EmptyState, ErrorBoundary, NotFound, MouseGlow,
│   │                   #   PriorityBadge, errors/RouteError, routing/ProtectedRoute
│   └── hooks/          # useTheme, useInAppNotifications, useActivityTracker,
│                       #   useDebounce, use-mobile, useReducedMotion
│
├── components/ui/      # shadcn/ui primitives (button, dialog, table, …) — CLI-generated, do NOT hand-edit
│
├── lib/                # Cross-cutting utilities (NOT feature-specific)
│   ├── apiClient.ts    # The single fetch wrapper every service uses
│   ├── constants.ts    # SESSION_KEY etc.
│   ├── queryKeys.ts    # Centralized TanStack Query key factories
│   ├── utils.ts        # cn(), getGreeting(), formatDeadline(), formatHour(), …
│   ├── formatDate.ts, logger.ts
│   └── __tests__/      # Utility unit tests
│
└── test/               # Vitest setup + MSW mock server (setup.ts, mocks/handlers.ts, mocks/server.ts)
```

**How a feature folder is structured (consistent across features):**

| Subfolder | Responsibility | Talks to |
|---|---|---|
| `api/` | Service functions that call backend endpoints via `api()`. Return Promises. | `lib/apiClient.ts` |
| `hooks/` | TanStack Query wrappers around the services + derived‑state hooks. | the feature's `api/`, `lib/queryKeys.ts` |
| `components/` | Presentational + interactive pieces used by the feature's pages. | the feature's `hooks/`, `components/ui/` |
| `pages/` | Route entry components (composition roots). | the feature's `hooks/` + `components/` |

**Key cross‑folder relationships:**
- `app/router/index.tsx` lazy‑imports `pages/` from every feature and wraps them in `app/layouts/` shells, gated by `shared/components/routing/ProtectedRoute`.
- Every `features/*/api/*.ts` service imports `api` from `lib/apiClient.ts`.
- Every `features/*/hooks/*.ts` query hook imports key factories from `lib/queryKeys.ts`.
- `features/auth/context/AuthContext.tsx` is consumed app‑wide via the `useAuth()` hook.

---

## `server/` — Backend

```
server/
├── main.py             # FastAPI app + lifespan (init_db) + CORS + registers all routers.
├── models.py           # SQLModel ORM tables (the database schema).
├── schemas.py          # Pydantic request/response models (the API contract).
├── database.py         # Neon engine, get_session dependency, init_db().
├── seed.py             # Seeds reference data (majors, courses, types, …).
├── add_column.py       # Ad-hoc migration helper.
│
├── routers/            # One file per domain — defines the HTTP endpoints
│   ├── auth.py             # /signin, /signup, /forgot-password, /reset-password, /me, /signout
│   ├── catalog.py          # /majors, /courses, /lecturers, /years, /semesters, /types (+ course-lecturer assignment)
│   ├── files.py            # /files, /files/{id}
│   ├── tasks.py            # /me/tasks CRUD
│   ├── admin.py            # /admin/requests/*, /admin/audit-logs, /admin/courses/{id}/lecturers
│   ├── gamification.py     # /me/reputation, /reputation/leaderboard
│   ├── activity.py         # /me/recent-files, /me/activity/summary, /me/session/start
│   ├── viewer.py           # PDF viewer session start / heartbeat / end
│   ├── ai.py               # /assistant/chat, /me/notes (the RAG endpoint)
│   ├── settings.py         # /me/settings (GET, PATCH)
│   ├── pinned_courses.py   # /me/pinned-courses (GET, POST, DELETE)
│   └── notifications.py    # /me/notifications, /unread-count, /{id}/read, /read-all
│
├── utils/              # Shared backend helpers
│   ├── auth_utils.py       # get_verified_user / get_admin_user (Auth0 JWT verification)
│   ├── ai_utils.py         # Gemini client, PDF embedding, vector search (RAG core)
│   ├── upload_utils.py     # GCS upload helpers
│   └── shared.py           # GCS storage_client, BUCKET_NAME
│
├── venv/               # Python virtual environment (not committed)
├── gcp_key.json        # GCS service-account key (secret — keep out of VCS)
└── .env                # DATABASE_URL, AUTH0_*, GEMINI_API_KEY, etc.
```

**How backend folders connect:**
- `main.py` imports every module in `routers/` and calls `app.include_router(...)` on each.
- Every router imports tables from `models.py`, payload/response shapes from `schemas.py`, the `get_session` dependency from `database.py`, and auth dependencies from `utils/auth_utils.py`.
- `routers/ai.py` and the embedding step in `routers/admin.py` both use `utils/ai_utils.py`.
- `routers/admin.py` and the upload paths use `utils/shared.py` + `utils/upload_utils.py` for GCS access.

---

## Root Config & Docs (quick reference)

| File / folder | Purpose |
|---|---|
| `vite.config.ts` | Dev server + proxy that forwards `/api/v1` to FastAPI on :8000 (so the auth cookie is same‑origin). |
| `package.json` | `dev` (frontend), `dev:back` (uvicorn), `dev:all` (both via concurrently), `build`, `lint`, `test*`. |
| `requirements.txt` | Backend Python dependencies. |
| `docker-compose.yml`, `Dockerfile`, `nginx.conf` | Container build + reverse proxy for deployment. |
| `memory.md` | The canonical, deep project memory for AI agents / new devs. |
| `AI_RAG_SYSTEM.md` | Original deep‑dive on the AI/RAG system (superseded/extended by `AI_INTEGRATION.md`). |
| `BACKEND_TASKS.md` | Backend endpoint tracker. |
| `moderator_dashboard_plan.md` | Plan for the not‑yet‑built moderator role. |
