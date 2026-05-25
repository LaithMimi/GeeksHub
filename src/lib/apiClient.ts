/**
 * ============================================================================
 * API CLIENT
 * ============================================================================
 *
 * Centralized fetch wrapper for all API calls.
 * Provides:
 *   - Typed responses via generics
 *   - Automatic JSON content-type headers
 *   - Token injection from localStorage (until HTTP-only cookies are ready)
 *   - Typed error handling via ApiError class
 *   - credentials: "include" for cookie-based auth (future)
 *   - Automatic snake_case → camelCase key conversion on responses
 *
 * @backend When HTTP-only cookies are implemented, remove the
 *          Authorization header logic — the browser will send cookies
 *          automatically via credentials: "include".
 * ============================================================================
 */

import { SESSION_KEY } from "@/lib/constants";

// In development, use a relative path so Vite's proxy forwards requests to
// the FastAPI backend on the same origin — this ensures the HttpOnly
// auth_token cookie is attached to every request (cross-port = cross-origin).
// In production, VITE_API_URL should be set to the full backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// Auth endpoints own their own 401 handling (a failed login legitimately
// returns 401 and must NOT trigger a session wipe / redirect). The boot-time
// `/me` check is reconciled by AuthContext, so it's excluded here too.
const AUTH_PATHS = ["/signin", "/signup", "/signout", "/forgot-password", "/reset-password", "/me"];

/**
 * Reacts to an expired/invalid session on a protected request: clears any
 * cached session and sends the user to the login page. Skipped for auth
 * endpoints and when already on /auth to avoid redirect loops.
 */
function handleUnauthorized(path: string): void {
    if (AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}?`) || path.startsWith(`${p}/`))) return;
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
        window.location.assign("/auth");
    }
}

// ── snake_case → camelCase transformer ──────────────────────────────────────

/**
 * Convert a single snake_case string to camelCase.
 * Leaves strings that are already camelCase or PascalCase unchanged.
 */
function toCamelCase(str: string): string {
    return str.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Handles nested objects, arrays, and preserves primitives.
 */
export function snakeToCamel<T>(data: unknown): T {
    if (data === null || data === undefined) return data as T;
    if (Array.isArray(data)) return data.map((item) => snakeToCamel(item)) as T;
    if (typeof data === "object" && !(data instanceof Date)) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            result[toCamelCase(key)] = snakeToCamel(value);
        }
        return result as T;
    }
    return data as T;
}

// ── API Error ───────────────────────────────────────────────────────────────

/**
 * Typed API error with status code, message, and raw response data.
 */
export class ApiError extends Error {
    status: number;
    data?: unknown;

    constructor(status: number, message: string, data?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

// ── Fetch wrapper ───────────────────────────────────────────────────────────

/**
 * Generic fetch wrapper with automatic snake_case → camelCase conversion.
 *
 * @example
 * ```ts
 * const majors = await api<Major[]>("/majors");
 * const file = await api<File>("/files/123");
 * const result = await api<FileRequest>("/file-requests", {
 *     method: "POST",
 *     body: JSON.stringify(payload),
 * });
 * ```
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> ?? {}),
    };

    if (init?.body instanceof FormData) {
        delete headers["Content-Type"];
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
        credentials: "include", // Ready for HTTP-only cookies
    });

    if (!res.ok) {
        let data: unknown;
        try {
            data = await res.json();
        } catch {
            // Response body is not JSON
        }

        if (res.status === 401) handleUnauthorized(path);

        const message = (data as any)?.detail
            || (data as any)?.message
            || `API error ${res.status}`;

        throw new ApiError(res.status, message, data);
    }

    // Handle 204 No Content
    if (res.status === 204) {
        return undefined as unknown as T;
    }

    const json = await res.json();
    return snakeToCamel<T>(json);
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        credentials: "include",
    });
    if (!res.ok) {
        if (res.status === 401) handleUnauthorized(path);
        throw new ApiError(res.status, `API error ${res.status}`);
    }
    return res;
}

