import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    useViewerSessionStart,
    useViewerHeartbeat,
    useViewerSessionEnd,
} from "@/queries/useGamification";

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
    const lastActivityRef = useRef<number>(Date.now());
    const intervalRef = useRef<number | null>(null);

    // Track visited pages
    useEffect(() => {
        if (currentPage > 0) {
            visitedPagesRef.current.add(currentPage);
            lastActivityRef.current = Date.now(); // Page change is activity
        }
    }, [currentPage]);

    // Track user activity in window
    useEffect(() => {
        if (!user) return;

        const handleActivity = () => {
            lastActivityRef.current = Date.now();
        };

        window.addEventListener("mousemove", handleActivity);
        window.addEventListener("keydown", handleActivity);
        window.addEventListener("click", handleActivity);
        window.addEventListener("scroll", handleActivity);

        return () => {
            window.removeEventListener("mousemove", handleActivity);
            window.removeEventListener("keydown", handleActivity);
            window.removeEventListener("click", handleActivity);
            window.removeEventListener("scroll", handleActivity);
        };
    }, [user]);

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

                            if (hbRes.isComplete && !viewerEvents.completed) {
                                setViewerEvents({
                                    completed: hbRes.isComplete,
                                    pointsAwarded: hbRes.pointsAwarded,
                                    courseCompleted: hbRes.courseCompleted,
                                    motivationalQuote: hbRes.motivationalQuote,
                                });
                            }
                        } catch (err) {
                            console.error("Viewer heartbeat failed:", err);
                        }
                    }
                }, VIEWER_HEARTBEAT_INTERVAL_MS);
            } catch (err) {
                console.error("Failed to start viewer session:", err);
            }
        };

        initializeSession();

        return () => {
            isMounted = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (activeSessionId) {
                endSession(activeSessionId).catch(console.error);
            }
        };
    }, [fileId, user, startSession, sendHeartbeat, endSession]);

    return {
        sessionId,
        ...viewerEvents,
    };
};
