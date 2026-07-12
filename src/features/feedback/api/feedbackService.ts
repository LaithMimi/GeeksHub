/**
 * ============================================================================
 * FEEDBACK SERVICE
 * ============================================================================
 *
 * API calls for the feedback / NPS loop. Any signed-in user can POST feedback;
 * the list + stats endpoints are gated to MODERATOR only on the backend.
 * Request bodies are camelCase; responses are auto-camelCased by the api client.
 * ============================================================================
 */

import { api } from "@/lib/apiClient";
import type { FeedbackCategory, FeedbackSource, FeedbackStats, FeedbackSubmission } from "@/types/domain";

// -- Types ---------------------------------------------------------------------

export interface FeedbackInput {
    score?: number | null;      // NPS 0–10; omit for pure feedback
    category: FeedbackCategory;
    comment?: string | null;
    page?: string | null;
    source: FeedbackSource;
}

export interface FeedbackFilters {
    category?: FeedbackCategory;
    hasScore?: boolean;
}

/** Page size for the moderator responses list (matches the backend default cap). */
export const FEEDBACK_PAGE_SIZE = 50;

// -- Submission (any user) -----------------------------------------------------

export const submitFeedback = (data: FeedbackInput) =>
    api<FeedbackSubmission>("/feedback", { method: "POST", body: JSON.stringify(data) });

// -- Moderator views -----------------------------------------------------------

export const listFeedback = (filters?: FeedbackFilters, offset = 0) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.hasScore !== undefined) params.append("hasScore", String(filters.hasScore));
    params.append("limit", String(FEEDBACK_PAGE_SIZE));
    params.append("offset", String(offset));
    return api<FeedbackSubmission[]>(`/moderator/feedback?${params.toString()}`);
};

export const fetchFeedbackStats = () => api<FeedbackStats>("/moderator/feedback/stats");
