# GeeksHub — Architecture

> High‑level overview of the whole system: what it does, who uses it, the tech stack, and how data moves through it. For folder‑level detail see [FOLDERS.md](./FOLDERS.md); for file‑level detail see [FILES_OVERVIEW.md](./FILES_OVERVIEW.md).

---

## 1. What the Project Does

**GeeksHub** is a university course‑materials platform for students at Azrieli College of Engineering. Students **share, browse, and study** lecture files (PDF slides, notes, past exams, homework). The platform adds two things on top of plain file sharing:

1. **Gamification** — students earn reputation points and badges for uploads that get approved and for actually reading material.
2. **An AI Study Companion** — an in‑app tutor (Google Gemini) that can read the document you're viewing and search across all of a course's materials to answer questions.

### Who the Users Are

| Role | What they do |
|---|---|
| **Student** | Browse the course catalog, read PDFs in the in‑app viewer, request to upload new files, track a personal learning‑plan calendar, chat with the AI tutor, earn reputation. |
| **Admin** | Moderate upload requests (approve / reject / bulk actions), manage the course catalog and lecturer assignments, view the audit log of all moderation actions. |
| **Moderator** | Planned role (see `moderator_dashboard_plan.md`); not yet built. |

### Main Features & User Flows

- **Auth flow** — sign up (with email verification via Auth0) → sign in → protected app. Role decides whether the `/admin` area is reachable.
- **Browse flow** — Major → Year → Semester → Course cascading dropdowns → course material/notes/exam tabs → open a file in the PDF viewer.
- **Upload flow** — student submits a file request (multi‑step modal) → file lands in Google Cloud Storage as "pending" → admin approves → a `Material` row is created, the PDF is embedded for AI search, points are awarded, the uploader is notified.
- **Study flow** — open a PDF → a viewer session tracks reading time and awards completion points → select text and "Ask AI" → chat with the tutor → pin useful answers to a notes board.
- **Dashboard flow** — personal learning‑plan calendar (drag‑to‑schedule tasks), recent courses with progress, weekly activity, reputation summary.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend framework** | React 19 + TypeScript |
| **Build tool** | Vite 7 |
| **Routing** | react-router-dom v7 (`createBrowserRouter`, lazy routes) |
| **Server state / data fetching** | TanStack Query v5 (`useQuery` / `useMutation`) |
| **Styling** | Tailwind CSS 3 + a custom "Liquid Glass" design system (tokens in `src/index.css`) |
| **UI primitives** | shadcn/ui (Radix UI under the hood) |
| **Icons / toasts** | lucide-react / Sonner |
| **PDF rendering** | react-pdf |
| **Frontend testing** | Vitest + React Testing Library + MSW |
| **Backend framework** | FastAPI (Python) |
| **ORM** | SQLModel (SQLAlchemy + Pydantic) |
| **Database** | PostgreSQL hosted on Neon, with the **pgvector** extension |
| **Auth** | Auth0 (issues JWTs, verified server‑side; delivered to the browser as an HttpOnly cookie) |
| **File storage** | Google Cloud Storage (GCS) |
| **AI / LLM** | Google Gemini — `gemini-2.5-flash` (chat) + `gemini-embedding-001` (embeddings) |
| **AI resilience** | Tenacity (automatic retries) |
| **PDF text extraction** | pypdf |

---

## 3. High‑Level Architecture (ASCII)

