---
name: project-state
description: "Current implementation status of GeeksHub — which backend endpoints are live, what was recently completed, and what is still pending."
metadata: 
  node_type: memory
  type: project
  originSessionId: ad6f6bcf-ce4b-449d-9b34-60a731efe1ff
---

GeeksHub is a university course materials platform (React + FastAPI + Neon Postgres). The canonical project memory lives in `memory.md` at the repo root — always read that for full detail. This entry captures the high-level status for quick orientation.

**Backend routers registered in `server/main.py`:** auth, catalog, files, admin, gamification, activity, viewer, ai, tasks.

**Tasks API live as of May 18 2026:** `server/routers/tasks.py` implements full CRUD at `/api/v1/me/tasks`. `UserTask` model added to `server/models.py`. Frontend `src/services/taskService.ts` (new) and `src/hooks/useTasks.ts` (refactored) both use the live API. Tasks are no longer localStorage-backed.

**Lecturers model simplified May 18:** `Lecturer.email` field removed; `Lecturer.name` is now `unique=True`.

**May 22 2026 frontend cleanup:** Dashboard.tsx split (1127 → ~580 lines + 3 sub-components under `src/components/dashboard/`). Vitest + MSW test suite added (18 tests passing). `authService.ts` fully typed. `SESSION_KEY` constant extracted to `src/lib/constants.ts` — this invalidated any pre-existing localStorage sessions using the old key `"mock_user_session"`.

**Still pending / known issues:**
- Backend approval flow bug: approved files are deleted instead of persisted to `files` table.
- Many catalog endpoints (years, semesters, files, requests) still 404 in prod.
- `usePinnedCourses` is still localStorage-only (no backend sync).
- `MyPath.tsx` is a placeholder with no real content.

**Why:** Keeps future Claude sessions oriented without re-reading 340 lines of memory.md upfront.
**How to apply:** Use this for a quick orientation check. For endpoint details, file paths, or conventions, read `memory.md` directly.
