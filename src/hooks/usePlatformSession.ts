import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    usePlatformSessionStart,
    usePlatformHeartbeat,
    usePlatformSessionEnd,
} from "@/queries/useGamification";

const PLATFORM_HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of no activity

export const usePlatformSession = () => {
    const { user } = useAuth();
    const { mutateAsync: startSession } = usePlatformSessionStart();
    const { mutateAsync: sendHeartbeat } = usePlatformHeartbeat();
    const { mutateAsync: endSession } = usePlatformSessionEnd();

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [pointsAwarded, setPointsAwarded] = useState<number>(0);
    const [breakReminder, setBreakReminder] = useState<boolean>(false);
    
    const lastActivityRef = useRef<number>(Date.now());
    const intervalRef = useRef<number | null>(null);

    // Track user activity
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
        if (!user) return;

        let activeSessionId: string | null = null;
        let isMounted = true;

        const initializeSession = async () => {
            try {
                const res = await startSession();
                if (!isMounted) return;
                
                activeSessionId = res.sessionId;
                setSessionId(activeSessionId);

                // Start heartbeat loop
                intervalRef.current = window.setInterval(async () => {
                    if (!activeSessionId) return;

                    const timeSinceLastActivity = Date.now() - lastActivityRef.current;
                    if (timeSinceLastActivity < IDLE_TIMEOUT_MS) {
                        try {
                            const hbRes = await sendHeartbeat(activeSessionId);
                            setPointsAwarded(hbRes.pointsAwarded);
                            setBreakReminder(hbRes.breakReminder);
                        } catch (err) {
                            console.error("Platform heartbeat failed:", err);
                        }
                    } else {
                        console.log("Platform session idle, skipping heartbeat.");
                    }
                }, PLATFORM_HEARTBEAT_INTERVAL_MS);
            } catch (err) {
                console.error("Failed to start platform session:", err);
            }
        };

        initializeSession();

        return () => {
            isMounted = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (activeSessionId) {
                // Fire and forget termination
                endSession(activeSessionId).catch(console.error);
            }
        };
    }, [user, startSession, sendHeartbeat, endSession]);

    return {
        sessionId,
        pointsAwarded,
        breakReminder,
    };
};
