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
    // The API client now auto-converts snake_case to camelCase
    return {
        major: response.major,
        years: response.years.map((year: any) => ({
            yearId: year.yearId,
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
                    hasFiles: course.hasFiles,
                    status: course.status,
                    filesCompleted: course.filesCompleted,
                    totalFiles: course.totalFiles,
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
    return await api<ActivitySummary>("/me/activity/summary");
};

/**
 * Fetches the canonical share URL for a file (no auth required).
 * @backend GET /api/v1/files/:file_id/share
 */
export const getShareUrl = async (fileId: string): Promise<{ shareUrl: string }> => {
    return await api<{ shareUrl: string }>(`/files/${fileId}/share`);
};
