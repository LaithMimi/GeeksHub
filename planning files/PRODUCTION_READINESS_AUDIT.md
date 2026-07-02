# Production Readiness Audit — GeeksHub

| | |
|---|---|
| **Date** | 2 July 2026 |
| **Auditors (roles)** | Architect / Backend / Frontend / DevOps / SRE / Security / QA |
| **Scope** | Entire repository at working tree (includes the 2026-07-02 bug-fix batch) |
| **Evidence base** | Full backend+frontend code review; **executed** test cycle (43 backend pytest + 36 frontend Vitest, all green — see `GeeksHub_STR_Software_Test_Report.md`); deploy configs; git history |
| **Profile assumed** | SaaS web app, real users, real traffic, real failures |

**Architecture (confirmed):** React 19 SPA (Vite) on Vercel → `vercel.json` rewrite-proxies `/api/v1/*` to FastAPI on Railway (`Dockerfile.backend` + `start.sh`, single uvicorn worker) → Neon Postgres w/ pgvector (SQLModel), Google Cloud Storage (files), Auth0 (identity), Gemini (embeddings + chat). Main flows: signup/signin → browse catalog → upload (quarantined `pending_uploads/`) → admin approve/reject (XP ledger, notifications, audit log, background embedding) → PDF viewer with heartbeat-scored XP → RAG chat.

---

## 1. Executive Verdict

### Production-ready? **Partially.**

The domain logic is in genuinely good shape — auth, RBAC, upload validation, the approval state machine, and the XP ledger are covered by an *executed* test suite with zero open P1 functional defects. What is **not** production-grade is the operational shell around it: nothing runs the tests automatically, the service cannot signal its own failure, observability is `print()`, schema management is manual, and one infrastructure misconfiguration (proxy headers) likely undermines the rate-limiting that the tests validated. These are days of work, not weeks, and none require re-architecture.

### Top 10 blockers

1. **No CI/CD** — 79 passing tests exist; nothing executes them on push (no `.github/`, no pipeline anywhere). (PRA-001)
2. **Health check cannot fail** — returns 200 with the DB down; Railway will never restart a wedged instance. (PRA-002)
3. **Rate limiting likely keyed to the proxy's IP, not the user's** — uvicorn runs without `--proxy-headers`; all slowapi limits + the upload cap may share one bucket for every user behind Vercel/Railway. (PRA-003)
4. **No error tracking, unstructured `print()` logging** — production 500s are invisible. (PRA-004)
5. **No database migrations** — `create_all()` + an ad-hoc `add_column.py`; any non-additive schema change is hand-run SQL against prod. (PRA-005)
6. **GCS-move-before-DB-commit window in approvals** (DEF-011) — a commit failure strands the blob and wedges the request. (PRA-006)
7. **Vercel preview deployments read/write the production backend** — hardcoded prod URL in `vercel.json`. (PRA-007)
8. **`SameSite=None` production cookie** — documented CSRF exposure that the same-origin proxy architecture probably makes unnecessary. (PRA-008)
9. **Fire-and-forget embedding jobs** — a deploy/crash between approve and embed silently produces AI-invisible materials, with no status field and no retry. (PRA-009)
10. **No runbook / restore procedure / rollback drill** — recovery knowledge exists only in heads. (PRA-010)

### Top 10 non-blocking improvements

1. Unify bulk-approve with single-approve side effects (bonus XP, notifications, per-ID errors) — PRA-011.
2. Populate or remove `UserCourseActivity.total_files` (silently wrong progress UI) — PRA-012.
3. Implement or retract the "trash for 3 days" promise (no purge job exists) — PRA-013.
4. Repair `server/seed.py` (mostly commented-out dead code; STP entry criteria depend on it) — PRA-014.
5. Align cookie lifetime (30d "remember me") with Auth0 access-token expiry — PRA-015 (needs tenant context).
6. Validation batch: empty AI message, negative heartbeat seconds, unvalidated FK ids → 500s — PRA-016.
7. Normalize API casing contract (responses mix snake_case and camelCase per router) — PRA-017.
8. Redis-backed rate limiting + cache before scaling past one worker — PRA-018.
9. Restore `server/.env.example`; refresh README (advertises removed DOCX support; mojibake); delete root junk (`errors.txt`, `check_exports.js`, `script.cjs`) — PRA-019.
10. Leaderboard deterministic tie-break; document signout semantics (access JWTs are not revocable; the `/oauth/revoke` call is a no-op for access tokens) — PRA-020.

