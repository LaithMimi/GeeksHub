import { api } from "@/lib/apiClient";
import type { ActivitySummary, BadgeTier, CourseStatus } from "@/types/domain";

/** Raw shape returned by GET /me/activity/summary (all fields optional for resilience). */
interface ActivitySummaryResponse {
    totalPoints?: number;
    badgeTier?: BadgeTier;
    totalStudyMinutes?: number;
    coursesEngaged?: number;
    recentTransactions?: { id: string; action: string; points: number; createdAt: string }[];
    courseActivity?: {
        courseId: string;
        courseName: string;
        status: CourseStatus;
        filesCompleted: number;
        totalFiles: number;
    }[];
}

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
    const response = await api<ActivitySummaryResponse>("/me/activity/summary");

    return {
        totalPoints: response.totalPoints ?? 0,
        badgeTier: response.badgeTier ?? "newcomer",
        totalStudyMinutes: response.totalStudyMinutes ?? 0,
        coursesEngaged: response.coursesEngaged ?? 0,
        recentTransactions: (response.recentTransactions ?? []).map((t) => ({
            id: t.id,
            action: t.action,
            points: t.points,
            createdAt: t.createdAt,
        })),
        courseActivity: (response.courseActivity ?? []).map((c) => ({
            courseId: c.courseId,
            courseName: c.courseName,
            status: c.status,
            filesCompleted: c.filesCompleted,
            totalFiles: c.totalFiles,
        })),
    };
};
