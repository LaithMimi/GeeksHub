import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export type AuthMode = "signIn" | "signUp" | "forgot";

export function useAuthMode() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize mode from URL or default to signIn
    const modeParam = searchParams.get("mode") as AuthMode;
    const initialMode = (["signIn", "signUp", "forgot"] as const).includes(modeParam)
        ? modeParam
        : "signIn";

    const [mode, setModeState] = useState<AuthMode>(initialMode);

    // Sync state -> URL
    useEffect(() => {
        const currentMode = searchParams.get("mode") as AuthMode;
        if (currentMode !== mode && (["signIn", "signUp", "forgot"] as const).includes(currentMode)) {
            setModeState(currentMode);
        }
    }, [searchParams, mode]);

    const setMode = (newMode: AuthMode) => {
        setModeState(newMode);
        setSearchParams({ mode: newMode });
    };

    return { mode, setMode };
}
