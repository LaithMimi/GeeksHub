# Moderator Dashboard — Implementation Plan (revised 2026-06-16)

## Context

GeeksHub has an `ADMIN`-gated section at `/admin` for file-request moderation. The
`MODERATOR` role already exists in `src/types/domain.ts`
(`Role = "STUDENT" | "ADMIN" | "MODERATOR"`) but has no dedicated UI. This plan adds a
`/moderator` route and its own shell that lets `MODERATOR` (and `ADMIN`) users manage the
platform **directory**: users, lecturers, and courses, plus lecturer↔course assignment.

> **Revision note (2026-06-16):** the original plan was written before two project changes:
> 1. The frontend was refactored to a **feature-first** layout (`src/features/*`,
>    `src/app/layouts`, `src/shared/*`). All old `src/components/*` / `src/lib/router.tsx`
>    paths are gone.
> 2. A `CourseLecturer` junction table (`course_lecturers`) and admin-gated lecturer↔course
>    assignment endpoints (`/api/v1/admin/courses/{id}/lecturers`) + a `CatalogManager`
>    admin page already shipped.
>
> This revision drops the duplicate junction table, fixes all paths, switches request
> payloads to **camelCase** (the real project convention — see `SettingsPatch`,
> `TaskCreate`), and reuses the existing `CourseLecturer` model.

---

## Architecture at a Glance

```
Browser /moderator
  └─ ProtectedRoute (requiredRoles: ["ADMIN","MODERATOR"])
       └─ ModeratorShell (new, mirrors AdminShell)
            ├─ ModeratorHome
            ├─ UsersPage
            ├─ LecturersPage   ──→ POST/DELETE /api/v1/moderator/lecturers/{id}/courses/{cid}
            └─ CoursesPage

Backend /api/v1/moderator/*
  ├─ get_moderator_user dep (new, in auth_utils.py)
  ├─ stats
  ├─ users CRUD
  ├─ lecturers CRUD + lecturer↔course assignment
  └─ courses CRUD
  (reuses the EXISTING CourseLecturer junction model — no new table)
```

---

## Phase 1 — Backend

### 1a. Junction table — REUSE existing

No new table. `models.py` already defines:

```python
class CourseLecturer(SQLModel, table=True):
    __tablename__ = "course_lecturers"
    course_id: UUID = Field(foreign_key="courses.id", primary_key=True)
    lecturer_id: UUID = Field(foreign_key="lecturers.id", primary_key=True)
```

### 1b. `server/schemas.py` — add moderator payloads (camelCase fields)

```python
class ModeratorUserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    majorId: Optional[UUID] = None
    role: Optional[Literal["STUDENT", "MODERATOR", "ADMIN"]] = None

class LecturerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class LecturerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class CourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    majorId: UUID
    yearId: int = Field(ge=1, le=4)
    semester: int = Field(ge=1, le=3)

class CourseUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=40)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    majorId: Optional[UUID] = None
    yearId: Optional[int] = Field(default=None, ge=1, le=4)
    semester: Optional[int] = Field(default=None, ge=1, le=3)
```

### 1c. `server/utils/auth_utils.py` — add `get_moderator_user`

```python
def get_moderator_user(current_user: User = Depends(get_verified_user)):
    if current_user.role not in ("ADMIN", "MODERATOR"):
        raise HTTPException(status_code=403, detail="Moderator privileges required.")
    return current_user
```

### 1d. `server/routers/moderator.py` — new file

All routes `Depends(get_moderator_user)`. Endpoints:

```
GET    /api/v1/moderator/stats
GET    /api/v1/moderator/users                       ?search=&role=&major_id=
PUT    /api/v1/moderator/users/{user_id}             ModeratorUserUpdate
DELETE /api/v1/moderator/users/{user_id}

GET    /api/v1/moderator/lecturers                   list + course_count
POST   /api/v1/moderator/lecturers                   LecturerCreate
PUT    /api/v1/moderator/lecturers/{id}              LecturerUpdate
DELETE /api/v1/moderator/lecturers/{id}
GET    /api/v1/moderator/lecturers/{id}/courses
POST   /api/v1/moderator/lecturers/{id}/courses/{cid}
DELETE /api/v1/moderator/lecturers/{id}/courses/{cid}

POST   /api/v1/moderator/courses                     CourseCreate
PUT    /api/v1/moderator/courses/{id}                CourseUpdate
DELETE /api/v1/moderator/courses/{id}
GET    /api/v1/moderator/courses/{id}/lecturers
```

**Safety rules**
- Role/user writes: a non-`ADMIN` moderator may not grant/modify the `ADMIN` role nor
  delete an `ADMIN`; nobody may delete themselves.
- Destructive deletes (user / course / lecturer) commit inside `try/except IntegrityError`
  → `409` when the row is still referenced by materials/requests. Junction rows are removed
  first.

### 1e. `server/main.py` — mount router

Add `moderator` to the existing `from routers import ...` line and
`app.include_router(moderator.router)`.

---

