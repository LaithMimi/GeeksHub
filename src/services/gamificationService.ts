import { api } from "@/lib/apiClient";
import type { ViewerHeartbeatResponse, PlatformHeartbeatResponse } from "@/types/domain";

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
        sessionId: response.session_id,
        completionScore: response.completion_score,
        isComplete: response.is_complete,
        pointsAwarded: response.points_awarded,
        courseCompleted: response.course_completed,
        courseId: response.course_id,
        motivationalQuote: response.motivational_quote,
        breakReminder: response.break_reminder,
        nextIntervalIn: response.next_interval_in,
    };
};

export const endViewerSession = async (sessionId: string): Promise<void> => {
    await api("/me/viewer/session-end", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
    });
};

// ─── Platform Sessions (Global App Level) ──────────────────────────────────

export const startPlatformSession = async (): Promise<{
    sessionId: string;
    activeSeconds: number;
}> => {
    const response = await api<any>("/me/session/start", { method: "POST" });
    return {
        sessionId: response.session_id,
        activeSeconds: response.active_seconds,
    };
};

export const sendPlatformHeartbeat = async (sessionId: string): Promise<PlatformHeartbeatResponse> => {
    const response = await api<any>("/me/session/heartbeat", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
    });

    return {
        activeSeconds: response.active_seconds,
        pointsAwarded: response.points_awarded,
        breakReminder: response.break_reminder,
        nextIntervalIn: response.next_interval_in,
    };
};

export const endPlatformSession = async (sessionId: string): Promise<void> => {
    await api("/me/session/end", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
    });
};
