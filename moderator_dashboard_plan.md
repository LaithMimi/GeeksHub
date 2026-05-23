# Moderator Dashboard — Implementation Plan

## Context

GeeksHub has an `ADMIN`-gated section at `/admin` for file-request moderation. The `MODERATOR` role already exists in `src/types/domain.ts` (`Role = "STUDENT" | "ADMIN" | "MODERATOR"`) but has no dedicated UI. This plan adds a `/moderator` route and its own shell that lets `MODERATOR` (and `ADMIN`) users manage the platform directory: users, lecturers, and courses — including a new many-to-many assignment between lecturers and courses.

---

## Architecture at a Glance

```
Browser /moderator
  └─ ProtectedRoute (requiredRoles: ["ADMIN","MODERATOR"])
       └─ ModeratorShell (new, mirrors AdminShell)
            ├─ ModeratorHome
            ├─ UsersPage
            ├─ LecturersPage   ──→ POST/DELETE /api/v1/moderator/lecturers/{id}/courses/{id}
            └─ CoursesPage

Backend /api/v1/moderator/*
  ├─ get_moderator_user dep (new, in auth_utils.py)
  ├─ users CRUD
  ├─ lecturers CRUD
  ├─ courses CRUD
  └─ LecturerCourse junction (new table in models.py)
```

---

## Phase 1 — Backend

### 1a. `server/models.py` — add `LecturerCourse`

After the `Lecturer` class (line 55), insert:

```python
class LecturerCourse(SQLModel, table=True):
    __tablename__ = "lecturer_courses"
    lecturer_id: UUID = Field(foreign_key="lecturers.id", primary_key=True)
    course_id: UUID = Field(foreign_key="courses.id", primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

SQLModel's `init_db()` (called in `lifespan`) will auto-create this table on startup via `SQLModel.metadata.create_all(engine)`.

### 1b. `server/schemas.py` — add moderator schemas

Append to the existing file:

```python
class ModeratorUserUpdate(BaseModel):
    name: Optional[str] = None
    major_id: Optional[UUID] = None
    role: Optional[str] = None          # "STUDENT" | "MODERATOR" | "ADMIN"

class LecturerCreate(BaseModel):
    name: str

class LecturerUpdate(BaseModel):
    name: str

class CourseCreate(BaseModel):
    code: str
    name: str
    major_id: UUID
    year_id: int
    semester: int

class CourseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    major_id: Optional[UUID] = None
    year_id: Optional[int] = None
    semester: Optional[int] = None
```

Use `ModeratorUserUpdate` (not `UserUpdate`) to avoid collision with any future auth schema.

### 1c. `server/utils/auth_utils.py` — add `get_moderator_user`

After `get_admin_user` (line 73), append:

```python
def get_moderator_user(current_user: User = Depends(get_verified_user)) -> User:
    if current_user.role not in ("ADMIN", "MODERATOR"):
        raise HTTPException(status_code=403, detail="Moderator privileges required.")
    return current_user
```

### 1d. `server/routers/moderator.py` — new file

All routes `Depends(get_moderator_user)`.

**Stats:**
```
GET  /api/v1/moderator/stats
     → { total_users, total_lecturers, total_courses, new_users_this_week }