## Phase 2 — Frontend Route & Shell

### 2a. `src/shared/components/routing/ProtectedRoute.tsx`

`requiredRole?: Role` → `requiredRoles?: Role[]`:

```tsx
if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
}
```

### 2b. `src/app/router/index.tsx`

- Update the existing `/admin` element to `requiredRoles={["ADMIN"]}`.
- Add lazy imports (`@/app/layouts/ModeratorShell`, `@/features/moderator/pages/*`) and a
  `/moderator` tree guarded by `requiredRoles={["ADMIN","MODERATOR"]}` with children
  `index → ModeratorHome`, `users`, `lecturers`, `courses`.

### 2c. `src/app/layouts/ModeratorShell.tsx` — new (mirror `AdminShell.tsx`)

Diffs vs AdminShell: amber badge (`text-amber-400`/`border-amber-500/30`); localStorage key
`moderator_sidebar_collapsed`; `id="moderator-main-content"`; "Directory" section label; no
"coming soon" block. Nav: Overview `/moderator`, Users, Lecturers, Courses.

### 2d. `src/app/layouts/AppShell.tsx`

Show a "Moderator" sidebar link to `/moderator` when
`user.role === "MODERATOR" || user.role === "ADMIN"` (mirrors the existing admin link).

---

## Phase 3 — Service & Hooks

### 3a. `src/features/moderator/api/moderatorService.ts` — new

`api<T>()` wrapper calls; request bodies are camelCase, responses auto-camelCased. Local TS
interfaces (`ModeratorStats`, `ModeratorUser`, `LecturerWithCount`, `CourseInput`) live in
this file to keep scope narrow.

### 3b. `src/features/moderator/hooks/useModerator.ts` — new

TanStack Query keys: `["moderator","stats"]`, `["moderator","users",filters]`,
`["moderator","lecturers"]`, `["moderator","lecturer",id,"courses"]`,
`["moderator","course",id,"lecturers"]`. Mutations invalidate the relevant prefix and toast
via `sonner` (same pattern as `useRequests.ts`).

---

## Phase 4 — Pages (`src/features/moderator/pages/`)

Glass design (`liquid-glass-subtle` cards), Shadcn `Dialog`/`Select`/`Badge`/`DataTable`,
`AdminHome.tsx` as the visual template.

- **ModeratorHome.tsx** — 4 KPI cards from `useModeratorStats()` + quick-link cards.
- **UsersPage.tsx** — `DataTable` (Name, Email, Role badge, Major, XP, Joined); debounced
  search + role/major filters; Edit dialog (name/major/role) and Delete (confirm dialog).
- **LecturersPage.tsx** — two-panel grid: left = lecturer list (course-count chip, create,
  rename, delete); right = assigned courses for the selected lecturer with add/remove.
- **CoursesPage.tsx** — course list with create/edit/delete dialogs (code, name, major,
  year, semester) and an expandable row showing assigned lecturers.

---

## File Map

| File | Change |
|------|--------|
| `server/models.py` | none — reuse existing `CourseLecturer` |
| `server/schemas.py` | Append moderator payloads (camelCase) |
| `server/utils/auth_utils.py` | Append `get_moderator_user` |
| `server/routers/moderator.py` | **New** |
| `server/main.py` | Import + `include_router(moderator.router)` |
| `src/shared/components/routing/ProtectedRoute.tsx` | `requiredRole` → `requiredRoles: Role[]` |
| `src/app/router/index.tsx` | Add `/moderator` tree; update admin call site |
| `src/app/layouts/ModeratorShell.tsx` | **New** (mirror of `AdminShell.tsx`) |
| `src/app/layouts/AppShell.tsx` | Add Moderator sidebar link (role-gated) |
| `src/features/moderator/api/moderatorService.ts` | **New** |
| `src/features/moderator/hooks/useModerator.ts` | **New** |
| `src/features/moderator/pages/ModeratorHome.tsx` | **New** |
| `src/features/moderator/pages/UsersPage.tsx` | **New** |
| `src/features/moderator/pages/LecturersPage.tsx` | **New** |
| `src/features/moderator/pages/CoursesPage.tsx` | **New** |

---

## Verification

1. **Role gate:** STUDENT → `/moderator` redirects to `/`; MODERATOR and ADMIN load.
2. **403 guard:** `/api/v1/moderator/stats` with a STUDENT token → `403`.
3. **Stats:** four integer fields returned.
4. **User CRUD:** edit a user's role/major; delete (expect `409` if the user owns data).
5. **Lecturer flow:** create lecturer → assign course → unassign → delete.
6. **Course CRUD:** create → edit → delete (expect `409` if it has materials/requests).
7. **No regression:** `/admin` still ADMIN-only; `CatalogManager` assignment still works.
8. **Type/lint:** `npx tsc --noEmit` and `npm run lint` clean.

> Note: `seed.py` creates only STUDENT users. To test, manually set a user's `role` to
> `MODERATOR`/`ADMIN` in the DB.
</content>
</invoke>
