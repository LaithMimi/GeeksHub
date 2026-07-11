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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toastError, toastSuccess } from "@/lib/errors";
import {
    submitFeedback,
    listFeedback,
    fetchFeedbackStats,
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

export const useFeedbackList = (filters?: FeedbackFilters) =>
    useQuery({ queryKey: k.list(filters), queryFn: () => listFeedback(filters) });

export const useFeedbackStats = () =>
    useQuery({ queryKey: k.stats(), queryFn: fetchFeedbackStats });
