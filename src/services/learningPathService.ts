import { api } from "@/lib/apiClient";
import type { LearningPath, ActivitySummary } from "@/types/domain";

/**
 * ============================================================================
 * LEARNING PATH SERVICE
 * ============================================================================
 * Handles fetching the user's structured learning path and dashboard activity
 * summary, which powers the gamified progress tracking.
 */

/**
 * Fetches the user's full learning path (major -> years -> semesters -> courses)
 * including their current completion status for each course.
 * @backend GET /api/v1/me/learning-path
 */
export const getLearningPath = async (): Promise<LearningPath> => {
    const response = await api<any>("/me/learning-path");
    
    // Map backend snake_case to frontend camelCase
    return {
        major: response.major,
        years: response.years.map((year: any) => ({
            yearId: year.year_id,
            label: year.label,
            semesters: year.semesters.map((sem: any) => ({
                semester: sem.semester,
                label: sem.label,
                courses: sem.courses.map((course: any) => ({
                    id: course.id,
                    code: course.code,
                    name: course.name,
                    majorId: response.major.id, // Implicit
                    semesterId: sem.label, // Fallback
                    term: sem.label,
                    color: "from-violet-500/20 to-fuchsia-500/20", // Default gradient
                    hasFiles: course.has_files,
                    status: course.status,
                    filesCompleted: course.files_completed,
                    totalFiles: course.total_files,
                })),
            })),
        })),
    };
};

/**
 * Fetches the summary of the user's activity for the Dashboard.
 * @backend GET /api/v1/me/activity/summary
 */
export const getActivitySummary = async (): Promise<ActivitySummary> => {
    const response = await api<any>("/me/activity/summary");
    
    return {
        totalPoints: response.total_points,
        badgeTier: response.badge_tier,
        recentTransactions: response.recent_transactions.map((t: any) => ({
            id: t.id,
            action: t.action,
            points: t.points,
            createdAt: t.created_at,
        })),
        courseActivity: response.course_activity.map((c: any) => ({
            courseId: c.course_id,
            courseName: c.course_name,
            status: c.status,
            filesCompleted: c.files_completed,
            totalFiles: c.total_files,
        })),
    };
};

/**
 * Fetches the canonical share URL for a file (no auth required).
 * @backend GET /api/v1/files/:file_id/share
 */
export const getShareUrl = async (fileId: string): Promise<{ shareUrl: string }> => {
    const response = await api<any>(`/files/${fileId}/share`);
    return { shareUrl: response.share_url };
};
