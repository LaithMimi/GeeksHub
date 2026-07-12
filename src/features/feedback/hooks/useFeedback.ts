/**
 * ============================================================================
 * FEEDBACK QUERY HOOKS
 * ============================================================================
 *
 * TanStack Query hooks for the feedback / NPS loop. Submission is available to
 * any signed-in user; the list + stats queries are consumed by the moderator
 * dashboard. Uses the shared toastSuccess/toastError helpers from lib/errors.
 * ============================================================================
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toastError, toastSuccess } from "@/lib/errors";
import {
    submitFeedback,
    listFeedback,
    fetchFeedbackStats,
    FEEDBACK_PAGE_SIZE,
    type FeedbackInput,
    type FeedbackFilters,
} from "@/features/feedback/api/feedbackService";

const k = queryKeys.feedback;

// -- Submission (any user) -----------------------------------------------------

export const useSubmitFeedback = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: FeedbackInput) => submitFeedback(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: k.listRoot() });
            qc.invalidateQueries({ queryKey: k.stats() });
            toastSuccess("Thanks for your feedback!", "We read every response.");
        },
        onError: (err) => toastError(err, { fallbackMessage: "Couldn't send your feedback." }),
    });
};

// -- Moderator views -----------------------------------------------------------

/** Paginated responses list — a full page means there may be more to fetch. */
export const useFeedbackList = (filters?: FeedbackFilters) =>
    useInfiniteQuery({
        queryKey: k.list(filters),
        queryFn: ({ pageParam }) => listFeedback(filters, pageParam),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === FEEDBACK_PAGE_SIZE ? allPages.length * FEEDBACK_PAGE_SIZE : undefined,
    });

export const useFeedbackStats = () =>
    useQuery({ queryKey: k.stats(), queryFn: fetchFeedbackStats });
