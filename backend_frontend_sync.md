---
name: backend-frontend-sync
description: Backend contract changes (May–Jun 2026 commits) vs frontend — which gaps are fixed and which still need frontend work to avoid 422/413/truncation.
metadata: 
  node_type: memory
  type: project
  originSessionId: eb632847-f7c0-4a74-a2f7-f8a5d005682b
---

Audit (2026-06-14) of recent backend commits vs frontend. Verify against current code before acting — the backend moves fast.

**Fixed in this session (2026-06-14):**
- **File size cap mismatch** — backend `server/utils/upload_utils.py` enforces `MAX_FILE_SIZE_MB = 15` (reads actual bytes, not spoofable `file.size`). Frontend said 25 MB. Set `MAX_FILE_SIZE = 15*1024*1024` in `src/features/admin/components/request-modal/useRequestForm.ts` + copy in `StepUpload.tsx`. Keep these in sync if either side changes.
- **Files pagination** — `GET /api/v1/files` now paginates (`page` default 1, `page_size` default 50, **max 100**). Frontend ignored it → only first 50 files showed per course. `fileService.listFiles` now pages through (size 100) until a short page, keeping the flat `File[]` contract so the 4 callers (Courses, CourseMaterials, CourseNotes, CourseExams) need no change.

**Input-limit guards (all addressed 2026-06-14):**
- AI chat: backend caps `message` ≤2000, `history` ≤20, each `content` ≤4000. `AssistantChat` textarea has `maxLength={2000}`; `sendMsg` now also `.slice(0,2000)` to cover programmatic text-selection injections that bypass maxLength. History capped at 10 (ok).
- Notes: `NotePayload.content` ≤50,000 (the serialized card array). `NotesBoard` now guards `addCard` + `pinNote` against `MAX_NOTES_CONTENT = 50_000` with a sonner toast.
- Settings: already safe — `language` Select only offers en/ar/he; `defaultYearId` comes from the years catalog (1–4). No code change.
- Tasks: `AddTaskModal` title input has `maxLength={200}`; `LearningPlan` drag clamps duration to `MAX_TASK_DURATION = 12` (full-height drag was 15h → would 422). `date` is `type="date"` (valid ISO); `startHour`/`duration` come from fixed option lists.

**Note:** AI chat is NOT token-streaming — `POST /assistant/chat` returns one JSON `{reply, agentAction}`. The "streaming" in commit a16a1c5 is PDF file serving only. Affects [[project-state]] testing plans.

PPTX upload is already in sync (frontend accepts .pptx/.ppt; backend converts to PDF on approve).
