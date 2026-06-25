---
name: frontend-structure
description: Feature-first src/ layout adopted May 2026 — where to find and add code
metadata: 
  node_type: memory
  type: project
  originSessionId: ca6adaa5-a079-4688-95ad-a57cbd838d46
---

Refactored to feature-first on 2026-05-25. Build and tests pass.

**Why:** Moved from type-first (hooks/, services/, components/pages/) to colocation by domain.

**Key rules to apply:**
- New feature code → `src/features/<feature>/` (api/, components/, hooks/, pages/)
- Cross-feature utilities → `src/lib/` (shadcn uses `@/lib/utils` — do not move)
- shadcn/ui components → `src/components/ui/` (CLI target — do not move)
- App bootstrap/layouts/router → `src/app/`
- Cross-feature hooks & error components → `src/shared/`

**Final structure:**
```
src/
├── app/layouts/         AppShell, AdminShell, CourseShell, FileShell
├── app/router/          index.tsx  (was lib/router.tsx)
├── features/
│   ├── auth/            api/ context/ components/ hooks/ pages/
│   ├── dashboard/       api/ components/ hooks/ pages/
│   ├── courses/         api/ hooks/ pages/
│   ├── files/           api/ components/ hooks/ pages/
│   ├── admin/           api/ components/ hooks/ pages/
│   ├── gamification/    api/ components/ hooks/
│   ├── assistant/       api/ components/
│   ├── profile/         pages/
│   └── settings/        pages/
├── shared/
│   ├── components/      ErrorBoundary, NotFound, MouseGlow, errors/, routing/
│   └── hooks/           useTheme, use-mobile, useReducedMotion
├── components/ui/       shadcn primitives (STAYS — CLI target)
├── lib/                 apiClient, utils, constants, etc. (STAYS — shadcn dep)
├── types/domain.ts
└── test/
```