---

## 2. Findings Table

Severity: Critical / High / Medium / Low. "Confirmed" = verified in code/config; "Possible" = needs more context.

| ID | Category | Severity | Title | Evidence | Why it matters in production | Recommended fix | Blocking? |
|---|---|---|---|---|---|---|---|
| PRA-001 | CI/CD | **Critical** | No CI pipeline runs the test suites | No `.github/` dir; no pipeline config anywhere in `git ls-files`. Suites exist: `server/tests/` (43), `src/**/__tests__` (36) — confirmed | Every behavior verified on 2026-07-02 can silently regress on the next push; tests only run when someone remembers | GitHub Actions: job 1 = `pgvector/pgvector:pg17` service container + `pytest server/tests`; job 2 = `npm ci && npm run test:run && npm run build` | **Yes** |
| PRA-002 | Health/monitoring | **Critical** | Health check returns 200 when the DB is down | `server/main.py:66-72` — catch → `{"status": "online", "database": "disconnected"}` with HTTP 200; `railway.toml:16` uses it as `healthcheckPath` — confirmed | Railway's restart-on-unhealthy never fires; a wedged instance serves errors indefinitely while reporting healthy | Return 503 when the `SELECT 1` fails (one line) | **Yes** |
| PRA-003 | Security/infra | **High** | Rate limits likely keyed to proxy IP, not client IP | `start.sh:18` runs uvicorn **without** `--proxy-headers`; all limiters use `get_remote_address` (`auth.py:16`, `ai.py:19`); traffic arrives via Vercel rewrite → Railway edge — confirmed config, effect **possible** (needs one prod curl to verify) | Either all users share one bucket (10 signin/min *total* → collective lockout = availability incident) or limits are per-edge-node (brute-force protection weaker than tested) | Add `--proxy-headers --forwarded-allow-ips='*'` (or Railway's proxy CIDR) to `start.sh`; verify `request.client.host` shows real client IPs; re-test AUTH-007 against staging | **Yes** |
| PRA-004 | Observability | **High** | No error tracking; logging is `print()` | `print(f"...")` throughout `server/routers/*.py`, `utils/*.py` (e.g. `admin.py:144`, `auth.py:105`, `files.py:42`); no Sentry/logging config anywhere — confirmed | 500s and swallowed GCS failures are invisible; incident debugging = grepping unstructured stdout | Python `logging` w/ JSON formatter + request-ID middleware; Sentry SDK in FastAPI and React | **Yes** |
| PRA-005 | Database | **High** | No migration tool | `database.py:27-28` (`create_all`); ad-hoc `server/add_column.py` proves manual schema surgery already happens; no alembic in repo — confirmed | `create_all` is additive-only: renames/drops/index changes on prod Neon are hand-run SQL with no history, no rollback, no drift detection | Adopt Alembic now (baseline autogenerate), before code and prod schema drift further | **Yes** |
| PRA-006 | Data integrity | **High** | GCS move precedes the DB commit in approvals (DEF-011) | `admin.py` `approve_file`: GCS rename ~line 127-145, single `session.commit()` ~line 222; same shape in `bulk_approve` — confirmed | If the commit fails, the blob left `pending_uploads/` but the request stays `pending` with a stale `file_url` → preview broken, re-approve fails the rename, request permanently wedged | Compensating rename-back in an except around the commit (or move blob after commit) | **Yes** |
| PRA-007 | Deployment | **High** | Vercel previews hit the production backend | `vercel.json:5` hardcodes `https://geekshub-production.up.railway.app` — confirmed | Every preview build of a feature branch reads/writes prod data — test uploads, XP mutations, notifications land in production | Env-scoped rewrite destination or a staging Railway service for previews | **Yes** |
| PRA-008 | Security | **High** | `SameSite=None` cookie in production (DEF-002) | `auth.py:154`; STR AUTH-009 executed and confirmed the header. New audit insight: `vercel.json` proxies `/api/*` server-side, so browser traffic is **same-origin** — confirmed architecture, `Lax` compatibility **possible** (needs one staging test) | CSRF exposure on every state-changing endpoint, apparently for no architectural reason | Deploy with `samesite="lax"`, test signin + an authenticated POST through the proxy; keep `None` only if direct cross-origin API access is a real requirement | **Yes** (decision + 1 test) |
| PRA-009 | Reliability | **High** | Embedding jobs are fire-and-forget with no status | `admin.py:224-227` `BackgroundTasks.add_task(embed_single...)`; failure path is `print` only (`admin.py:41-43`); no status column on `Material` — confirmed | Deploy/crash/Gemini-quota between approve and embed → material live but invisible to the AI assistant, silently, forever | Add `Material.embedding_status` (pending/done/failed) + a backfill/retry script; longer term a real queue | No (High — Phase 2 with the backfill script as mitigation) |
| PRA-010 | Runbooks | **High** | No runbook, restore procedure, or rollback drill | No ops docs in repo (planning files are design/test docs); Neon PITR capability **possible — needs more context** (plan tier unverified) | First real incident is improvised: nobody has restored the DB, replayed a deploy, or rotated the Auth0/GCP secrets from a written procedure | 1-page RUNBOOK.md: deploy, rollback (Railway redeploy previous image), DB restore, secret rotation, known failure modes | **Yes** (minimal version) |
| PRA-011 | Correctness | Medium | Bulk approve diverges from single approve (DEF-013) | `admin.py:284-402`: no `requested_upload_bonus`, no uploader `UserNotification`, silent skip of non-pending IDs (count-only response) — confirmed | Users get different XP/notifications depending on which button an admin clicked; skipped IDs are indistinguishable from approved ones in the response | Extract one shared approval function; return per-ID results | No |
| PRA-012 | Correctness | Medium | `UserCourseActivity.total_files` never populated (DEF-003) | `models.py:158` defines it; only `files_completed` is ever written (`viewer.py`); no writer of `total_files` in repo — confirmed | Any "X of Y files" progress UI silently shows Y=0/wrong — a data-accuracy bug no crash will ever surface | Maintain it on material approve/delete, or drop the column and the UI reading it | No |
| PRA-013 | Reliability | Medium | "Trash for 3 days" is promised but not implemented | `admin.py:277` response text; no purge job/cron anywhere in repo — confirmed | `trash_bin/` grows unboundedly (storage cost) and the user-facing retention promise is false | Scheduled purge (Railway cron / Cloud Scheduler) or reword the message | No |
| PRA-014 | Environments | Medium | `seed.py` is mostly dead code | `server/seed.py:15-23+` — Major/Course creation commented out — confirmed | STP §5 entry criteria and any fresh environment (staging!) depend on seedable data; today a new env starts empty | Restore a minimal idempotent seed (1 major, courses, types, lecturer, one user per role) | No |
| PRA-015 | Auth | Medium | Cookie lifetime vs token expiry mismatch | `auth.py:139-143`: cookie `max_age` = 30 days (remember-me), but it stores an Auth0 **access token** whose exp is tenant-configured (typically 24h) — **possible, needs tenant config** | "Remember me" silently breaks after token expiry: cookie present, every request 401s until re-login — confusing UX, support tickets | Verify tenant token TTL; either match cookie lifespan to token exp or implement refresh-token rotation | No |
| PRA-016 | Validation | Medium | Input-validation batch (DEF-012/015) | Confirmed: `schemas.py:129` AI `message` no `min_length` (empty msg reaches endpoint — STR AI-002 **Fail**); `schemas.py:118` `active_seconds_to_add` accepts negatives; `files.py` upload doesn't check course/lecturer/type ids exist → FK error 500; `admin.py:118` allows rejected→approved skipping undo | Wasted LLM spend; ugly 500s instead of 4xx; state-machine bypass via raw API | `Field(min_length=1)`, `Field(ge=0)`, existence checks, `!= "pending"` guard | No |
| PRA-017 | API design | Medium | Inconsistent response casing across routers | Confirmed: `files.py:84-89` hand-adds camelCase duplicates onto snake_case dumps; `directory.py` returns snake_case; request bodies camelCase by design (`schemas.py:165` comment); frontend converts per-service | Every new endpoint is a guess; contract bugs like the fixed `type_id` label bug recur; no OpenAPI-driven client possible | Pick one convention (pydantic `alias_generator=to_camel` + `populate_by_name`) and migrate router-by-router | No |
| PRA-018 | Scalability | Medium | Single-worker in-memory state | `start.sh:18` (no `--workers`); three separate `Limiter` instances (`main.py:13`, `auth.py:16`, `ai.py:19`); AI doc cache `ai.py:40` TTLCache — confirmed | Correct today *only because* there's one process; adding workers/instances silently multiplies rate limits and fragments the Gemini cache | Document the constraint; move limiter storage + cache to Redis before scaling | No |
| PRA-019 | Docs/hygiene | Low | Stale docs, missing env template, root junk | Confirmed: README advertises DOCX upload (removed 2026-07-02) + UTF-8 mojibake (`â€”`); `server/.env.example` deleted while `planning files/DOCKER_SETUP.md:55` still references it; `errors.txt`, `check_exports.js`, `script.cjs` at root; Python drift: `server/Dockerfile` 3.11 vs `Dockerfile.backend` 3.12 vs local 3.13 | New-contributor onboarding breaks; stale README misleads users about supported formats; version drift breeds "works in one image" bugs | Restore `.env.example` (`git checkout HEAD -- server/.env.example`), fix README, delete junk, pin one Python version | No |
| PRA-020 | Auth | Low | Signout does not (and cannot) revoke the access token | `auth.py:163-183` POSTs the **access token** to `/oauth/revoke` — Auth0 revokes refresh tokens only; JWT stays valid until exp. Cookie deletion is the real logout — confirmed semantics | A stolen token survives "logout" until expiry; the revoke call gives false comfort | Keep short token TTLs; remove or comment the no-op revoke; document the model | No |
| PRA-021 | Security | Low | Registration failure returns 400 for server-side faults | `auth.py:99-106`: any exception (incl. Auth0 outage) → 400 "Registration failed" | 5xx-class outages masquerade as user errors — breaks alerting and confuses users during an Auth0 incident | Distinguish upstream failures (503) from bad input (400) | No |

**Explicitly verified NOT issues** (worth recording so they aren't re-litigated): secrets are not tracked in git (`.gitignore` + `.dockerignore` cover `server/.env`, `gcp_key.json`; verified via `git ls-files`); IDOR ownership checks present in every `/me/*` router (tested); magic-byte upload validation (tested); role self-escalation impossible (tested); XP idempotency per user+file (tested); dependency pinning exact in `requirements.txt`, lockfile present for npm; React Query doesn't retry 4xx (`src/main.tsx:31`); pgvector pool settings are Neon-aware (`database.py:12-19`).

---

## 3. Review Categories

| Category | Grade | Assessment (evidence) |
|---|---|---|
| Code quality & maintainability | **B** | Feature-first frontend (`src/features/*`), thin routers, shared utils. Deductions: tutorial-style comment noise in routers, `print()` everywhere, casing inconsistency (PRA-017), dead code (`seed.py`). |
| Architecture & separation of concerns | **B+** | Clean SPA→proxy→API→managed-services shape; quarantine bucket for uploads; ledger+cache pattern for XP. Deduction: business logic duplicated between single and bulk admin paths (PRA-011). |
| Security | **B** | JWKS-verified JWTs, RBAC tested, magic bytes, rate limits, enumeration closed, security headers (`main.py:29-35`), signed URLs (15min). Open: PRA-003 (proxy keying), PRA-008 (SameSite), PRA-016. |
| Authentication & authorization | **B+** | Three-tier deps (`auth_utils.py:69-78`) verified by RBAC-001..003; email-verification gate now actually reachable (DEF-004 fixed). Open: PRA-015, PRA-020. |
| Secrets & configuration | **A-** | Nothing tracked in git; Railway env-injection with `start.sh` key materialization; `.dockerignore` verified. Deduction: `.env.example` deleted (PRA-019) — config is undocumented. |
| Validation & error handling | **B-** | Pydantic on most payloads, strong upload pipeline. Deductions: PRA-016 batch; GCS failures swallowed with `print` in reject/undo (`admin.py:252-253, 527-528`); PRA-021. |
| Logging & observability | **D** | `print()` only, no levels, no request IDs, no error tracker, no metrics. The weakest area in the repo (PRA-004). |
| Health checks & monitoring | **D+** | Endpoint exists and Railway is wired to it — but it can't fail (PRA-002). No alerting of any kind. |
| Performance & scalability | **B-** | Async GCS upload offload (`files.py:34`), pagination on list endpoints, HNSW index on embeddings (`models.py:206-213`), bounded bulk ops. Constraint: single worker + in-memory state (PRA-018); enriched admin/list queries join eagerly (fine at college scale). |
| DB integrity, migrations, backup, restore | **C-** | Good: FK-everywhere schema, unique constraints backing idempotency (`models.py:129,133`), Neon-aware pooling. Bad: no migrations (PRA-005), restore procedure unverified (PRA-010), `total_files` drift (PRA-012). |
| API design & versioning | **B-** | Consistent `/api/v1` prefix, sane verbs/status codes (409s for conflicts, 429s for limits). Deduction: PRA-017 casing; no OpenAPI contract consumed by the frontend. |
| Test coverage & quality | **B** | 43 backend tests covering 27/27 P1 STD cases incl. negative/abuse paths, executed against real Postgres; 36 frontend tests; `tsc` clean. Gaps in §4. Quality is high (side-effect assertions, not just status codes). |
| CI/CD & deployment safety | **D** | No CI (PRA-001); previews hit prod (PRA-007). Railway config itself is tidy (healthcheck, restart policy, explicit dockerfile). |
| Rollback readiness | **C** | Railway can redeploy a previous image and `create_all` never destroys columns (accidentally rollback-friendly). But: no documented procedure, no drill, and once Alembic lands rollback needs real discipline (PRA-010). |
| Documentation & runbooks | **C** | Strong design/test docs (`planning files/`: ARCHITECTURE, BACKEND flows, STP/STD/STR) and a real README. Zero operational docs; README stale; env template missing (PRA-010, PRA-019). |

---

## 4. Testing Gaps

- **Unit tests missing:** `utils/upload_utils.py` in isolation (covered indirectly via routes), `utils/pptx_utils.py` conversion, `utils/ai_utils.py` chunking/embedding logic, `get_badge_tier` boundaries, frontend `apiClient` error paths and remaining hooks (`useViewerSession`, `useMaterialRequests`).
- **Integration tests missing:** bulk approve/reject mixed batches (ADMIN-006 — explicitly not executed), notification broadcast audience logic (`files.py:298-309` opt-out join), settings PATCH semantics, activity summary aggregation, directory CRUD beyond DIR-001/002, signout, forgot-password limiter (3/min), `GET /files/{id}` + `/stream` (GCS-mocked).
- **End-to-end tests missing:** none exist (no Playwright/Cypress in repo). Minimum worthwhile flows: signup→verify→signin→upload→approve→view→XP; admin bulk moderation; AI chat happy path.
- **Manual smoke tests needed before launch:** real Auth0 tenant signup/verification email/signin; real GCS upload→approve→signed-URL download; real Gemini chat + embedding of one document; cookie behavior through the Vercel proxy (ties to PRA-008).
- **Edge cases untested:** Unicode/Hebrew filenames through `re.sub(r'[^\w\-]', ...)` (`files.py:219`); same-filename collisions in `trash_bin/` and on undo-reject (`admin.py:517-518`); pagination boundaries; concurrent approve+undo on one request; 30-day cookie with expired token (PRA-015).
- **Failure-path tests missing:** GCS outage during approve (PRA-006 is exactly this), DB commit failure mid-transaction, Auth0 outage during signup (PRA-021), Gemini quota exhaustion during embedding (PRA-009), true parallel heartbeat race (STR VIEW-006 caveat), rate-limit behavior behind the real proxy chain (PRA-003).

---

## 5. Release Checklist

**Infrastructure & config**
- [ ] All env vars set in Railway: `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_M2M_ID`, `AUTH0_M2M_SECRET`, `AUTH0_AUDIENCE`, `BUCKET_NAME`, `GEMINI_API_KEY`, `FRONTEND_URL`, `ENVIRONMENT=production`, `GCP_KEY_JSON` (source of truth: restore `server/.env.example`)
- [ ] `--proxy-headers` added and verified: `request.client.host` = real client IP in prod logs (PRA-003)
- [ ] Health endpoint returns 503 on DB failure; Railway restart observed in a drill (PRA-002)
- [ ] Vercel previews no longer point at prod (PRA-007)
- [ ] Cookie decision executed and tested through the proxy: `SameSite=Lax` or documented rationale for `None` (PRA-008)

**Quality gates**
- [ ] CI green on main: backend pytest (43) + Vitest (36) + `tsc -b` + `npm run build` (PRA-001)
- [ ] DEF-011 fixed and its failure path unit-tested (PRA-006)
- [ ] Manual smoke on staging with REAL Auth0/GCS/Gemini: signup → email verify → signin → upload → approve → embedding done → AI answers → XP awarded

**Observability & recovery**
- [ ] Sentry (or equivalent) receiving errors from both frontend and backend; one test error verified end-to-end (PRA-004)
- [ ] Structured logging with request IDs deployed (PRA-004)
- [ ] RUNBOOK.md exists: deploy, rollback, DB restore, secret rotation (PRA-010)
- [ ] Neon backup/PITR confirmed for the plan tier; one restore rehearsed into a scratch branch (PRA-010)
- [ ] Rollback drill: previous Railway image redeployed once, on purpose

**Data**
- [ ] Alembic baseline committed; prod schema stamped (PRA-005)
- [ ] Seed script runs idempotently on a fresh database (PRA-014)
- [ ] Backfill script for unembedded materials available (PRA-009)

---

## 6. Action Plan

**Phase 1 — must fix before production** *(≈3–5 focused days)*
1. CI pipeline running both suites + typecheck + build (PRA-001)
2. Health check 503-on-DB-failure (PRA-002) — one line
3. `--proxy-headers` + verification of client-IP keying (PRA-003)
4. Sentry + structured logging with request IDs (PRA-004)
5. DEF-011 compensating GCS rename-back (PRA-006)
6. Point Vercel previews at staging or gate them (PRA-007)
7. `SameSite=Lax` test through the proxy → close DEF-002 either way (PRA-008)
8. Alembic baseline (PRA-005)
9. Minimal RUNBOOK.md + one rehearsed rollback and DB restore (PRA-010)
10. Restore `server/.env.example` (PRA-019, 1 minute)

**Phase 2 — should fix soon after launch** *(first 2–3 weeks)*
1. `Material.embedding_status` + retry/backfill script (PRA-009)
2. Unify bulk/single approval side effects; per-ID bulk results (PRA-011)
3. Validation batch: AI `min_length`, `ge=0` heartbeat, FK existence checks, rejected→approved guard (PRA-016)
4. `total_files` populated or removed (PRA-012); trash purge job or reworded promise (PRA-013)
5. Working idempotent seed for staging (PRA-014)
6. Verify Auth0 token TTL vs 30-day cookie; align or add refresh flow (PRA-015)
7. README refresh + root junk removal + single pinned Python version (PRA-019)
8. Staging E2E smoke automated (Playwright, the one golden path)

**Phase 3 — later improvements**
1. Redis-backed rate limiting + shared AI cache before adding workers/instances (PRA-018)
2. API casing normalization via pydantic alias generation, router-by-router (PRA-017)
3. Leaderboard tie-break; signout revoke cleanup (PRA-020); 400-vs-503 on upstream failures (PRA-021)
4. Concurrency harness for the heartbeat race (closes STR VIEW-006 caveat)
5. OpenAPI-generated frontend client to end contract drift permanently
