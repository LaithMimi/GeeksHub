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
 *
 * @backend When HTTP-only cookies are implemented, remove the
 *          Authorization header logic — the browser will send cookies
 *          automatically via credentials: "include".
 * ============================================================================
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

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

/**
 * Generic fetch wrapper.
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
    const token = localStorage.getItem("token");

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> ?? {}),
    };

    // @backend Remove this block when using HTTP-only cookies
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
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

        const message = (data as any)?.detail
            || (data as any)?.message
            || `API error ${res.status}`;

        throw new ApiError(res.status, message, data);
    }

    // Handle 204 No Content
    if (res.status === 204) {
        return undefined as unknown as T;
    }

    return res.json() as Promise<T>;
}
