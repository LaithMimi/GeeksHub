import { api } from "@/lib/apiClient";
import type { ViewerHeartbeatResponse } from "@/types/domain";

/**
 * ============================================================================
 * GAMIFICATION SERVICE
 * ============================================================================
 * Handles the session and heartbeat tracking for both the overall platform
 * (25-minute intervals) and individual file viewing sessions (completion scores).
 */

// ─── Viewer Sessions (File Level) ──────────────────────────────────────────

export const startViewerSession = async (fileId: string): Promise<{
    sessionId: string;
    totalPages: number;
    requiredActiveSeconds: number;
    fileType: string;
}> => {
    return await api("/me/viewer/session-start", {
        method: "POST",
        body: JSON.stringify({ file_id: fileId }),
    });
};

export const sendViewerHeartbeat = async (
    sessionId: string,
    visitedPages: number[],
    activeSeconds: number
): Promise<ViewerHeartbeatResponse> => {
    // Transform JS to backend snake_case
    const response = await api<any>("/me/viewer/heartbeat", {
        method: "POST",
        body: JSON.stringify({
            session_id: sessionId,
            visited_pages: visitedPages,
            active_seconds: activeSeconds,
        }),
    });

    // Map snake_case to camelCase Domain Type
    return {
        sessionId: response.sessionId,
        completionScore: response.completionScore,
        isComplete: response.isComplete,
        pointsAwarded: response.pointsAwarded,
        courseCompleted: response.courseCompleted,
        courseId: response.courseId,
        motivationalQuote: response.motivationalQuote,
        breakReminder: response.breakReminder,
        nextIntervalIn: response.nextIntervalIn,
    };
};

export const endViewerSession = async (sessionId: string): Promise<void> => {
    await api("/me/viewer/session-end", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
    });
};
