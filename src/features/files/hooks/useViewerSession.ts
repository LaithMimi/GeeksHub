import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useActivityTracker } from "@/shared/hooks/useActivityTracker";
import { logger } from "@/lib/logger";
import {
    useViewerSessionStart,
    useViewerHeartbeat,
    useViewerSessionEnd,
} from "@/features/gamification/hooks/useGamification";

const VIEWER_HEARTBEAT_INTERVAL_MS = 5 * 1000; // 5 seconds
const VIEWER_IDLE_TIMEOUT_MS = 60 * 1000; // 1 minute idle within viewer

export const useViewerSession = (fileId: string, currentPage: number) => {
    const { user } = useAuth();
    const { mutateAsync: startSession } = useViewerSessionStart();
    const { mutateAsync: sendHeartbeat } = useViewerHeartbeat();
    const { mutateAsync: endSession } = useViewerSessionEnd();

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [viewerEvents, setViewerEvents] = useState({
        completed: false,
        pointsAwarded: 0,
        courseCompleted: false,
        motivationalQuote: null as string | null,
    });

    const visitedPagesRef = useRef<Set<number>>(new Set([currentPage]));
    const activeSecondsRef = useRef<number>(0);
    const lastActivityRef = useActivityTracker(!!user);
    const intervalRef = useRef<number | null>(null);
    const isCompletedRef = useRef(false);

    // Reset per-file tracking when the viewer switches files without remounting
    // (route param change). Without this, a previous file's visited pages, active
    // seconds and "completed" flag leak into the next file's heartbeats — so the
    // next file never awards its completion points.
    useEffect(() => {
        visitedPagesRef.current = new Set();
        activeSecondsRef.current = 0;
        isCompletedRef.current = false;
        setViewerEvents({
            completed: false,
            pointsAwarded: 0,
            courseCompleted: false,
            motivationalQuote: null,
        });
    }, [fileId]);

    // Track visited pages (also re-adds the current page after a fileId reset)
    useEffect(() => {
        if (currentPage > 0) {
            visitedPagesRef.current.add(currentPage);
            lastActivityRef.current = Date.now(); // Page change is activity
        }
    }, [currentPage, fileId, lastActivityRef]);

    // Session lifecycle
    useEffect(() => {
        if (!user || !fileId) return;

        let activeSessionId: string | null = null;
        let isMounted = true;

        const initializeSession = async () => {
            try {
                // Wait a brief moment to avoid rapid mount/unmount thrashing
                await new Promise((r) => setTimeout(r, 500));
                if (!isMounted) return;

                const res = await startSession(fileId);
                if (!isMounted) return;

                activeSessionId = res.sessionId;
                setSessionId(activeSessionId);

                // Start viewer heartbeat loop
                intervalRef.current = window.setInterval(async () => {
                    if (!activeSessionId) return;

                    const timeSinceLastActivity = Date.now() - lastActivityRef.current;
                    const isActive = timeSinceLastActivity < VIEWER_IDLE_TIMEOUT_MS;

                    if (isActive) {
                        // Increment internal active second counter (5s per heartbeat interval)
                        activeSecondsRef.current += 5;

                        try {
                            const hbRes = await sendHeartbeat({
                                sessionId: activeSessionId,
                                visitedPages: Array.from(visitedPagesRef.current),
                                activeSeconds: activeSecondsRef.current,
                            });

                            if (!isMounted) return;

                            if (hbRes.isComplete && !isCompletedRef.current) {
                                isCompletedRef.current = true;
                                setViewerEvents({
                                    completed: hbRes.isComplete,
                                    pointsAwarded: hbRes.pointsAwarded,
                                    courseCompleted: hbRes.courseCompleted,
                                    motivationalQuote: hbRes.motivationalQuote,
                                });
                            }
                        } catch (err) {
                            logger.error("Viewer heartbeat failed:", err);
                        }
                    }
                }, VIEWER_HEARTBEAT_INTERVAL_MS);
            } catch (err) {
                logger.error("Failed to start viewer session:", err);
            }
        };

        initializeSession();

        return () => {
            isMounted = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (activeSessionId) {
                endSession(activeSessionId).catch((err) => logger.error("Failed to end viewer session:", err));
            }
        };
    }, [fileId, user, startSession, sendHeartbeat, endSession]);

    return {
        sessionId,
        ...viewerEvents,
    };
};
