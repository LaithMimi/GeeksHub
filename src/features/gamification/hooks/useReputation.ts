/**
 * ============================================================================
 * REPUTATION QUERY HOOKS
 * ============================================================================
 * 
 * TanStack Query hooks for user reputation and points data.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * ✅ MOSTLY NO CHANGES NEEDED when backend is implemented!
 * 
 * The only change you may need:
 * 
 * 1. REMOVE userId PARAMETER:
 *    When the backend uses authentication (JWT/session), it will identify
 *    the current user automatically. You can simplify:
 *    
 *    BEFORE (mock):
 *    ```ts
 *    export const useReputation = (userId: string) => useQuery({
 *        queryKey: ['reputation', userId],
 *        queryFn: () => getMyReputation(userId),
 *        enabled: !!userId
 *    });
 *    ```
 *    
 *    AFTER (real backend):
 *    ```ts
 *    export const useReputation = () => useQuery({
 *        queryKey: ['reputation'],
 *        queryFn: getMyReputation, // No userId, backend uses auth
 *    });
 *    ```
 *    
 *    Then update components that call useReputation() to not pass userId.
 * 
 * 2. Consider adding a useLeaderboard hook:
 *    ```ts
 *    export const useLeaderboard = (limit = 10) => useQuery({
 *        queryKey: ['leaderboard', limit],
 *        queryFn: () => getLeaderboard(limit),
 *        staleTime: 1000 * 60 * 5 // 5 minutes
 *    });
 *    ```
 * ============================================================================
 */

import { useQuery } from "@tanstack/react-query";
import { getMyReputation } from "@/services/reputationService";

/**
 * Fetches the current user's reputation summary (points, badge, transactions).
 * @param userId - User ID to fetch reputation for (will be removed when backend uses auth)
 * @backend When authenticated, backend uses session user automatically
 */
export const useReputation = (userId: string) => useQuery({
    queryKey: ['reputation', userId],
    queryFn: () => getMyReputation(userId),
    enabled: !!userId
});
