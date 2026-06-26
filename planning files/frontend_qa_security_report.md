# GeeksHub Frontend — QA & Security Report

**Date:** 2026-05-25  
**Reviewer:** Claude Code (Senior QA & Security Specialist)  
**Scope:** All frontend source files under `src/`  
**Stack:** React 19, TypeScript, TanStack Query, React Router 7, Tailwind CSS, Vite  
**Last updated:** 2026-05-25 — remediation pass completed (see [Remediation Status](#remediation-status))

---

## Table of Contents

1. [Remediation Status](#remediation-status)
2. [Vulnerabilities Found](#1-vulnerabilities-found)
3. [Code Quality / QA Issues](#2-code-quality--qa-issues)
4. [Test Cases](#3-test-cases)
5. [Overall Risk Assessment](#4-overall-risk-assessment)

---

## Remediation Status

A remediation pass was completed on 2026-05-25. Type-check (`tsc`) passes clean and all
18 existing unit tests pass. Below is the status of every finding. Detailed per-issue
notes (the "how") are inline in each finding under a **Status** line.

**Legend:** ✅ Fixed · 🟡 Partially fixed (frontend done, backend follow-up needed) · 🔧 Backend-only (not frontend-fixable)

### Vulnerabilities

| ID | Issue | Severity | Status | Files changed |
|----|-------|----------|--------|---------------|
| VULN-01 | Client-side role check controls admin access | CRITICAL | ✅ Fixed | `AuthContext.tsx`, `authService.ts` |
| VULN-02 | Full user object in plain-text localStorage | HIGH | 🟡 Mitigated | `AuthContext.tsx` |
| VULN-03 | No try/catch around `JSON.parse` of session | HIGH | ✅ Fixed | `AuthContext.tsx` |
| VULN-04 | Reset token exposed in URL | MEDIUM | 🟡 Partial | `ResetPasswordForm.tsx` |
| VULN-05 | No file size validation on upload | MEDIUM | ✅ Fixed | `RequestFileModal.tsx` |
| VULN-06 | `fileId` interpolated into URLs unencoded | MEDIUM | ✅ Fixed | `assistantService.ts`, `FileViewer.tsx` |
| VULN-07 | XSS risk in `RichContent` renderer | MEDIUM | ✅ Hardened | `AssistantPanel.tsx` |
| VULN-08 | CSRF gap during cookie migration | MEDIUM | 🔧 Backend | — |
| VULN-09 | Full chat history sent every message | LOW | ✅ Fixed | `assistantService.ts` |
| VULN-10 | `console.error` leaks errors in prod | LOW | ✅ Fixed | `logger.ts` (new), `authService.ts`, `useViewerSession.ts` |

### QA Issues

| ID | Issue | Status | Files changed |
|----|-------|--------|---------------|
| QA-01 | No error feedback on upload failure | ✅ Fixed | `useRequests.ts` |
| QA-02 | Missing file-step validation error display | ✅ Fixed | `RequestFileModal.tsx` |
| QA-03 | Race condition in viewer session lifecycle | ⬜ Not changed (see note) | — |
| QA-04 | No session expiry / 401 handling | ✅ Fixed | `apiClient.ts` |
| QA-05 | No chat message length limit | ✅ Fixed | `AssistantPanel.tsx` |
| QA-06 | No notes length limit | ✅ Fixed | `AssistantPanel.tsx` |
| QA-07 | Stepper keeps file when upstream changes | ✅ Fixed | `RequestFileModal.tsx` |
| QA-08 | Role check only exact-string equality | ⬜ Not changed (see note) | — |
| QA-09 | `activeSeconds` cumulative vs per-interval | ⬜ Needs backend clarification | — |
| QA-10 | `password_confirm` sent as password value | ✅ Fixed | `authService.ts`, `AuthContext.tsx`, `SignUpForm.tsx` |
| QA-11 | PDF blob URL not revoked on error | ⬜ Not changed (see note) | — |

### What still needs to be done

**Backend / cross-team:**
- **VULN-08 (CSRF):** Backend sets `samesite="none"` in production (`server/routers/auth.py:150`), which disables SameSite CSRF protection. Switch to `lax`/`strict`, or add a CSRF token validated on state-changing admin endpoints.
- **VULN-04 (full fix):** Frontend now prefers the token from the URL fragment, but the Auth0 reset email still emits a `?token=` query link. Backend/Auth0 template must switch to a `#token=` fragment link to fully remove the token from logs and Referer headers.
- **VULN-02 (full fix):** Identity is still cached in `localStorage` for optimistic render. Fully resolved only when the HttpOnly-cookie migration lets us stop caching identity client-side. The boot `/me` reconciliation (VULN-01) already neutralizes the role-tampering risk in the meantime.
- **QA-09:** Confirm with backend whether `activeSeconds` should be cumulative or per-heartbeat, then rename/adjust in `useViewerSession.ts`.

**Frontend, intentionally deferred (low value / higher risk, not done in this pass):**
- **QA-03 / QA-11:** Viewer-session and PDF-blob cleanup edge cases. Existing `isMounted` / cleanup guards cover the common paths; an `AbortController` refactor was deferred to avoid destabilizing the viewer without manual browser testing.
- **QA-08:** Role hierarchy (`MODERATOR`, etc.). Deferred until sub-roles actually exist; the current exact-match `ADMIN` check is correct for today's roles.

---

## 1. Vulnerabilities Found

---

### VULN-01 — Client-Side Role Check Controls Admin Access

| Field      | Value |
|------------|-------|
| **File**   | `src/components/routing/ProtectedRoute.tsx:26` |
| **Severity** | **CRITICAL** |

**Description:**  
The entire admin section (`/admin/*`) is guarded solely by reading `user.role` from the React context, which is itself loaded from localStorage on boot (`AuthContext.tsx:25`). An attacker can open DevTools, run:

```js
const data = JSON.parse(localStorage.getItem("gh_user_session"));
data.role = "ADMIN";
localStorage.setItem("gh_user_session", JSON.stringify(data));
```

Then refresh the page. `ProtectedRoute` reads this crafted value, evaluates the role check as passing, and renders all admin routes — `ModerationQueue`, `AuditLog`, `AdminHome` — without any server-side gate.

**Affected code:**
```tsx
// ProtectedRoute.tsx:26
if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
}
```

The `user` object here comes from localStorage, not from a fresh server verification.

**Fix:**  
Add a `GET /me/profile` call on app boot that returns the authoritative role from the server (derived from the JWT cookie). Render the app only after this call resolves and use the server-returned role, not the cached localStorage value. Never trust `user.role` from localStorage for authorization decisions.

> **Status: ✅ Fixed.** Added `authService.getMe()` calling the existing `GET /api/v1/me` (verified server-side via `get_verified_user` → JWT cookie). `AuthContext` now starts in a loading state and, on boot, calls `/me` and overwrites the cached user — crucially the `role` — with the server's authoritative value before protected routes are trusted (`ProtectedRoute` already gates on `isLoading`). On `401/403` the session is cleared; on a transient network error the optimistic cached user is kept (data endpoints still enforce role server-side via `get_admin_user`, which returns 403 for non-admins). A tampered localStorage role is therefore overwritten on every load and cannot unlock the admin shell.

---

### VULN-02 — Full User Object (Including Role & Email) Stored in Plain-Text localStorage

| Field      | Value |
|------------|-------|
| **File**   | `src/context/AuthContext.tsx:47-53` |
| **Severity** | **HIGH** |

**Description:**  
On sign-in with "Remember Me," the full user object — including `id`, `email`, `role`, `majorId`, `totalPoints`, `createdAt` — is serialized and written to `localStorage["gh_user_session"]`. Any JavaScript running in the browser origin (via XSS, a malicious browser extension, or a compromised third-party script) can read this data in full. The `role` field is especially dangerous since it drives the admin access check (VULN-01).

**Affected code:**
```tsx
// AuthContext.tsx:47-48
if (rememberMe) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
```

**Fix:**  
Once HTTP-only cookies are implemented (the code comments already anticipate this), the localStorage store becomes redundant for auth state. In the interim: store only a minimal display object (`{ displayName, avatarInitials }`) in localStorage for UX purposes. Never store `role` or `id` there — derive them from the server on every load.

> **Status: 🟡 Mitigated (full fix is backend-gated).** The risk that mattered — a *trusted* cached role — is gone: VULN-01's boot `/me` reconciliation re-derives `role` from the server on every load, so the cached value is no longer authoritative for authorization. The object is still cached in localStorage for optimistic first render. Fully removing client-side identity caching depends on the HttpOnly-cookie migration; tracked under "What still needs to be done."

---

### VULN-03 — No try/catch Around JSON.parse of localStorage Session Data

| Field      | Value |
|------------|-------|
| **File**   | `src/context/AuthContext.tsx:27` |
| **Severity** | **HIGH** |

**Description:**  
The initial state function parses the stored session without any error handling:

```tsx
user: saved ? JSON.parse(saved) : null,
```

If the localStorage value is corrupted (e.g., by a partial write, a browser bug, or a malicious `<script>` that partially overwrites the key), `JSON.parse` throws a `SyntaxError` that is uncaught. The `useState` initializer crashes, the entire `AuthProvider` fails to mount, and the app shows a blank screen.

**Fix:**
```tsx
const parseSession = (raw: string | null): User | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        // Validate required fields exist
        if (!parsed?.id || !parsed?.role) return null;
        return parsed as User;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    }
};
```

> **Status: ✅ Fixed.** Implemented `readStoredSession()` in `AuthContext.tsx` almost exactly as proposed: `JSON.parse` is wrapped in try/catch, the shape is validated (`typeof parsed.id === "string"` and `typeof parsed.role === "string"`), and any malformed/invalid entry is removed from both storages and treated as logged-out instead of throwing during the `useState` initializer.

---

### VULN-04 — Password Reset Token Exposed in URL

| Field      | Value |
|------------|-------|
| **File**   | `src/components/auth/forms/ResetPasswordForm.tsx:12` |
| **Severity** | **MEDIUM** |

**Description:**  
The password reset flow delivers the token via a URL query parameter (`/auth/reset-password?token=...`). This token is:

- Stored in browser history (accessible by any script that calls `history.state` or reads referrer headers)
- Logged by web servers, CDNs, and proxies in access logs
- Leaked in `Referer` headers if the page contains any third-party resources (fonts, analytics)

**Affected code:**
```tsx
// ResetPasswordForm.tsx:12
const token = searchParams.get("token") || "";
```

**Fix:**  
Use a URL **fragment** (`/auth/reset-password#token=...`) instead. Fragments are never sent in HTTP requests, never appear in server logs, and are not included in Referer headers. Alternatively, use a short-lived code with a POST-only redemption flow.

> **Status: 🟡 Partial (frontend ready, backend link change required).** `ResetPasswordForm` now reads the token from the URL **fragment first** (`#token=...`) and only falls back to the query param, via the new `readResetToken()` helper. This is non-breaking — existing `?token=` links keep working. The full fix requires the Auth0 password-reset email template / backend to emit fragment-based links so the token stops appearing in the query string. Tracked under "What still needs to be done."

---

### VULN-05 — No File Size Validation in File Upload Modal

| Field      | Value |
|------------|-------|
| **File**   | `src/components/features/RequestFileModal.tsx:204-208` |
| **Severity** | **MEDIUM** |

**Description:**  
The UI displays "max 25 MB" but the frontend never enforces it. The `canProceed()` function only checks `!!form.file`. The `accept` attribute on the `<input>` is a UX hint, not a security control — it is trivially bypassed by a developer console or a custom HTTP client. A user can upload a 500 MB binary that only the backend (hopefully) rejects.

**Affected code:**
```tsx
// RequestFileModal.tsx:208
if (step === 4) return !!form.file;
```

**Fix:**
```tsx
if (step === 4) {
    if (!form.file) return false;
    if (form.file.size > 25 * 1024 * 1024) {
        setError("File must be 25 MB or smaller.");
        return false;
    }
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", 
                      "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      "image/jpeg", "image/png"];
    if (!allowed.includes(form.file.type)) {
        setError("File type not allowed.");
        return false;
    }
    return true;
}
```

> **Status: ✅ Fixed.** Added a `validateFile()` helper plus `MAX_FILE_SIZE` (25 MB) and `ALLOWED_EXTENSIONS` constants in `RequestFileModal.tsx`. Validation runs on file selection (`onChange`) and again in `handleSubmit`, and `canProceed()` for step 4 is now `!!form.file && !fileError`. Oversized or wrong-type files are rejected with an inline error and cannot be submitted.

---

### VULN-06 — fileId Directly Interpolated into API URLs Without Sanitization

| Field      | Value |
|------------|-------|
| **File**   | `src/services/assistantService.ts:39,51` |
| **Severity** | **MEDIUM** |

**Description:**  
The `fileId` URL parameter is taken from React Router params and placed directly into API URLs with template literals:

```ts
// assistantService.ts:39
const response = await api<{ content: string }>(`/me/notes?fileId=${fileId}`);
// assistantService.ts:51
await api(`/me/notes?fileId=${fileId}`, { ... });
```

Similarly in `FileViewer.tsx:75`:
```ts
apiFetch(`/files/${fileId}/stream`)
```

While the backend validates this server-side, if `fileId` ever came from user-controlled input (not just route params), this would allow URL parameter injection.

**Fix:**  
Use `URLSearchParams` for query parameters:
```ts
const params = new URLSearchParams({ fileId });
await api(`/me/notes?${params}`);
```
And encode path params:
```ts
apiFetch(`/files/${encodeURIComponent(fileId)}/stream`)
```

> **Status: ✅ Fixed.** `getNotes`/`saveNotes` in `assistantService.ts` now build the query with `new URLSearchParams({ fileId })`, and `FileViewer.tsx` wraps the stream path id in `encodeURIComponent(fileId)` — exactly as proposed.

---

### VULN-07 — XSS Risk in RichContent Renderer (AI Response Rendering)

| Field      | Value |
|------------|-------|
| **File**   | `src/components/assistant/AssistantPanel.tsx:70-81` |
| **Severity** | **MEDIUM** |

**Description:**  
The `RichContent` component renders AI assistant replies. Although it does not use `dangerouslySetInnerHTML`, it does render `<strong>` tags based on `**...**` patterns in the AI response string. If the AI backend is ever compromised or returns unexpected patterns, this could be extended to render arbitrary tags.

More critically: user chat input is stored directly in the `messages` state and rendered through `RichContent`. If a future version adds HTML support or uses `dangerouslySetInnerHTML`, user-supplied text becomes a direct XSS vector. The current implementation is safe but is one refactor away from being exploitable.

**Fix:**  
Keep rendering to plain text + `<strong>` only. Document explicitly that `RichContent` must never use `dangerouslySetInnerHTML`. Consider using a well-audited Markdown renderer like `react-markdown` with a sanitizer allowlist.

> **Status: ✅ Hardened.** Added an explicit security comment above `RichContent` in `AssistantPanel.tsx` warning that it must never switch to `dangerouslySetInnerHTML` because user and AI text flow through it unsanitised. Rendering remains plain-text + `<strong>` only. Adopting `react-markdown` with a sanitizer allowlist is left as an optional future enhancement.

---

### VULN-08 — CSRF Protection Gap During Cookie Migration

| Field      | Value |
|------------|-------|
| **File**   | `src/lib/apiClient.ts:99` |
| **Severity** | **MEDIUM** |

**Description:**  
The API client sends `credentials: "include"` on all requests, which is correct for HTTP-only cookie auth. However, there is no CSRF token mechanism anywhere in the frontend. Once HTTP-only cookies are live, the app will be vulnerable to Cross-Site Request Forgery unless the backend uses the `SameSite=Strict` or `SameSite=Lax` cookie attribute **and** the origin is properly validated.

**Fix:**  
Confirm with the backend team that all auth cookies are set with at minimum `SameSite=Lax`. For sensitive state-changing operations (approve/reject/bulk actions), consider adding a CSRF token header (`X-CSRF-Token`) that the backend validates.

> **Status: 🔧 Backend-only.** Not frontend-fixable. Confirmed during review that the backend sets `samesite="lax"` in development but **`samesite="none"` in production** (`server/routers/auth.py:150`), which disables SameSite CSRF protection in prod. Recommend switching prod to `lax`/`strict` (if the frontend is same-site) or adding a CSRF token on state-changing admin endpoints. Tracked under "What still needs to be done."

---

### VULN-09 — Entire Conversation History Sent to AI Backend on Every Message

| Field      | Value |
|------------|-------|
| **File**   | `src/services/assistantService.ts:26-30` |
| **Severity** | **LOW** |

**Description:**  
Every AI chat message sends the full conversation history to the backend:

```ts
body: JSON.stringify({ fileId, message, history }),
```

There is no truncation. A long conversation could:
1. Hit backend payload limits and silently fail
2. Transmit sensitive questions/answers the user asked earlier in the session to the server on every single turn

**Fix:**  
Truncate history to the last N messages (e.g., 10) before sending. Add a `maxLength` on the chat `<Textarea>` to prevent unbounded input.

> **Status: ✅ Fixed.** `assistantService.sendMessage` now sends `history.slice(-MAX_HISTORY_MESSAGES)` with `MAX_HISTORY_MESSAGES = 10`. The chat textarea also gained `maxLength={2000}` (see QA-05).

---

### VULN-10 — Console Logging of Internal Errors in Production

| Field      | Value |
|------------|-------|
| **Files**  | `src/services/authService.ts:126`, `src/hooks/useViewerSession.ts:109,114,129` |
| **Severity** | **LOW** |

**Description:**  
Multiple locations `console.error()` raw error objects including potential stack traces and server error responses:

```ts
console.error("Network error during signout:", error);       // authService.ts
console.error("Failed to start viewer session:", err);       // useViewerSession.ts
console.error("Viewer heartbeat failed:", err);              // useViewerSession.ts
```

In production, this leaks internal server error messages, stack traces, and API response bodies to anyone who opens DevTools.

**Fix:**  
Create a logger utility that logs only in development (checks `import.meta.env.DEV`) and forwards to an error monitoring service (e.g., Sentry) in production with sanitized payloads.

> **Status: ✅ Fixed.** Created `src/lib/logger.ts` with `logger.error`/`logger.warn` that only forward to the console when `import.meta.env.DEV` is true (with a comment marking where to wire Sentry). Replaced raw `console.error` calls in `authService.ts` (signout) and `useViewerSession.ts` (session start/heartbeat/end). `AuthContext` also uses `logger.warn`/`logger.error`.

---

## 2. Code Quality / QA Issues

---

### QA-01 — No Error Feedback When File Upload Submission Fails

| Field      | Value |
|------------|-------|
| **File**   | `src/components/features/RequestFileModal.tsx:214-228` |
| **Problem** | The `submitRequest` mutation is called with only an `onSuccess` callback. If the backend returns an error (file too large, invalid type, auth expired), the modal closes silently or stays open with no user-facing error message. |
| **Recommendation** | Add an `onError` callback to the mutation call: `{ onSuccess: () => onOpenChange(false), onError: (err) => setError(err.message) }`. Also display the error inside the modal step. |

> **Status: ✅ Fixed.** `useCreateRequest` already had an `onError` toast; it now surfaces the actual backend message (`err instanceof ApiError ? err.message : fallback`) instead of a generic string. Because the modal only closes `onSuccess`, it stays open on failure so the user can retry. Combined with the new client-side file validation (VULN-05), most failures are caught before submission.

---

### QA-02 — Missing File Step Validation Error Display

| Field      | Value |
|------------|-------|
| **File**   | `src/components/features/RequestFileModal.tsx` |
| **Problem** | The modal has no local `error` state at all. Validation failures (wrong file type, oversized file) cannot be communicated to the user. |
| **Recommendation** | Add a `const [stepError, setStepError] = useState("")` and render it in the modal footer near the navigation buttons. |

> **Status: ✅ Fixed.** Added a `fileError` state to `RequestFileModal`, rendered as inline red text below the upload dropzone. It is set by `validateFile()` on selection/submit and cleared on modal open and on cascade changes.

---

### QA-03 — Race Condition in Viewer Session Lifecycle

| Field      | Value |
|------------|-------|
| **File**   | `src/hooks/useViewerSession.ts:62-131` |
| **Problem** | The session start has a 500ms delay: `await new Promise(r => setTimeout(r, 500))`. If the user navigates away in those 500ms, `isMounted` becomes `false` and the session is never started — but there's also no session to end in cleanup. The `endSession` in the cleanup function fires with `activeSessionId = null`, so it's a no-op. This leaves phantom session state in `activeSecondsRef`. |
| **Recommendation** | The existing `isMounted` guard handles this correctly for the success path. However, the heartbeat interval is set with `window.setInterval`, but `clearInterval` is only called if `intervalRef.current` is set. Add a guard: `if (!isMounted && intervalRef.current) clearInterval(intervalRef.current)` immediately after setting the interval. |

> **Status: ⬜ Not changed (deferred).** The existing `isMounted` checks and cleanup `clearInterval`/`endSession` cover the common mount/unmount paths. A deeper `AbortController` refactor was deferred to avoid destabilizing the gamification viewer without manual browser testing. The `endSession` cleanup callback was switched to the prod-safe `logger` (part of VULN-10).

---

### QA-04 — No Session Expiry / Token Refresh Mechanism

| Field      | Value |
|------------|-------|
| **Files**  | `src/lib/apiClient.ts`, `src/context/AuthContext.tsx` |
| **Problem** | There is no handling for `401 Unauthorized` API responses. If the user's session cookie expires while they're browsing, every API call silently fails. The user sees loading spinners forever or empty states with no explanation. |
| **Recommendation** | In `apiClient.ts`, intercept `401` errors and call `signOut()` from AuthContext, then redirect to `/auth`. This requires making the auth context accessible from the API client (e.g., via a global callback registration pattern or a custom event). |

> **Status: ✅ Fixed.** Added `handleUnauthorized(path)` in `apiClient.ts`, invoked on any `401` from both `api()` and `apiFetch()`. It clears the session from both storages and redirects to `/auth` (guarded against redirect loops via a `window.location.pathname !== "/auth"` check). Auth endpoints (`/signin`, `/signup`, `/signout`, `/forgot-password`, `/reset-password`, `/me`) are excluded so a failed login's 401 does **not** trigger a wipe/redirect — that path keeps showing the inline form error.

---

### QA-05 — No Chat Message Length Limit

| Field      | Value |
|------------|-------|
| **File**   | `src/components/assistant/AssistantPanel.tsx:477-485` |
| **Problem** | The chat `<Textarea>` has no `maxLength` attribute. Users can paste arbitrarily large content (book chapters, code files), causing oversized API payloads that could be rejected by the backend with a confusing error, or they could successfully bloat the backend's context window. |
| **Recommendation** | Add `maxLength={2000}` to the chat textarea and add a character counter. |

> **Status: ✅ Fixed.** Added `maxLength={2000}` to the chat `<Textarea>` in `AssistantPanel.tsx`. A visible character counter was not added (optional polish).

---

### QA-06 — No Input Length Limit on Notes

| Field      | Value |
|------------|-------|
| **File**   | `src/components/assistant/AssistantPanel.tsx:567-575` |
| **Problem** | The notes textarea also has no `maxLength`. Notes are saved to the backend as JSON strings. Unbounded notes could fail backend validation silently. |
| **Recommendation** | Add `maxLength={500}` to the notes textarea to match the UI expectation (sticky cards are small). |

> **Status: ✅ Fixed.** Added `maxLength={500}` to the notes `<Textarea>` in `AssistantPanel.tsx`.

---

### QA-07 — Stepper Can Be Advanced Without Submitting (Navigation Bypass)

| Field      | Value |
|------------|-------|
| **File**   | `src/components/features/RequestFileModal.tsx:510-540` |
| **Problem** | The "Back" button allows moving to previous steps, which resets cascade fields via `handleCascadeSelect`. However, if a user goes back to Step 1 and changes their major, the course is cleared — but the `form.file` from Step 4 persists. A user could submit a file for the wrong course if they change their major selection after uploading. |
| **Recommendation** | Also reset `form.file` when cascade selections upstream of Step 4 change. |

> **Status: ✅ Fixed.** `handleCascadeSelect` now sets `updated.file = null` whenever an upstream cascade field changes (and clears `fileError`), so a previously chosen file can't be submitted against a changed course/lecturer.

---

### QA-08 — Admin Role Check Only Validates Exact String Equality

| Field      | Value |
|------------|-------|
| **File**   | `src/components/routing/ProtectedRoute.tsx:26` |
| **Problem** | The role check `user.role !== requiredRole` only handles the exact `"ADMIN"` string. If the backend ever introduces sub-roles (`"SUPER_ADMIN"`, `"MODERATOR"`), a `MODERATOR` would be locked out of admin routes unless the check is updated. |
| **Recommendation** | Define a role hierarchy or use an array check: `const ADMIN_ROLES: Role[] = ["ADMIN", "MODERATOR"]`. |

> **Status: ⬜ Not changed (deferred).** The exact-match `ADMIN` check is correct for the roles that exist today. Deferred until sub-roles (`MODERATOR`, etc.) are actually introduced, at which point a role hierarchy should be added in both `ProtectedRoute` and the backend `get_admin_user` dependency.

---

### QA-09 — `useViewerSession` Sends `activeSeconds` as Cumulative But Label Says "per heartbeat"

| Field      | Value |
|------------|-------|
| **File**   | `src/hooks/useViewerSession.ts:88-96` |
| **Problem** | `activeSecondsRef.current += 5` accumulates total active seconds across the session, but the variable is named `activeSeconds` in the heartbeat payload which might be interpreted as seconds since last heartbeat. If the backend treats it as "per-interval active seconds," the gamification scoring will overcount by the cumulative factor. |
| **Recommendation** | Clarify with the backend team whether `activeSeconds` should be cumulative (total) or incremental (per heartbeat). Rename the variable accordingly. |

> **Status: ⬜ Needs backend clarification.** No code change made — this requires confirming the backend's expected semantics for `activeSeconds` before adjusting. Tracked under "What still needs to be done."

---

### QA-10 — `signUp` Sends `password_confirm` as the Same Value as `password`

| Field      | Value |
|------------|-------|
| **File**   | `src/services/authService.ts:111-112` |
| **Problem** | The signup form correctly validates that `password === confirmPassword` before calling `signUp()`, but then `authService.signUp()` sends `password_confirm: password` (the password value, not the confirm field). If the form validation is ever bypassed, this means the backend always receives matching passwords regardless of what the user typed in the confirm field. |
| **Recommendation** | Pass the `confirmPassword` from the form data as a separate parameter through `signUp()` and send it as `password_confirm`. |

> **Status: ✅ Fixed.** Threaded `confirmPassword` through the chain: `SignUpForm` passes `data.confirmPassword` → `AuthContext.signUp(name, email, password, confirmPassword, majorId)` → `authService.signUp({ ..., passwordConfirm })`, which now sends `password_confirm: passwordConfirm` (the actual confirm field) instead of duplicating `password`.

---

### QA-11 — PDF Blob URL Not Revoked on Component Error

| Field      | Value |
|------------|-------|
| **File**   | `src/components/viewer/FileViewer.tsx:72-83` |
| **Problem** | The `useEffect` that fetches the PDF blob creates an `objectUrl` via `URL.createObjectURL(blob)`. The cleanup function revokes this URL. However, if the `.then()` chain succeeds but the component has already unmounted before the cleanup runs (race condition), the blob URL leaks memory indefinitely. |
| **Recommendation** | Use an `AbortController` for the fetch and check `isMounted` state in the `.then()` handler before calling `setPdfBlobUrl`. |

> **Status: ⬜ Not changed (deferred).** The existing cleanup already revokes the object URL on the normal unmount path. The `AbortController` + `isMounted` refactor to close the rare race was deferred to avoid destabilizing the PDF viewer without manual browser testing. The `fileId` in the stream path was hardened with `encodeURIComponent` as part of VULN-06.

---

## 3. Test Cases

---

### Feature: Authentication — Sign In

**TC-AUTH-01: Successful Sign In (Remember Me OFF)**
- **Preconditions:** Valid user account exists, user is logged out
- **Steps:** Navigate to `/auth`, enter valid email/password, leave "Remember Me" unchecked, click "Sign In"
- **Expected:** Redirect to `/`, user data stored in `sessionStorage["gh_user_session"]`, `localStorage["gh_user_session"]` is absent

**TC-AUTH-02: Successful Sign In (Remember Me ON)**
- **Preconditions:** Valid user account, logged out
- **Steps:** Sign in with "Remember Me" checked
- **Expected:** User data in `localStorage["gh_user_session"]`, absent from sessionStorage; data persists after browser restart

**TC-AUTH-03: Invalid Credentials**
- **Preconditions:** Wrong password used
- **Steps:** Enter valid email, wrong password, click Sign In
- **Expected:** Error message "Invalid email or password." displayed; no redirect; loading spinner stops

**TC-AUTH-04: Empty Fields Submission**
- **Steps:** Submit form with empty email and password
- **Expected:** Browser-native validation prevents submission; no API call made

**TC-AUTH-05: Session Persists After Page Refresh**
- **Preconditions:** Logged in with Remember Me ON
- **Steps:** Reload the page
- **Expected:** User remains logged in; dashboard loads; no redirect to `/auth`

**TC-AUTH-06 (Security): localStorage Role Manipulation**
- **Steps:** Log in as regular user, open DevTools, change `role` to `"ADMIN"` in localStorage, reload page
- **Expected (Current Behavior):** Admin routes become accessible — THIS IS A BUG (see VULN-01)
- **Expected (Fixed Behavior):** Server-side verification rejects the manipulated role; user is shown regular routes

**TC-AUTH-07 (Security): Corrupted localStorage Session**
- **Steps:** Manually set `localStorage["gh_user_session"] = "not valid json"`, reload page
- **Expected (Current):** App crashes with blank screen — THIS IS A BUG (see VULN-03)
- **Expected (Fixed):** App catches the parse error, clears the corrupted key, and shows the login page

---

### Feature: Authentication — Sign Up

**TC-SIGNUP-01: Successful Registration**
- **Preconditions:** New email `test@post.jce.ac.il`, valid name, matching passwords
- **Steps:** Fill all fields, select a major, click "Sign Up"
- **Expected:** Toast notification "Account created! 📧 Please check your email...", redirect to `/auth`

**TC-SIGNUP-02: Non-University Email Rejected**
- **Steps:** Enter `user@gmail.com` as email
- **Expected:** Error "You must use an Azrieli College email (@post.jce.ac.il) to join." displayed; no API call

**TC-SIGNUP-03: Password Mismatch**
- **Steps:** Enter password `password123`, confirm `password456`
- **Expected:** Error "Passwords do not match" displayed; no API call

**TC-SIGNUP-04: Password Too Short**
- **Steps:** Enter 5-character password
- **Expected:** Browser minLength validation or error displayed before submission

**TC-SIGNUP-05: No Major Selected**
- **Steps:** Fill all fields except major, click "Sign Up"
- **Expected:** Error "Please select a major" displayed

**TC-SIGNUP-06 (Edge): Duplicate Email**
- **Preconditions:** Email already registered
- **Steps:** Attempt signup with existing email
- **Expected:** Server error message displayed in form (e.g., "Email already in use")

**TC-SIGNUP-07 (Security): Email Domain Case Bypass**
- **Steps:** Enter `User@POST.JCE.AC.IL` (uppercase domain)
- **Expected:** Should pass (code lowercases the email before checking — this works correctly)

---

### Feature: Authentication — Password Reset

**TC-RESET-01: Reset With Valid Token**
- **Preconditions:** Valid unexpired token in URL `?token=abc123`
- **Steps:** Navigate to `/auth/reset-password?token=abc123`, enter matching 8+ char passwords, submit
- **Expected:** Success screen shown; Link to sign in displayed

**TC-RESET-02: Reset With No Token**
- **Preconditions:** Navigate to `/auth/reset-password` with no `?token=`
- **Expected:** "Invalid Link" state shown immediately; no form rendered

**TC-RESET-03: Reset Passwords Don't Match**
- **Steps:** Enter `newpass123`, confirm `newpass456`
- **Expected:** Error "Passwords do not match." — no API call

**TC-RESET-04: Reset Password Too Short**
- **Steps:** Enter `abc`, confirm `abc`
- **Expected:** Error "Password must be at least 8 characters."

**TC-RESET-05 (Security): Token Exposure in Browser History**
- **Steps:** Complete a reset flow, press Back in browser
- **Expected (Issue):** Token URL appears in browser history — see VULN-04

---

### Feature: File Upload (RequestFileModal)

**TC-UPLOAD-01: Complete 4-Step Happy Path**
- **Preconditions:** Logged in, PDF file under 25 MB available
- **Steps:** Open modal, select major + year, select course, fill details (lecturer, type, title, year), upload PDF, click "Submit File"
- **Expected:** Modal closes; toast notification; file appears in "My Uploads" list

**TC-UPLOAD-02: Next Button Disabled Until Step Complete**
- **Steps:** On step 1, click "Next" without selecting major
- **Expected:** "Next" button disabled; navigation blocked

**TC-UPLOAD-03: File Over 25 MB**
- **Steps:** Try to upload a 30 MB file
- **Expected (Current):** Submission proceeds with oversized file — THIS IS A BUG (see VULN-05)
- **Expected (Fixed):** Error displayed: "File must be 25 MB or smaller."

**TC-UPLOAD-04: Wrong File Type**
- **Steps:** Upload a `.exe` file (bypassing the accept attribute via DevTools)
- **Expected (Current):** File is accepted by frontend; backend should reject — frontend shows no feedback
- **Expected (Fixed):** Frontend MIME type check rejects it immediately

**TC-UPLOAD-05: Back Navigation Clears Downstream Selections**
- **Steps:** Go to step 4, upload a file, go back to step 1, change major
- **Expected:** Course, lecturer, type cleared; uploaded file should also reset (currently it doesn't — see QA-07)

**TC-UPLOAD-06: Upload Submission Error**
- **Preconditions:** Server returns 500 during submission
- **Expected (Current):** Modal behavior undefined — likely stays open with no feedback (see QA-01)
- **Expected (Fixed):** Error message shown inside modal

---

### Feature: PDF Viewer

**TC-VIEWER-01: PDF Loads Successfully**
- **Preconditions:** Logged in, valid PDF file exists
- **Steps:** Navigate to a file page
- **Expected:** PDF content renders; page count shown; toolbar functional

**TC-VIEWER-02: Pagination Controls**
- **Steps:** Navigate to a multi-page PDF
- **Expected:** Previous button disabled on page 1; Next disabled on last page; page counter updates

**TC-VIEWER-03: Zoom In/Out**
- **Steps:** Click zoom in repeatedly
- **Expected:** Scale increases up to 250%; "Zoom In" disables at 250%

**TC-VIEWER-04: Rotate**
- **Steps:** Click rotate button 4 times
- **Expected:** Document returns to original orientation (0° after 4 × 90°)

**TC-VIEWER-05: Text Selection — "Ask AI" Tooltip**
- **Preconditions:** AI panel open (`isOpen=true`)
- **Steps:** Select text in PDF, wait 10ms
- **Expected:** "Ask AI" tooltip appears above selection

**TC-VIEWER-06: Non-PDF File**
- **Preconditions:** File record exists with a non-PDF title
- **Steps:** Navigate to the file page
- **Expected:** "Preview not available" state shown; download link rendered

**TC-VIEWER-07: Gamification — File Completion**
- **Preconditions:** User has not completed this file before
- **Steps:** View all pages of a file with mouse activity for the required duration
- **Expected:** Toast "File Completed! Great job reading this material. +X Points!" shown once

---

### Feature: AI Assistant Panel

**TC-AI-01: Initial Welcome Message**
- **Preconditions:** Open file viewer with AI panel
- **Expected:** Welcome message references the file title; suggested prompt chips visible

**TC-AI-02: Send Message Via Enter Key**
- **Steps:** Type a question, press Enter (without Shift)
- **Expected:** Message submitted; loading dots shown; AI response appears

**TC-AI-03: Send Message Via Shift+Enter**
- **Steps:** Type a message, press Shift+Enter
- **Expected:** New line added to textarea; no submission

**TC-AI-04: Copy AI Response**
- **Steps:** Click "Copy" on an AI response
- **Expected:** "Copied" state shown for 1.5 seconds; text is in clipboard

**TC-AI-05: Pin AI Response to Notes**
- **Steps:** Click "Pin to notes" on an AI response
- **Expected:** Note appears on Notes board; active tab switches to Notes

**TC-AI-06: Add Manual Note**
- **Steps:** Switch to Notes tab, type a note, click "+"
- **Expected:** Sticky card appears; "Saving..." then "Saved" indicator

**TC-AI-07: Delete Note**
- **Steps:** Hover over a sticky card, click "×"
- **Expected:** Card removed; backend notified; "Saving..." indicator

**TC-AI-08: Clear Chat**
- **Steps:** Send at least one message, click "Clear"
- **Expected:** All messages removed; welcome message resets; chips reappear

**TC-AI-09 (Edge): Empty Message Submission**
- **Steps:** Click Send with empty textarea
- **Expected:** Send button disabled; no submission

**TC-AI-10 (Edge): Very Long Input**
- **Steps:** Paste 10,000 characters into the chat textarea
- **Expected (Current):** All 10,000 chars accepted and sent — potential issue (see QA-05)
- **Expected (Fixed):** Input truncated at maxLength; backend not overloaded

---

### Feature: Admin — Moderation Queue

**TC-ADMIN-01: Access as Regular User**
- **Steps:** Log in as regular user, navigate to `/admin`
- **Expected:** Redirect to `/`; admin content never rendered

**TC-ADMIN-02: Access as Admin User**
- **Steps:** Log in with admin account, navigate to `/admin`
- **Expected:** Admin home page rendered with stats

**TC-ADMIN-03: Approve Single Request**
- **Steps:** Open ModerationQueue, click "Approve" on a pending request
- **Expected:** Row status updates to "approved"; pending count decreases; toast shown

**TC-ADMIN-04: Reject With Reason**
- **Steps:** Click "Reject", select a reason, add a note, confirm
- **Expected:** Row moves to rejected tab; uploader could see rejection reason

**TC-ADMIN-05: Bulk Approve**
- **Steps:** Select multiple pending rows, click "Bulk Approve"
- **Expected:** All selected items approved; selection cleared; stats updated

**TC-ADMIN-06: Undo Approve**
- **Steps:** Approve a request, immediately click "Undo"
- **Expected:** Request returns to pending status; XP reverted

**TC-ADMIN-07 (Security): Direct API Call Without Admin Session**
- **Steps:** Use curl/fetch to call `POST /api/v1/admin/requests/{id}/approve` without auth cookie
- **Expected:** Backend returns 401 Unauthorized

**TC-ADMIN-08 (Security): localStorage Role Escalation → Admin Actions**
- **Steps:** Escalate role in localStorage (see TC-AUTH-06), attempt bulk approve
- **Expected (Current):** Admin UI renders and calls are made — backend must reject (VULN-01)
- **Expected (Fixed):** Server verifies role from JWT; admin UI never renders for non-admins

---

### Feature: Protected Routes

**TC-ROUTE-01: Unauthenticated Access to Protected Page**
- **Steps:** Clear all storage, navigate to `/`
- **Expected:** Redirect to `/auth`; `state.from` contains original path

**TC-ROUTE-02: Return After Login**
- **Preconditions:** Unauthenticated access triggers redirect to `/auth`
- **Steps:** Sign in
- **Expected:** Redirected back to the originally requested path

**TC-ROUTE-03: 404 For Unknown Routes**
- **Steps:** Navigate to `/some/unknown/path`
- **Expected:** NotFound page rendered; no crash

---

## 4. Overall Risk Assessment

### Risk Summary

| Category | Count | Highest Severity |
|----------|-------|-----------------|
| Authentication & Authorization | 3 | CRITICAL |
| Data Exposure | 2 | HIGH |
| Input Validation | 2 | MEDIUM |
| CSRF | 1 | MEDIUM |
| Error Handling | 2 | LOW–MEDIUM |
| QA / Functional Bugs | 11 | MEDIUM |

### Security Posture

The frontend has a **solid structural foundation**: centralized API client, consistent use of TanStack Query, role-based routing, and good UX patterns for auth flows. The HTTP-only cookie migration is already planned and partially architected.

However, **two issues must be fixed before production:**

1. **VULN-01 (CRITICAL):** The admin section is accessible to anyone who can modify localStorage. This is a complete authorization bypass on the frontend. It must be paired with a server-side session verification call on app boot.

2. **VULN-03 (HIGH):** The unguarded `JSON.parse` in `AuthContext` will crash the entire app on corrupted storage — a DoS vector for the user's own browser.

The remaining medium-severity issues (token in URL, file size validation, CSRF readiness) are important but do not constitute immediate critical risks for the current deployment stage, as the backend is the true enforcement layer.

### Priority Action Plan

| Priority | Issue | Effort | Status |
|----------|-------|--------|--------|
| P0 | VULN-01: Verify role server-side on boot | Medium | ✅ Done |
| P0 | VULN-03: Wrap JSON.parse in try/catch with validation | Low | ✅ Done |
| P1 | VULN-02: Minimize localStorage session data | Low | 🟡 Mitigated (full fix backend-gated) |
| P1 | QA-01: Add onError to upload mutation | Low | ✅ Done |
| P1 | VULN-05: Enforce file size/type on frontend | Low | ✅ Done |
| P2 | VULN-04: Move reset token to URL fragment | Medium | 🟡 Frontend ready; backend link change needed |
| P2 | QA-04: Handle 401 globally in apiClient | Medium | ✅ Done |
| P2 | VULN-08: Confirm SameSite cookie attributes with backend | Low | 🔧 Backend (prod uses `samesite=none`) |
| P3 | QA-05 / QA-06: Add textarea maxLength limits | Low | ✅ Done |
| P3 | VULN-10: Replace console.error with prod-safe logger | Low | ✅ Done |

### Verification

- `npx tsc --noEmit -p tsconfig.app.json` — passes clean.
- `npx vitest run` — 18/18 tests pass.
- ESLint on changed files introduced **no new** violations (remaining warnings are pre-existing patterns: `catch (err: any)`, `(data as any)`, `useRef(Date.now())`, and `setState`-in-effect on `setStep`/`setShowCelebration`).
- Manual browser testing of the auth boot flow, upload validation, and 401 redirect was **not** performed in this pass and is recommended before release.