```
                            ┌──────────────────────────────────────────────┐
                            │                  BROWSER                       │
                            │           React 19 SPA (Vite build)            │
                            │                                                │
                            │  Pages / Components                            │
                            │      │                                         │
                            │      ▼                                         │
                            │  Query & Mutation hooks  (TanStack Query)      │
                            │      │                                         │
                            │      ▼                                         │
                            │  Service layer  (features/*/api/*.ts)          │
                            │      │                                         │
                            │      ▼                                         │
                            │  apiClient.ts  ── adds credentials, converts   │
                            │                    snake_case → camelCase      │
                            └──────────────────┬─────────────────────────────┘
                                               │  HTTPS  /api/v1/*
                                               │  (HttpOnly auth_token cookie)
                                               ▼
                            ┌──────────────────────────────────────────────┐
                            │              FastAPI BACKEND                   │
                            │                                                │
                            │  Routers (auth, catalog, files, admin,         │
                            │   tasks, ai, gamification, activity, viewer,   │
                            │   settings, pinned_courses, notifications)     │
                            │      │                                         │
                            │      ├── get_verified_user  ──► Auth0 JWKS      │
                            │      │     (decode + validate JWT)             │
                            │      │                                         │
                            │      ├── SQLModel ORM ──► get_session           │
                            │      │                                         │
                            │      └── utils (ai_utils, upload_utils, shared)│
                            └───┬───────────────┬───────────────┬────────────┘
                                │               │               │
                  ┌─────────────▼──┐   ┌────────▼───────┐   ┌───▼────────────┐
                  │  Neon Postgres │   │  Google Cloud  │   │  Google Gemini │
                  │   + pgvector   │   │    Storage     │   │      API       │
                  │                │   │  (PDF files,   │   │ chat + embed   │
                  │ users, courses,│   │   trash_bin/)  │   │                │
                  │ materials,     │   └────────────────┘   └────────────────┘
                  │ material_chunks│
                  │ (vectors)…     │            ▲
                  └────────────────┘            │
                         ▲                       │ Auth0 issues / verifies JWT
                         │                ┌──────┴───────┐
                         └────────────────│    Auth0     │
                          (HNSW vector    │  (identity)  │
                           similarity)    └──────────────┘
```

---

## 4. How Data Flows Through the System

### Read flow (e.g. loading the course catalog)
```
Component → useQuery hook → service function → api() in apiClient.ts
  → fetch /api/v1/courses (cookie attached)
  → FastAPI router → SQLModel query → Neon Postgres
  → JSON response → apiClient converts snake_case→camelCase
  → TanStack Query caches it → component re-renders
```

### Write flow (e.g. approving an upload)
```
Admin clicks "Approve" → useMutation → requestService → api() POST /admin/requests/{id}/approve
  → admin router verifies admin role (get_admin_user → Auth0 JWT)
  → creates a Material row, moves the file in GCS, awards points, writes an AuditLog + UserNotification
  → schedules a BackgroundTask that downloads the PDF from GCS and embeds it into material_chunks
  → returns 200 → frontend invalidates query keys → lists refresh
```

### AI flow (asking the tutor a question)
```
User selects text / types a question → assistantService.sendMessage
  → POST /api/v1/assistant/chat { fileId, message, history }
  → ai router loads ALL chunks for the current file → builds a system prompt
  → calls Gemini gemini-2.5-flash with a function-calling tool
  → if the question is cross-material, Gemini invokes search_course_knowledge,
     which embeds the query and runs a pgvector cosine-distance search filtered by course_id
  → Gemini returns a grounded answer → { reply, agentAction } → rendered in the chat panel
```

See [AI_INTEGRATION.md](./AI_INTEGRATION.md) for the full RAG pipeline.

---

## 5. Cross‑Cutting Concerns

- **Auth.** Auth0 owns identity. On sign‑in the backend sets an `HttpOnly; SameSite=Lax` `auth_token` cookie. Every request from the SPA uses `credentials: "include"`, so the cookie rides along automatically. The backend's `get_verified_user` dependency validates the JWT against Auth0's public keys (JWKS) and looks up the matching `User` row. A cached `localStorage`/`sessionStorage` user is only an optimistic UI hint — the server is always the source of truth for role and identity.
- **Naming convention bridge.** The backend speaks `snake_case`; the frontend speaks `camelCase`. `apiClient.snakeToCamel` converts every response automatically, so components never see snake_case. A few backend schemas (tasks, settings, notifications, reputation) already emit camelCase to skip the conversion entirely.
- **Error handling.** The SPA has a top‑level `ErrorBoundary` and route‑level `RouteError` elements. TanStack Query is configured to **not** retry 4xx responses (so 404s from not‑yet‑built endpoints don't spam the console).
- **Background work.** Heavy work (PDF embedding) runs in FastAPI `BackgroundTasks` with their own database sessions, because the request‑scoped session is closed before the task runs.
