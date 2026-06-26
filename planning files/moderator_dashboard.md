---
name: moderator-dashboard
description: "The /moderator section — MODERATOR/ADMIN directory management (users, lecturers, courses) added Jun 16 2026."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9c417cc6-08a9-4d76-9131-18460a898312
---

A `/moderator` dashboard was implemented Jun 16 2026 for `MODERATOR` (and `ADMIN`) users to manage the platform directory.

**Backend:** `server/routers/directory.py` (prefix `/api/v1/directory`; renamed from moderator.py on the quality-review pass), gated by `get_moderator_user` dep in `utils/auth_utils.py` (passes ADMIN or MODERATOR). 10 routes: stats; users (list/PUT/DELETE); lecturers CRUD; lecturer↔course assign (lecturer side); courses POST/PUT/DELETE + GET `/courses/{id}/lecturers`. Reuses the existing `CourseLecturer` junction model — NOT a new table. Request payload schemas in `schemas.py` (`ModeratorUserUpdate`, `LecturerCreate/Update`, `CourseCreate/Update`) use **camelCase** field names (project convention — frontend sends camelCase; see [[backend-frontend-sync]]). Destructive deletes catch `IntegrityError` → 409. NOTE: a router-module rename like this needs a full uvicorn restart (`--reload` doesn't pick up new imports into main.py).

**Frontend:** shared data layer at `src/features/directory/` (api/directoryService.ts, hooks/useDirectory.ts, components/Avatar.tsx + AssignmentManager.tsx) used by BOTH sections — neutral name fixes the old admin→moderator cross-feature import smell. Hooks: `useDirectoryStats/Users/Lecturers`, `useCreate/Update/Delete*`, `use(Un)assignLecturerCourse`, `useLecturerCourses/useCourseLecturers`. Query keys centralized in `lib/queryKeys.ts` under `directory`. `ProtectedRoute` takes `requiredRoles?: Role[]`. AppShell shows an amber "Moderator" link for MODERATOR/ADMIN. Catalog year/semester constants in `lib/catalog.ts`. Badge tiers: `get_badge_tier` (server/utils/shared.py) returns lowercase `newcomer/bronze/silver/gold/diamond` matching the frontend `BadgeTier` union. UUID-safety: `components/ui/select.tsx` `SelectValue` never renders a UUID (falls back to placeholder).

**Page locations (after the Jun 16 reorg):**
- `/moderator` (ADMIN+MODERATOR) → ModeratorShell + ModeratorHome + UsersPage only. Users management lives here.
- `/admin` (ADMIN only) → Lecturers + Courses management pages live here: `src/features/admin/pages/LecturersPage.tsx` and `CoursesPage.tsx` (blue-themed, added under AdminShell "Directory" nav section). They import the shared useModerator hooks. CoursesPage assigns lecturers from the course side; LecturersPage from the lecturer side; both call the same junction endpoints and invalidate both caches.

Retired Jun 16 2026: the old admin `CatalogManager` page, its `catalogAdminService.ts`, and the `/api/v1/admin/courses/{id}/lecturers` endpoints (get/assign/unassign in admin.py, plus admin.py's CourseLecturer import) were all deleted — the new admin CoursesPage replaces them. `seed.py` only creates STUDENT users; set a role manually in the DB to test. See [[frontend-structure]] and [[project-state]].

**Jun 25 2026 update (commits bcbb32f + e98efb7):**
- **Bug fixed — lecturer listing endpoint:** `directory.py::list_lecturers` was rewritten. The old course-count `subquery()` + outer join was replaced with a direct `select(Lecturer, func.count(CourseLecturer.course_id)).join(..., isouter=True).group_by(Lecturer.id)`, wrapped in try/except → `HTTPException(500, detail=str(e))`. `test_query.py` (new, repo root) is a throwaway diagnostic that runs both the direct `select(Lecturer)` and the old subquery to compare results.
- **LecturersPage** (`src/features/admin/pages/`): added `isError`/`error` handling (useEffect + sonner toast), `SKELETON_COUNT` const, dialogs refactored (dropped inline `newName`/`renameValue` state). Still correctly imports the shared `@/features/directory` hooks.
- **EditUserDialog** (in UsersPage): switched from `key={user.id}` remount to a nullable `user` prop with a `useEffect` that re-seeds local form state — fixes stale-field carryover when reopening for a different user.
- **Regression introduced by e98efb7, FIXED in working tree (uncommitted as of Jun 25).** UsersPage.tsx (`src/features/moderator/pages/`) was changed to import `useModeratorUsers/useUpdateModeratorUser/useDeleteModeratorUser` from `@/features/moderator/hooks/useModerator` and `ModeratorUser` from `@/features/moderator/api/moderatorService` — **neither file ever existed** (the moderator folder only has `pages/`), so `tsc -b` failed with TS2307 + a cascading TS7053. Reverted the imports/types back to `useDirectoryUsers/useUpdateUser/useDeleteUser` from `@/features/directory/hooks/useDirectory` and `DirectoryUser` from `@/features/directory/api/directoryService` (mutation signatures match: `update.mutate({id,data})`, `delete.mutate(id)`). Lesson: there is no `features/moderator` data layer — the shared `features/directory` layer is the single source of truth for Users/Lecturers/Courses. NOTE: `tsc -b` still reports ~16 *pre-existing* errors in other files (AppShell, AuthContext role comparisons, several test files, FileViewer/Recent/CommandPalette `RecentFile.type`) — unrelated to this feature, predate Jun 25.
</content>
