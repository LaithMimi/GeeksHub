import { api } from "@/lib/apiClient";
import type { ReputationSummary } from "@/types/domain";

/**
 * Fetches the current user's reputation summary.
 * @param userId - The user ID to fetch reputation for
 * @backend GET /api/v1/me/reputation
 */
export const getMyReputation = async (_userId: string): Promise<ReputationSummary> => {
    return await api<ReputationSummary>("/me/reputation");
};
