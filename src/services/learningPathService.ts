import { api } from "@/lib/apiClient";
import type { ActivitySummary } from "@/types/domain";

/**
 * ============================================================================
 * LEARNING PATH SERVICE
 * ============================================================================
 * Handles fetching the user's structured learning path and dashboard activity
 * summary, which powers the gamified progress tracking.
 */


/**
 * Fetches the summary of the user's activity for the Dashboard.
 * @backend GET /api/v1/me/activity/summary
 */
export const getActivitySummary = async (): Promise<ActivitySummary> => {
    const response = await api<any>("/me/activity/summary");
    
    return {
        totalPoints: response.totalPoints,
        badgeTier: response.badgeTier,
        recentTransactions: response.recentTransactions.map((t: any) => ({
            id: t.id,
            action: t.action,
            points: t.points,
            createdAt: t.createdAt,
        })),
        courseActivity: response.courseActivity.map((c: any) => ({
            courseId: c.courseId,
            courseName: c.courseName,
            status: c.status,
            filesCompleted: c.filesCompleted,
            totalFiles: c.totalFiles,
        })),
    };
};

/**
 * Fetches the canonical share URL for a file (no auth required).
 * @backend GET /api/v1/files/:file_id/share
 */
export const getShareUrl = async (fileId: string): Promise<{ shareUrl: string }> => {
    const response = await api<any>(`/files/${fileId}/share`);
    return { shareUrl: response.shareUrl };
};
