# GeeksHub

**The course-material archive and AI study companion for Azrieli College of Engineering.**

Students upload past exams, slides, and notes. Admins moderate the content. Everyone studies smarter with an AI assistant that answers questions from the actual course files — not from the internet.

---

## What it does

- **Browse materials** by major → year → semester → course → type
- **Upload files** (PDF, PPTX, DOCX, images) for review; earn reputation points when approved
- **Study with AI** — Gemini 2.5 Flash answers questions grounded in the exact document you're reading, with RAG search across all course materials
- **Earn XP** for genuinely reading documents (tracked via viewer heartbeat, not just opens)
- **Schedule study sessions** on a drag-to-create 7-day timeline backed by a tasks API
- **Admin moderation queue** with bulk approve/reject, undo, and full audit log

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query, React Router 7, Tailwind CSS, Shadcn/ui |
| Backend | FastAPI, SQLModel, Uvicorn |
| Database | PostgreSQL via [Neon](https://neon.tech) + pgvector (RAG embeddings) |
| Auth | Auth0 (Username-Password; HTTP-only cookie) |
| Storage | Google Cloud Storage |
| AI | Google Gemini 2.5 Flash (chat) + gemini-embedding-001 (RAG) |

---

## Getting started

### Prerequisites

- Node.js ≥ 18
- Python 3.11
- A [Neon](https://neon.tech) database
- A [Google Cloud Storage](https://cloud.google.com/storage) bucket + service account key
- An [Auth0](https://auth0.com) tenant (Username-Password-Authentication connection)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### Frontend

```bash
npm install
npm run dev          # http://localhost:5173
```

### Backend

```bash
cd server
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# create server/.env — see Environment variables below
uvicorn main:app --reload --port 8000

# first run: seed the database
python seed.py
```

### Run both together

```bash
npm run dev:all      # Vite :5173 + Uvicorn :8000 via concurrently
```

---

## Environment variables

Create `server/.env`:

```env
DATABASE_URL=postgresql://...
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_M2M_ID=your-m2m-client-id
AUTH0_M2M_SECRET=your-m2m-client-secret
AUTH0_AUDIENCE=https://your-api-audience
GEMINI_API_KEY=your-gemini-key
BUCKET_NAME=your-gcs-bucket
GOOGLE_APPLICATION_CREDENTIALS=gcp_key.json
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

Frontend uses a Vite proxy in development — no `.env` needed unless deploying separately.

---

## Useful commands

```bash
npm run build          # production build
npm run test:run       # Vitest unit tests (18 tests)
npx tsc --noEmit       # type check
npm run lint           # ESLint
```

---

## Access control

Registration is restricted to `@post.jce.ac.il` email addresses. To use a different domain, change the `ALLOWED_DOMAINS` list in `server/routers/auth.py`.

---

## Project structure

```
server/          FastAPI backend
src/
  app/           Layouts + router
  features/      One folder per domain (auth, dashboard, courses, files, admin, gamification, assistant, profile, settings)
  shared/        Cross-feature components and hooks
  components/ui/ Shadcn/ui primitives
  lib/           apiClient, utils, logger
  types/         domain.ts
```

→ [Full architecture on the Wiki](../../wiki/Architecture)

---

## Documentation

| Document | Link |
|---|---|
| Architecture | [Wiki → Architecture](../../wiki/Architecture) |
| Getting Started (detailed) | [Wiki → Getting-Started](../../wiki/Getting-Started) |
| API Reference | [Wiki → API-Reference](../../wiki/API-Reference) |
| Database Schema | [Wiki → Database](../../wiki/Database) |
| Product Flows | [Wiki → Product-Flows](../../wiki/Product-Flows) |
| Infrastructure & Deployment | [Wiki → Infrastructure](../../wiki/Infrastructure) |
| Troubleshooting | [Wiki → Troubleshooting](../../wiki/Troubleshooting) |

---

## License

Private 
