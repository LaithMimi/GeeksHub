/**
 * ============================================================================
 * ERROR NORMALIZATION & TAXONOMY
 * ============================================================================
 *
 * The single source of truth for turning any thrown value — an ApiError, a
 * network failure, a FastAPI validation envelope, or an unknown exception —
 * into a calm, plain-language, actionable message for the user.
 *
 * Rules this layer enforces (see the platform error guidelines):
 *   - Plain language, no jargon, no stack traces, no raw provider payloads.
 *   - Every message says what happened and what to do next.
 *   - Unknown failures fall back to a safe, reassuring default.
 *   - Raw details go to the developer logger, never to the user.
 *
 * Consumers should never read `ApiError.message`/`.data` directly for display;
 * always route through `normalizeError()` (or `toastError()`).
 * ============================================================================
 */

import { toast } from "sonner";
import { ApiError, isNetworkError } from "@/lib/apiClient";
import { logger } from "@/lib/logger";

// ── Taxonomy ────────────────────────────────────────────────────────────────

export type ErrorKind =
    | "validation"
    | "authentication"
    | "authorization"
    | "notFound"
    | "conflict"
    | "rateLimit"
    | "network"
    | "server"
    | "payment"
    | "upload"
    | "unknown";

/** A user-safe, fully-resolved error ready to render anywhere in the UI. */
export interface NormalizedError {
    kind: ErrorKind;
    /** Short headline — "what happened". */
    title: string;
    /** One or two calm sentences — what happened + what to do next. */
    message: string;
    /** True for transient failures where a "Try again" affordance makes sense. */
    retryable: boolean;
    /** Field-name → message map, populated from validation (422) responses. */
    fieldErrors?: Record<string, string>;
}

// ── Default copy per kind ─────────────────────────────────────────────────────
// Every fallback answers: what happened + what to do next. No blame, no codes.

const DEFAULTS: Record<ErrorKind, { title: string; message: string; retryable: boolean }> = {
    validation: {
        title: "Check your details",
        message: "Some information needs a quick fix. Review the highlighted fields and try again.",
        retryable: false,
    },
    authentication: {
        title: "Your session expired",
        message: "For your security, please sign in again to continue.",
        retryable: false,
    },
    authorization: {
        title: "You don't have access",
        message: "You don't have permission to do this. If you think this is a mistake, contact an admin.",
        retryable: false,
    },
    notFound: {
        title: "Not found",
        message: "This item was already removed or no longer exists. Try refreshing the page.",
        retryable: false,
    },
    conflict: {
        title: "That didn't go through",
        message: "This conflicts with something that already exists. Review your changes and try again.",
        retryable: false,
    },
    rateLimit: {
        title: "Too many attempts",
        message: "You've tried that a few times. Please wait a moment, then try again.",
        retryable: true,
    },
    network: {
        title: "Connection problem",
        message: "We couldn't reach the server. Check your internet connection and try again.",
        retryable: true,
    },
    server: {
        title: "Something went wrong on our end",
        message: "This is on us, not you. Please try again in a moment — we're on it.",
        retryable: true,
    },
    payment: {
        title: "Payment didn't complete",
        message: "Your payment couldn't be processed. No charge was made. Check your details and try again.",
        retryable: true,
    },
    upload: {
        title: "Upload didn't finish",
        message: "We couldn't upload that file. Try again, or choose a smaller file.",
        retryable: true,
    },
    unknown: {
        title: "Something went wrong",
        message: "That didn't work as expected. Please try again in a moment.",
        retryable: true,
    },
};

// ── HTTP status → kind ────────────────────────────────────────────────────────

function kindFromStatus(status: number): ErrorKind {
    switch (status) {
        case 400:
        case 422:
            return "validation";
        case 401:
            return "authentication";
        case 403:
            return "authorization";
        case 404:
            return "notFound";
        case 402:
            return "payment";
        case 409:
            return "conflict";
        case 429:
            return "rateLimit";
        default:
            if (status === 0) return "network";
            if (status >= 500) return "server";
            if (status >= 400) return "validation";
            return "unknown";
    }
}

// ── FastAPI envelope helpers ──────────────────────────────────────────────────

interface ValidationItem {
    loc?: (string | number)[];
    msg?: string;
    [key: string]: unknown;
}

/** camelCase-ify a snake_case field name so it matches frontend form field ids. */
function toField(name: string): string {
    return name.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/**
 * Pull a clean, user-safe string out of FastAPI's `{ detail: ... }` envelope.
 * Handles the string form, the `{ msg }` object form, and the array-of-items
 * (422) form. Returns `undefined` when there's nothing human-readable.
 */
function detailToMessage(detail: unknown): string | undefined {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        const msgs = detail
            .map((d: ValidationItem) => (typeof d?.msg === "string" ? cleanValidationMsg(d.msg) : undefined))
            .filter(Boolean);
        return msgs.length ? (msgs as string[]).join(" ") : undefined;
    }
    if (detail && typeof detail === "object" && typeof (detail as ValidationItem).msg === "string") {
        return cleanValidationMsg((detail as ValidationItem).msg as string);
    }
    return undefined;
}

