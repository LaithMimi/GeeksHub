import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    startViewerSession,
    sendViewerHeartbeat,
    endViewerSession,
} from "@/features/gamification/api/gamificationService";
import type { ViewerHeartbeatResponse } from "@/types/domain";
import { queryKeys } from "@/lib/queryKeys";

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
    const queryClient = useQueryClient();
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
        onSuccess: (data) => {
            // A heartbeat can cross the 85% completion threshold and bump the course's
            // status to "engaged"/"completed" server-side — refresh the dashboard's
            // Courses Active / files-completed counters right away when that happens.
            if (data.isComplete) {
                queryClient.invalidateQueries({ queryKey: queryKeys.activity.summary() });
            }
        },
    });
};

export const useViewerSessionEnd = () => {
    return useMutation({
        mutationFn: (sessionId: string) => endViewerSession(sessionId),
    });
};
