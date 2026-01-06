/**
 * ============================================================================
 * REPUTATION SERVICE - Mock Implementation
 * ============================================================================
 * 
 * This service handles user reputation and points: fetching total points,
 * badge tier, and transaction history.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * When the backend is implemented, replace each function's implementation:
 * 
 * 1. Import your API client instead of mock-db:
 *    ```ts
 *    import { api } from "@/lib/apiClient";
 *    ```
 * 
 * 2. Replace function bodies with fetch calls:
 * 
 *    getMyReputation(userId) → GET /api/me/reputation
 *    - Backend: 
 *      ```sql
 *      SELECT 
 *        u.id as user_id,
 *        COALESCE(SUM(pt.amount), 0) as total_points,
 *        CASE 
 *          WHEN SUM(pt.amount) > 1000 THEN 'Gold'
 *          WHEN SUM(pt.amount) > 500 THEN 'Silver'
 *          ELSE 'Bronze'
 *        END as badge
 *      FROM users u
 *      LEFT JOIN points_transactions pt ON u.id = pt.user_id
 *      WHERE u.id = :currentUserId
 *      GROUP BY u.id
 *      ```
 *    - Include recent transactions (last 20)
 * 
 * 3. Example real implementation:
 *    ```ts
 *    export const getMyReputation = async (): Promise<ReputationSummary> => {
 *        // No userId param - backend uses session/JWT
 *        return api<ReputationSummary>("/api/me/reputation");
 *    };
 *    ```
 * 
 * 4. Additional endpoints to consider:
 *    - GET /api/me/transactions?page=1&limit=20  (paginated history)
 *    - GET /api/leaderboard?limit=10 (top users by points)
 * 
 * 5. Keep function signatures unchanged - TanStack Query hooks won't need updates.
 * ============================================================================
 */

import { pointsTransactions, randomDelay } from "@/mock/mock-db";
import type { ReputationSummary } from "@/types/domain";

/**
 * Fetches the current user's reputation summary.
 * @param userId - The user ID to fetch reputation for
 * @backend GET /api/me/reputation
 * @returns ReputationSummary with totalPoints, badge tier, and recent transactions
 * @note Backend should calculate totalPoints from points_transactions table
 */
export const getMyReputation = async (userId: string): Promise<ReputationSummary> => {
    await randomDelay();

    // Calculate from transactions
    // Backend: SELECT SUM(amount) FROM points_transactions WHERE user_id = ?
    const transactions = pointsTransactions.filter(t => t.userId === userId);
    const totalPoints = transactions.reduce((sum, t) => sum + t.amount, 0);

    return {
        userId,
        totalPoints,
        badge: totalPoints > 1000 ? "Gold" : totalPoints > 500 ? "Silver" : "Bronze",
        transactions
    };
};
