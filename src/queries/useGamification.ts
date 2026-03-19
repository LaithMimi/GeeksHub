import { useMutation } from "@tanstack/react-query";
import {
    startViewerSession,
    sendViewerHeartbeat,
    endViewerSession,
    startPlatformSession,
    sendPlatformHeartbeat,
    endPlatformSession,
} from "@/services/gamificationService";
import type { ViewerHeartbeatResponse, PlatformHeartbeatResponse } from "@/types/domain";

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

/**
 * ============================================================================
 * PLATFORM SESSION HOOKS
 * ============================================================================
 */

export const usePlatformSessionStart = () => {
    return useMutation({
        mutationFn: () => startPlatformSession(),
    });
};

export const usePlatformHeartbeat = () => {
    return useMutation({
        mutationFn: (sessionId: string): Promise<PlatformHeartbeatResponse> =>
            sendPlatformHeartbeat(sessionId),
    });
};

export const usePlatformSessionEnd = () => {
    return useMutation({
        mutationFn: (sessionId: string) => endPlatformSession(sessionId),
    });
};