```

**Users (CRUD):**
```
GET    /api/v1/moderator/users              # ?search=&role=&major_id=
GET    /api/v1/moderator/users/{user_id}
PUT    /api/v1/moderator/users/{user_id}    # ModeratorUserUpdate payload
DELETE /api/v1/moderator/users/{user_id}
```

**Lecturers (CRUD):**
```
GET    /api/v1/moderator/lecturers          # returns name + course_count via subquery
POST   /api/v1/moderator/lecturers          # LecturerCreate
PUT    /api/v1/moderator/lecturers/{id}     # LecturerUpdate
DELETE /api/v1/moderator/lecturers/{id}     # cascade: delete LecturerCourse rows first
```

**Lecturer-Course assignment:**
```
GET    /api/v1/moderator/lecturers/{id}/courses            # courses assigned
POST   /api/v1/moderator/lecturers/{id}/courses/{cid}      # assign (upsert-safe)
DELETE /api/v1/moderator/lecturers/{id}/courses/{cid}      # unassign
GET    /api/v1/moderator/courses/{id}/lecturers            # lecturers for course
```

**Courses (write-only; reads already in `catalog.py`):**
```
POST   /api/v1/moderator/courses            # CourseCreate
PUT    /api/v1/moderator/courses/{id}       # CourseUpdate
DELETE /api/v1/moderator/courses/{id}       # cascade: delete LecturerCourse rows first
```

For `new_users_this_week`, use:
```python
week_start = datetime.now(timezone.utc) - timedelta(days=7)
session.exec(select(func.count(User.id)).where(User.created_at >= week_start)).one()
```

For `course_count` on lecturers:
```python
from sqlalchemy import func
count_sub = (
    select(LecturerCourse.lecturer_id, func.count().label("course_count"))
    .group_by(LecturerCourse.lecturer_id)
    .subquery()
)
```

### 1e. `server/main.py` — mount router

```python
from routers import auth, catalog, files, admin, gamification, activity, viewer, ai, tasks, moderator

app.include_router(moderator.router)
```

---

## Phase 2 — Frontend Route & Shell

### 2a. `src/components/routing/ProtectedRoute.tsx`

Change interface from `requiredRole?: Role` → `requiredRoles?: Role[]` and update the guard:

```tsx
if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
}
```

Update the existing `/admin` call site in `router.tsx`:
```tsx
<ProtectedRoute requiredRoles={["ADMIN"]} />
```

### 2b. `src/lib/router.tsx` — add `/moderator` tree

Following the exact `AdminShell` pattern (lazy import + `Loadable`):

```tsx
const ModeratorShell = Loadable(React.lazy(() => import("@/components/layout/ModeratorShell")));
const ModeratorHome = Loadable(React.lazy(() => import("@/components/pages/moderator/ModeratorHome")));
const UsersPage = Loadable(React.lazy(() => import("@/components/pages/moderator/UsersPage")));
const LecturersPage = Loadable(React.lazy(() => import("@/components/pages/moderator/LecturersPage")));
const CoursesPage = Loadable(React.lazy(() => import("@/components/pages/moderator/CoursesPage")));

// In the router array, after the /admin block:
{
    path: "/moderator",
    element: <ProtectedRoute requiredRoles={["ADMIN", "MODERATOR"]} />,
    errorElement: <RouteError name="Moderator Auth" />,
    children: [{
        path: "",
        element: <ModeratorShell />,
        errorElement: <RouteError name="Moderator" />,
        children: [
            { index: true,         element: <ModeratorHome /> },
            { path: "users",       element: <UsersPage /> },
            { path: "lecturers",   element: <LecturersPage /> },
            { path: "courses",     element: <CoursesPage /> },
        ],
    }],
}
```

### 2c. `src/components/layout/ModeratorShell.tsx` — new file

Mirror `AdminShell.tsx` (394 lines) with these diffs:
- Badge: `text-amber-400` instead of `text-rose-500` (amber = moderator, red = admin)
- localStorage key: `"moderator_sidebar_collapsed"`
- `id="moderator-main-content"` on the `<main>`
- Nav items:
  ```tsx
  const modNavItems = [
      { label: "Overview",  icon: LayoutDashboard, href: "/moderator" },
      { label: "Users",     icon: Users,            href: "/moderator/users" },
      { label: "Lecturers", icon: GraduationCap,    href: "/moderator/lecturers" },
      { label: "Courses",   icon: BookOpen,          href: "/moderator/courses" },
  ];
  ```
- `isActive` logic: `path === "/moderator"` for exact, `startsWith(path)` for children
- breadcrumb label map:
  ```tsx
  const modLabelMap = { moderator: "Moderator", users: "Users", lecturers: "Lecturers", courses: "Courses" };
  ```
- No `comingSoonItems` section
- Section label: "Directory" instead of "Moderation"

---

## Phase 3 — Service & Hooks

### 3a. `src/services/moderatorService.ts` — new file

Uses `api<T>()` from `@/lib/apiClient`. The client auto-converts snake_case → camelCase responses.

```ts
// Stats
export const fetchModeratorStats = () => api<ModeratorStats>("/moderator/stats");

