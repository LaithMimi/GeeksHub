import { useEffect, useRef } from "react";

export function useActivityTracker(enabled: boolean) {
    const lastActivityRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!enabled) return;

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
    }, [enabled]);

    return lastActivityRef;
}
