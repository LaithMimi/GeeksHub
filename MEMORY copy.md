# Memory Index — GeeksHub

## Recent Updates & Highlights (Jun 25 2026)
- **All-features code review → 10 bugs fixed** (see [Bug-fix Sweep](bugfix_sweep_jun25.md)). Frontend `tsc --noEmit` clean.
- **Headline class — "file-switch" effect bugs:** viewer/assistant components keyed on `fileId` persist across route-param changes, so a save effect fires with the *previous* file's state before the load/re-seed runs. Hit chat (corruption), notes (wipe), and gamification (leaked progress). Fix pattern: gate persistence on a "hydrated-for-this-fileId" ref (or remount via `key={fileId}`).
- **Highest-severity fixes:** AssistantChat chat-clobber, NotesBoard notes-wipe, CourseNotes/Exams `type_id` (was sending the display label → empty tabs), useViewerSession stale refs, UsersPage "None" can't clear major (fixed front + backend `model_fields_set`).
- **Confirmed not-a-bug:** `features/directory` request bodies are **camelCase by design** (`server/schemas.py` comment); admin preview uses `/preview` proxy route (both `/preview` and `/url` exist server-side).
- **Still open (found, not yet fixed):** raw `RejectReason` enum shown to admins; `Recent.tsx` reads `file.type` absent from the DTO; Settings load-race clobber; UserProfile falsy-zero XP.

## Index

- [Project State](project_state.md) — Live backend endpoints, recent completions (Tasks API May 18, frontend cleanup May 22), and pending work
- [Frontend Structure](frontend_structure.md) — Feature-first src/ layout (refactored May 25 2026) — where to add new code
- [Selection Popup Pattern](feedback_selection_popup.md) — Shared SelectionPopup component (src/components/ui/selection-popup.tsx), wiring via AssistantPanelRef forwardRef, portal + document listeners pattern
- [Backend/Frontend Sync](backend_frontend_sync.md) — Contract gaps from recent backend commits: size cap (15MB) + files pagination fixed Jun 14; AI/settings/tasks validation guards still open; chat is not token-streaming
- [Moderator Dashboard](moderator_dashboard.md) — Directory CRUD (Jun 16); /moderator=Users, /admin=Lecturers+Courses; shared `features/directory` layer (no `features/moderator` data layer exists). Jun 25: lecturer-list query bug fixed + EditUserDialog re-seed fix; UsersPage build-break (imported a non-existent `features/moderator` hooks/service) **fixed** by reverting to the `features/directory` layer
- [Bug-fix Sweep Jun 25](bugfix_sweep_jun25.md) — 10 bugs from all-features review fixed: file-switch effect-ordering class (chat/notes/viewer), CourseNotes/Exams type_id mapping, major-clear (front+back), bulk-reject cap, optimistic task createdAt, preview blob leak