// Users
export const listModeratorUsers = (filters?: UserFilters) => api<ModeratorUser[]>(`/moderator/users?${toParams(filters)}`);
export const getModeratorUser = (id: string) => api<ModeratorUser>(`/moderator/users/${id}`);
export const updateModeratorUser = (id: string, data: UserUpdate) =>
    api<ModeratorUser>(`/moderator/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteModeratorUser = (id: string) =>
    api<void>(`/moderator/users/${id}`, { method: "DELETE" });

// Lecturers
export const listModeratorLecturers = () => api<LecturerWithCount[]>("/moderator/lecturers");
export const createModeratorLecturer = (data: { name: string }) =>
    api<Lecturer>("/moderator/lecturers", { method: "POST", body: JSON.stringify(data) });
export const updateModeratorLecturer = (id: string, data: { name: string }) =>
    api<Lecturer>(`/moderator/lecturers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteModeratorLecturer = (id: string) =>
    api<void>(`/moderator/lecturers/${id}`, { method: "DELETE" });

// Lecturer-course assignment
export const listLecturerCourses = (lecturerId: string) =>
    api<Course[]>(`/moderator/lecturers/${lecturerId}/courses`);
export const assignLecturerCourse = (lecturerId: string, courseId: string) =>
    api<void>(`/moderator/lecturers/${lecturerId}/courses/${courseId}`, { method: "POST" });
export const unassignLecturerCourse = (lecturerId: string, courseId: string) =>
    api<void>(`/moderator/lecturers/${lecturerId}/courses/${courseId}`, { method: "DELETE" });
export const listCourseLecturers = (courseId: string) =>
    api<Lecturer[]>(`/moderator/courses/${courseId}/lecturers`);

// Courses
export const createModeratorCourse = (data: CourseCreate) =>
    api<Course>("/moderator/courses", { method: "POST", body: JSON.stringify(data) });
export const updateModeratorCourse = (id: string, data: Partial<CourseCreate>) =>
    api<Course>(`/moderator/courses/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteModeratorCourse = (id: string) =>
    api<void>(`/moderator/courses/${id}`, { method: "DELETE" });
```

Local TypeScript types to add at top of file (not in `domain.ts` to keep scope narrow):
```ts
interface ModeratorStats { totalUsers: number; totalLecturers: number; totalCourses: number; newUsersThisWeek: number; }
interface ModeratorUser { id: string; name: string; email: string; role: Role; majorId?: string; totalPoints: number; createdAt: string; }
interface LecturerWithCount { id: string; name: string; courseCount: number; }
interface UserFilters { search?: string; role?: string; majorId?: string; }
interface UserUpdate { name?: string; majorId?: string; role?: string; }
interface CourseCreate { code: string; name: string; majorId: string; yearId: number; semester: number; }
```

### 3b. `src/hooks/useModerator.ts` — new file

```ts
// Query keys
["moderator", "stats"]
["moderator", "users", filters]
["moderator", "lecturers"]
["moderator", "lecturer", id, "courses"]
["moderator", "course", id, "lecturers"]
```

Mutations use `queryClient.invalidateQueries` on the relevant key prefix. Toast success/error via `sonner` (same pattern as `useRequests.ts`).

---

## Phase 4 — Pages

All in `src/components/pages/moderator/`. Glass design: `bg-transparent border-white/[0.06]` on cards, Shadcn `Dialog`, `Table`, `Badge`. Follow `AdminHome.tsx` as template.

### `ModeratorHome.tsx`
- 4 KPI cards using `useModeratorStats()`: Total Users, Total Lecturers, Total Courses, New Users This Week
- Quick-link cards to each section (same Card + Button pattern as `AdminHome.tsx`)

### `UsersPage.tsx`
- `useModeratorUsers(filters)` → DataTable with columns: Name, Email, Role badge, Major, XP Points, Joined
- Toolbar: text search (debounced), role filter `Select`, major filter `Select` (populated from `useCatalog`)
- Row actions: **Edit** (Dialog: name input, major select, role select) → `useUpdateModeratorUser` mutation; **Delete** (AlertDialog) → `useDeleteModeratorUser`
- Role badge variants: STUDENT=blue, MODERATOR=amber, ADMIN=emerald

### `LecturersPage.tsx`
Two-panel layout (CSS grid: `grid-cols-[300px_1fr]`):
- **Left**: List of lecturer cards (name + course-count chip). "New Lecturer" button at top. Actions: Edit (inline rename with input + save), Delete (confirm dialog, disabled if has materials via 409 response).
- **Right** (when lecturer selected): Assigned courses list. Combobox (Shadcn `Command`) filters all courses, "Add" assigns via mutation. Per-row "Unassign" button.

### `CoursesPage.tsx`
- `useCatalog().courses` for read (existing `GET /api/v1/courses`), moderator endpoints for write
- DataTable: Code, Name, Major, Year, Semester, Lecturer Count (from `listCourseLecturers`)
- "New Course" button → Dialog with code, name, major select, year select, semester select
- Row: Edit (Dialog pre-filled), Delete (AlertDialog), click row → expandable showing assigned lecturers

---

## File Map

| File | Change |
|------|--------|
| `server/models.py` | Add `LecturerCourse` after line 55 |
| `server/schemas.py` | Append moderator schemas |
| `server/utils/auth_utils.py` | Append `get_moderator_user` after line 73 |
| `server/routers/moderator.py` | **New** |
| `server/main.py` | Import + `include_router(moderator.router)` |
| `src/components/routing/ProtectedRoute.tsx` | `requiredRole` → `requiredRoles: Role[]` |
| `src/lib/router.tsx` | Add moderator lazy imports + `/moderator` route tree; update admin call site |
| `src/components/layout/ModeratorShell.tsx` | **New** (mirror of `AdminShell.tsx`) |
| `src/services/moderatorService.ts` | **New** |
| `src/hooks/useModerator.ts` | **New** |
| `src/components/pages/moderator/ModeratorHome.tsx` | **New** |
| `src/components/pages/moderator/UsersPage.tsx` | **New** |
| `src/components/pages/moderator/LecturersPage.tsx` | **New** |
| `src/components/pages/moderator/CoursesPage.tsx` | **New** |

---

## Verification

1. **DB:** Restart server → confirm `lecturer_courses` table appears in Neon console (SQLModel auto-creates on `init_db()`).
2. **Role gate:** Log in as `STUDENT` → navigate to `/moderator` → should redirect to `/`. Log in as `MODERATOR` → loads. Log in as `ADMIN` → also loads.
3. **403 guard:** `curl GET /api/v1/moderator/stats` with a STUDENT JWT → `403 Moderator privileges required.`
4. **Stats:** `GET /api/v1/moderator/stats` with MODERATOR token → JSON with four integer fields.
5. **User CRUD:** List users → edit a user's role to `MODERATOR` → confirm badge updates → delete the user.
6. **Lecturer-course flow:** Create lecturer → assign course via combobox → verify course appears in right panel → unassign → verify removed.
7. **Course CRUD:** Create course → edit it → delete it → confirm `lecturer_courses` rows cascade away.
8. **No regression:** `/admin` (ADMIN-only) still works; MODERATOR routed to `/` for `/admin` routes.