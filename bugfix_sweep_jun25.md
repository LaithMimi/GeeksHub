---
name: bugfix-sweep-jun25
description: 10 bugs found in an all-features code review on Jun 25 2026 and how each was fixed (data-loss, type_id, gamification, major-clear, etc.)
metadata:
  type: project
---

All-features `/code-review` on 2026-06-25 surfaced 10 verified bugs; all fixed the same day. Frontend `tsc --noEmit` clean after.

**Recurring root cause — the "file-switch" class.** Several viewer/assistant components key on `fileId` but persist across route-param changes (React Router reuses the instance). A save/persist effect then fires with the *previous* file's state before the load/re-seed effect runs. Whenever adding `fileId`-scoped state, either remount via `key={fileId}` or gate persistence on a "hydrated for this fileId" ref. **Why:** caused chat corruption, notes wipe, and leaked gamification progress. **How to apply:** never let a save effect run before its matching load effect has hydrated the current key.

The 10 fixes:
1. **AssistantChat.tsx** — save effect wrote old file's messages under the new file's localStorage key on switch (corruption). Fixed with `loadedFileIdRef`; save effect early-returns until the re-seed effect marks the current `fileId` loaded.
2. **NotesBoard.tsx** — debounced save POSTed `"[]"` on mount before `getNotes` resolved, wiping saved sticky notes. Fixed with `hydratedRef` (set true only after load resolves; reset false on `fileId` change); save effect bails until hydrated.
3. **CourseNotes.tsx / CourseExams.tsx** — passed display label (`"Notes"` / `"Past Papers"`) as `type_id`; backend filters by id, so tabs were always empty. Fixed by resolving the id via `useTypes()` (`types.find(t => t.displayName === ...).id`) and gating on `typesLoading`.
4. **useViewerSession.ts** — `visitedPagesRef`/`activeSecondsRef`/`isCompletedRef` never reset on `fileId` change, so 2nd file viewed never awarded completion points. Fixed with a reset effect on `[fileId]`; added `fileId` to the visited-pages effect deps so the current page is re-added after reset.
5. **UsersPage.tsx + server/routers/directory.py** — selecting "None" for a user's major sent `majorId: undefined` (dropped by JSON.stringify) and backend used `if payload.majorId is not None`, so a major could never be cleared. Fixed both sides: frontend sends explicit `null` (`UserUpdateInput.majorId` widened to `string | null`); backend uses `if "majorId" in payload.model_fields_set` (Pydantic v2.10) to honor explicit null. Note: directory request bodies are **camelCase by design** (`server/schemas.py` comment) — not a snake_case bug.
6. **ModerationQueue.tsx** — `handleBulkReject` lacked the 10-item cap + 60s cooldown that `handleBulkApprove` has. Mirrored the guard + `setCooldownSeconds(60)`.
7. **useTasks.ts** — optimistic created task had no `createdAt`; clicking it before refetch fed Invalid Date to date-fns `format` → crash. Added `createdAt: new Date().toISOString()` to the optimistic object.
8. **RequestDetailSheet.tsx + requestService.ts** — admin preview blob from `URL.createObjectURL` was never revoked (leak, up to 15MB each). Added a revoke-on-change/unmount effect. The `/preview` route is correct (backend has both `/preview` proxy and `/url` signed-URL); only the stale JSDoc was fixed.
9. **FileViewer.tsx** — on `fileId` change the old object URL was revoked but `pdfBlobUrl`/`pdfError` state wasn't cleared, so `<Document>` rendered a revoked URL and flashed "Could not render PDF". Added a reset effect on `[fileId]`.
10. **RequestDetailSheet.tsx** — `{request.pointsAwarded && (...)}` rendered a stray `0` for zero-point approvals. Changed to `{!!request.pointsAwarded && (...)}`.

Lower-severity items found but NOT yet fixed: raw `RejectReason` enum shown to admins (RequestDetailSheet ~242, AuditLog ~43); `Recent.tsx` renders `file.type` absent from the `RecentFile` DTO (always-empty badge); `Settings.tsx` async load can clobber a user toggle made before the response; `UserProfile.tsx` falsy-zero `user.totalPoints || reputation?.totalPoints`.

Related: [[moderator_dashboard]], [[frontend_structure]], [[backend_frontend_sync]].
