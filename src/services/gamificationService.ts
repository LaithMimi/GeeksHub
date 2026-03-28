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
    // api wrapper automatically transforms JSON to camelCase
    return await api<ViewerHeartbeatResponse>("/me/viewer/heartbeat", {
        method: "POST",
        body: JSON.stringify({
            session_id: sessionId,
            visited_pages: visitedPages,
            active_seconds: activeSeconds,
        }),
    });
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
    return await api<{ sessionId: string; activeSeconds: number }>("/me/session/start", { method: "POST" });
};

export const sendPlatformHeartbeat = async (sessionId: string): Promise<PlatformHeartbeatResponse> => {
    return await api<PlatformHeartbeatResponse>("/me/session/heartbeat", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
    });
};

export const endPlatformSession = async (sessionId: string): Promise<void> => {
    await api("/me/session/end", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
    });
};
