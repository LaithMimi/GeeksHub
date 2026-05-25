import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { authService, type AuthUserDTO } from "@/services/authService";
import { SESSION_KEY } from "@/lib/constants";
import { ApiError } from "@/lib/apiClient";
import { logger } from "@/lib/logger";
import type { User, Role } from "@/types/domain";

interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
}

interface AuthContextValue extends AuthState {
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    signUp: (name: string, email: string, password: string, confirmPassword: string, majorId: string) => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Build the UI User model from the server's auth DTO. */
function mapUser(dto: AuthUserDTO): User {
    return {
        id: dto.id,
        email: dto.email,
        displayName: dto.name,
        role: dto.role as Role,
        avatarInitials: dto.name.charAt(0).toUpperCase(),
        majorId: dto.majorId,
        totalPoints: dto.totalPoints,
        createdAt: dto.createdAt,
    };
}

/**
 * Safely read & validate the persisted session. Returns null (and clears the
 * offending entry) on malformed JSON so a corrupted or maliciously crafted
 * value can't crash app boot.
 */
function readStoredSession(): User | null {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<User>;
        if (!parsed || typeof parsed.id !== "string" || typeof parsed.role !== "string") {
            throw new Error("Invalid session shape");
        }
        return parsed as User;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    }
}

/** Persist to whichever storage already holds the session (defaults to session). */
function persistUser(user: User): void {
    const storage = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
    // Optimistically render from cache, but start in a loading state so the
    // server verification below resolves before protected routes are trusted.
    const [state, setState] = useState<AuthState>(() => ({
        user: readStoredSession(),
        isLoading: true,
        error: null,
    }));

    // Boot reconciliation: the server derives identity & role from the HttpOnly
    // JWT cookie, so a tampered localStorage role can never grant access — the
    // authoritative role from /me always overwrites the cached one.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const verified = mapUser(await authService.getMe());
                if (cancelled) return;
                persistUser(verified);
                setState({ user: verified, isLoading: false, error: null });
            } catch (err) {
                if (cancelled) return;
                if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                    // Session is invalid/expired — drop any cached identity.
                    localStorage.removeItem(SESSION_KEY);
                    sessionStorage.removeItem(SESSION_KEY);
                    setState({ user: null, isLoading: false, error: null });
                } else {
                    // Network/server error: keep the optimistic cached user (data
                    // endpoints still enforce auth & role server-side) but stop loading.
                    logger.warn("Session verification failed; using cached session", err);
                    setState((s) => ({ ...s, isLoading: false }));
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const signIn = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { user } = await authService.signIn({ email, password, rememberMe });
            const newUser = mapUser(user);
            if (rememberMe) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
                sessionStorage.removeItem(SESSION_KEY);
            } else {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
                localStorage.removeItem(SESSION_KEY);
            }
            setState({
                user: newUser,
                isLoading: false,
                error: null,
            });
        } catch (err: any) {
            setState((s) => ({ ...s, isLoading: false, error: err.message || "An error occurred" }));
            throw err;
        }
    }, []);

    const signUp = useCallback(async (name: string, email: string, password: string, confirmPassword: string, majorId: string) => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            // Create the account in Neon and Auth0. We don't auto-login because
            // email verification is required first.
            await authService.signUp({ name, email, password, passwordConfirm: confirmPassword, majorId });
            setState((s) => ({ ...s, isLoading: false }));
        } catch (err: any) {
            setState((s) => ({ ...s, isLoading: false, error: err.message || "An error occurred" }));
            throw err;
        }
    }, []);

    const signOut = useCallback(async () => {
        try {
            // Tell the backend to delete the HttpOnly cookie
            await authService.signOut();
        } catch (error) {
            logger.error("Failed to sign out from server", error);
        } finally {
            // Wipe frontend state regardless
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            setState({ user: null, isLoading: false, error: null });
        }
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
