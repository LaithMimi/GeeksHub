import type { RejectReason } from "@/types/domain";

/** Key used to persist the authenticated user session in localStorage */
export const SESSION_KEY = "gh_user_session";

/** Human-readable labels for RejectReason enum values. */
export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
    DUPLICATE: "Duplicate content",
    OUTDATED: "Outdated material",
    INCORRECT_COURSE: "Incorrect course/category",
    BAD_QUALITY: "Poor quality",
    OTHER: "Other reason",
};

/**
 * Maps a rejection reason enum value to its display label.
 * Unknown values (e.g. free-text notes from older records) pass through as-is.
 */
export function rejectReasonLabel(reason: string): string {
    return REJECT_REASON_LABELS[reason as RejectReason] ?? reason;
}