/** Map a FastAPI 422 body to a { field: message } dictionary for inline display. */
function fieldErrorsFromDetail(detail: unknown): Record<string, string> | undefined {
    if (!Array.isArray(detail)) return undefined;
    const out: Record<string, string> = {};
    for (const item of detail as ValidationItem[]) {
        const loc = item.loc ?? [];
        // loc is typically ["body", "field_name"] — take the last string segment.
        const raw = [...loc].reverse().find((seg) => typeof seg === "string" && seg !== "body");
        if (typeof raw === "string" && item.msg) {
            out[toField(raw)] = cleanValidationMsg(item.msg);
        }
    }
    return Object.keys(out).length ? out : undefined;
}

/** Strip Pydantic's noisy prefixes and make the message read like a fix. */
function cleanValidationMsg(msg: string): string {
    const cleaned = msg
        .replace(/^Value error,\s*/i, "")
        .replace(/^Assertion failed,\s*/i, "")
        .trim();
    if (/field required/i.test(cleaned)) return "This field is required.";
    if (/valid email/i.test(cleaned)) return "Enter a valid email address, like name@example.com.";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ── Known-message rewrites ────────────────────────────────────────────────────
// Backend messages that are already user-facing but could read friendlier, or
// that leak internals we'd rather not surface verbatim.

function rewriteKnownMessage(raw: string): string | undefined {
    const m = raw.toLowerCase();
    if (m.includes("wrong email or password") || m.includes("invalid credentials")) {
        return "That email or password doesn't match. Check them and try again.";
    }
    if (m.includes("passwordstrength")) {
        return "Your password is too weak. Use at least 8 characters with an uppercase letter, a lowercase letter, and a number.";
    }
    if (m.includes("email") && m.includes("already") && (m.includes("registered") || m.includes("exists"))) {
        return "An account with this email already exists. Try signing in instead.";
    }
    // Anything that smells like a raw exception / SQL / stack — suppress it.
    if (/traceback|exception|sqlalchemy|psycopg|null value|integrityerror|keyerror|at 0x[0-9a-f]+/i.test(raw)) {
        return undefined;
    }
    return raw;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface NormalizeOptions {
    /** Domain hint so the message fits the action, e.g. "upload" or "payment". */
    context?: ErrorKind;
    /** Overrides the fallback message for the resolved (or unknown) kind. */
    fallbackMessage?: string;
}

/**
 * Convert any thrown value into a user-safe {@link NormalizedError}.
 * Always logs the raw error for developers; never surfaces internals.
 */
export function normalizeError(err: unknown, opts: NormalizeOptions = {}): NormalizedError {
    // Developer-facing log (silent in production) — the raw truth lives here.
    logger.error("[normalizeError]", err);

    // Network / offline: fetch throws a TypeError, or apiClient tagged status 0.
    if (isNetworkError(err)) {
        return withFallback("network", opts);
    }

    if (err instanceof ApiError) {
        let kind = kindFromStatus(err.status);
        // A context hint upgrades a generic bucket to the domain-specific one
        // (e.g. a 400 during an upload should read as an upload error).
        if (opts.context && (kind === "validation" || kind === "server" || kind === "unknown")) {
            kind = opts.context;
        }

        const data = err.data as { detail?: unknown; message?: string; error_description?: string } | undefined;
        const fieldErrors = fieldErrorsFromDetail(data?.detail);

        // Prefer a specific backend message when it's genuinely user-facing.
        const rawMessage =
            detailToMessage(data?.detail) ?? data?.message ?? data?.error_description ?? undefined;
        const safeMessage = rawMessage ? rewriteKnownMessage(rawMessage) : undefined;

        const base = DEFAULTS[kind];
        return {
            kind,
            title: base.title,
            // For validation with field errors, keep the summary generic and let
            // the fields carry specifics. Otherwise prefer the safe backend text.
            message:
                (kind === "validation" && fieldErrors
                    ? base.message
                    : safeMessage || opts.fallbackMessage || base.message),
            retryable: base.retryable,
            fieldErrors,
        };
    }

    // Plain Error or unknown throw.
    return withFallback(opts.context ?? "unknown", opts);
}

function withFallback(kind: ErrorKind, opts: NormalizeOptions): NormalizedError {
    const base = DEFAULTS[kind];
    return {
        kind,
        title: base.title,
        message: opts.fallbackMessage || base.message,
        retryable: base.retryable,
    };
}

/**
 * Normalize `err` and show it as a toast. Critical, non-retryable errors stay
 * on screen longer (and permission/auth errors persist) so users can act; a
 * retry-shaped failure keeps the standard duration. Returns the normalized
 * error so callers can also drive inline UI if they want.
 */
export function toastError(err: unknown, opts: NormalizeOptions = {}): NormalizedError {
    const n = normalizeError(err, opts);
    const critical = n.kind === "authorization" || n.kind === "authentication";
    toast.error(n.title, {
        description: n.message,
        // Persist critical errors; give server/network a comfortable read.
        duration: critical ? Infinity : n.retryable ? 6000 : 5000,
    });
    return n;
}

/** Convenience for success toasts so tone stays consistent across the app. */
export function toastSuccess(message: string, description?: string): void {
    toast.success(message, description ? { description } : undefined);
}
