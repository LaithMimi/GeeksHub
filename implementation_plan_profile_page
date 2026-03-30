# Settings Page Audit & User Profile Page Plan (v2)

## Part 1: Settings Page Audit

*(Unchanged from v1 — see previous artifact for full scoring details)*

**Score: 10/20 — Acceptable (significant work needed)**

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1 | Zero ARIA labels, no form labels |
| 2 | Performance | 3 | Clean lazy-loading, unoptimized effects |
| 3 | Responsive Design | 2 | Theme grid breaks on mobile |
| 4 | Theming | 2 | Hard-coded `text-white` everywhere |
| 5 | Anti-Patterns | 2 | Uniform card grid, inline hex colors |
| **Total** | | **10/20** | **Acceptable** |

---

## Part 2: Backend Shape Verification

### What the backend `User` model actually returns

From [server/models.py](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/server/models.py) (lines 10-23):

```python
class User(SQLModel, table=True):
    id: UUID
    auth0_id: str          # Auth0 sub
    email: str             
    name: str              
    role: str              # "STUDENT" | "ADMIN"
    major_id: Optional[UUID]
    total_points: int      # defaults 0
    created_at: datetime   # UTC timestamp
```

The `/api/v1/signin` endpoint at [auth.py:153](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/server/routers/auth.py#L153) returns `{"user": user}` — the full `User` model.

The `/api/v1/me` endpoint at [auth.py:185-190](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/server/routers/auth.py#L185-L190) returns the same `User` model via `response_model=User`.

After `apiClient.ts` snake_case → camelCase conversion, the frontend receives:

| Backend field | Frontend field | Available? |
|---|---|---|
| `id` | `id` | ✅ |
| `auth0_id` | `auth0Id` | ✅ (not used in frontend) |
| `email` | `email` | ✅ |
| `name` | `name` | ✅ (mapped to `displayName` in AuthContext) |
| `role` | `role` | ✅ |
| `major_id` | `majorId` | ✅ |
| `total_points` | `totalPoints` | ✅ |
| `created_at` | `createdAt` | ✅ |
| `bio` | — | ❌ **Does not exist** |
| `avatar_url` | — | ❌ **Does not exist** |
| `university` | — | ❌ **Does not exist** |
| `last_login_at` | — | ❌ **Does not exist** |

### What additional data is available via other endpoints

| Endpoint | Data | Service |
|---|---|---|
| `GET /api/v1/me/reputation` | `totalPoints`, `badge`, `transactions[]` | [reputationService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/reputationService.ts) |
| `GET /api/v1/me/activity/summary` | `totalPoints`, `badgeTier`, `recentTransactions[]`, `courseActivity[]` | [learningPathService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/learningPathService.ts) |
| `GET /api/v1/me/requests` | User's file upload requests with status | [requestService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/requestService.ts) |
| `GET /api/v1/me/recent-files` | User's recently viewed files | [fileService.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/services/fileService.ts) |

### Conclusion

**The profile page must be built using ONLY what the backend returns today.** No `bio`, `university`, `avatarUrl`, or `lastLoginAt` fields exist. Rendering empty inputs for these would be misleading — users would fill them in and they'd vanish on refresh.

---

## Part 3: Revised Implementation Plan

### Settings Persistence — Decision

> [!IMPORTANT]
> **No localStorage interim.** Settings remain volatile React state until `PATCH /api/me/settings` is implemented on the backend. The current volatile state fails loudly (users notice and report). localStorage would mask the missing backend and create silent cross-device divergence.

The Settings page header will change from the permanent "Saved" indicator to clearly communicate that settings are session-only. This is honest UX.

---

### User Profile Page — Scoped to Backend Reality

#### [NEW] `src/components/pages/UserProfile.tsx`

A profile page built **only** from data the backend returns today:

**Section 1: Profile Header** *(from `GET /api/v1/me` + AuthContext)*
- Avatar with initials (derived from `name`, same as sidebar)
- Display name (`name`)
- Email (`email`)
- Role badge (`role` — "Student" or "Admin")
- Major affiliation (resolved from `majorId` via the existing `useMajors()` catalog hook)
- Member since (from `createdAt` — the backend returns this)

**Section 2: Reputation & Activity** *(from `GET /api/v1/me/reputation` + `GET /api/v1/me/activity/summary`)*
- Total points + badge tier with visual progress bar
- Recent points transactions (last 5)
- Course activity summary (courses explored/completed)

**Section 3: My Uploads** *(from `GET /api/v1/me/requests`)*
- Recent upload requests with status (pending/approved/rejected)
- Quick stats: total uploads, approved count, rejection rate

**Section 4: Account Actions**
- Change password (links to `POST /api/v1/forgot-password` — triggers Auth0 reset email, already implemented)
- Sign out (already implemented)

**NOT included (no backend support):**
- ~~Bio editing~~ — no field in DB
- ~~Avatar upload~~ — no field in DB
- ~~University field~~ — no field in DB
- ~~Active sessions~~ — no endpoint
- ~~2FA~~ — Auth0 handles this, no frontend control
- ~~Delete account~~ — no endpoint
- ~~Billing/subscription~~ — no endpoint

> [!NOTE]
> **Future-proofing**: The component structure will be modular so when `bio`, `avatar_url` columns are added to the backend, they can be wired in without restructuring the page. But we won't render phantom fields.

---

### Router Changes

#### [MODIFY] [router.tsx](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/lib/router.tsx)
- Add lazy import: `const UserProfile = Loadable(React.lazy(() => import("@/components/pages/UserProfile")));`
- Add route under AppShell children: `{ path: "profile", element: <UserProfile /> }`

---

### Sidebar Navigation Update

#### [MODIFY] [AppShell.tsx](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/components/layout/AppShell.tsx)
- Add "Profile" link to the user dropdown menu (alongside existing "Settings")
- The sidebar avatar button already opens a dropdown — add a `<DropdownMenuItem>` with a `<Link to="/profile">` entry

---

### Settings Page Fixes

#### [MODIFY] [Settings.tsx](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/components/pages/Settings.tsx)
1. **Fix** accessibility: add `aria-label` to all interactive elements, `id`/`htmlFor` on switches, heading hierarchy `h3`→`h2`
2. **Fix** language selector to show full name instead of code ("en" → "English")
3. **Fix** always-visible "Saved" indicator → change to "Session only — settings reset on reload" disclaimer
4. **Add** responsive breakpoints for theme grid (`grid-cols-1 sm:grid-cols-3`)
5. **Add** focus-visible ring to theme buttons
6. **Remove** "Active Requests" section (it's just a link to Uploads)
7. **Condense** "About GeeksHub" to a single footer line

---

### Domain Types — Minimal Update

#### [MODIFY] [domain.ts](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/types/domain.ts)
- Add `totalPoints?: number` and `createdAt?: string` to the `User` interface — these fields **exist in the backend** but aren't currently captured by the frontend's `AuthContext.signIn()` handler

**NOT adding**: `bio`, `avatarUrl`, `university`, `lastLoginAt` — these don't exist in the backend DB and adding them to types would imply they work.

---

### AuthContext Fix

#### [MODIFY] [AuthContext.tsx](file:///c:/Users/Lenovo/Documents/Programming%20projects/GeeksHub/GeeksHub/src/context/AuthContext.tsx)
- Capture `totalPoints` and `createdAt` from the sign-in response (backend already returns them, frontend currently ignores them)
- This data will be used by the Profile page header

---

## Open Questions

> [!IMPORTANT]
> **Profile page scope approved?** The plan above builds Sections 1-4 (header, reputation, uploads, account actions) using only existing backend data. No phantom fields. Good to proceed?

> [!IMPORTANT]
> **"Active Requests" removal** — I'm removing this section from Settings (it's a navigational link, not a setting). The profile page's "My Uploads" section will serve this purpose better. Confirm?

> [!IMPORTANT]
> **Settings "Saved" indicator** — I'll replace the always-visible green "Saved" checkmark with a subtle disclaimer that settings are session-only. This is honest until the backend endpoint exists. OK?

---

## Verification Plan

### Automated Tests
- `npx tsc --noEmit` — verify no TypeScript errors after changes
- `npm run build` — verify production build succeeds
- Browser visual verification on desktop and mobile viewport

### Manual Verification
- Navigate to `/profile` — verify it renders with real user data (name, email, role, major, points, createdAt)
- Verify no empty phantom fields
- Test "Change Password" triggers the Auth0 reset email flow
- Test theme switching on the profile page
- Test sidebar Profile link in both expanded and collapsed states
- Test keyboard navigation through all new interactive elements
