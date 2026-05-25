import { useMutation } from "@tanstack/react-query";
import {
    startViewerSession,
    sendViewerHeartbeat,
    endViewerSession,
} from "@/features/gamification/api/gamificationService";
import type { ViewerHeartbeatResponse } from "@/types/domain";

/**
 * ============================================================================
 * VIEWER SESSION HOOKS
 * ============================================================================
 */

export const useViewerSessionStart = () => {
    return useMutation({
        mutationFn: (fileId: string) => startViewerSession(fileId),
    });
};

export const useViewerHeartbeat = () => {
    return useMutation({
        mutationFn: ({
            sessionId,
            visitedPages,
            activeSeconds,
        }: {
            sessionId: string;
            visitedPages: number[];
            activeSeconds: number;
        }): Promise<ViewerHeartbeatResponse> =>
            sendViewerHeartbeat(sessionId, visitedPages, activeSeconds),
    });
};

export const useViewerSessionEnd = () => {
    return useMutation({
        mutationFn: (sessionId: string) => endViewerSession(sessionId),
    });
};
