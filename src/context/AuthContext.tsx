import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { authService } from "@/services/authService";
import type { User, Role } from "@/types/domain";

interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
}

interface AuthContextValue extends AuthState {
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    signUp: (name: string, email: string, password: string, majorId: string) => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth state persists to localStorage to survive page reloads.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>(() => {
        const saved = localStorage.getItem("mock_user_session") || sessionStorage.getItem("mock_user_session");
        return {
            user: saved ? JSON.parse(saved) : null,
            isLoading: false,
            error: null,
        };
    });

    const signIn = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { user } = await authService.signIn({ email, password, rememberMe });
            const newUser = {
                id: user.id,
                email,
                displayName: user.name, // Note: backend uses 'name'
                role: user.role as Role,
                avatarInitials: user.name.charAt(0).toUpperCase(),
                majorId: user.major_id,
                totalPoints: user.totalPoints ?? user.total_points,
                createdAt: user.createdAt ?? user.created_at
            };
            if (rememberMe) {
                localStorage.setItem("mock_user_session", JSON.stringify(newUser));
                sessionStorage.removeItem("mock_user_session");
            } else {
                sessionStorage.setItem("mock_user_session", JSON.stringify(newUser));
                localStorage.removeItem("mock_user_session");
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

    const signUp = useCallback(async (name: string, email: string, password: string, majorId: string) => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            // 1. Create the account in Neon and Auth0
            await authService.signUp({ name, email, password, majorId });

            // Just clear the loading state. 
            // Your React UI (like SignUpForm.tsx) can now catch this success 
            // and redirect them to a "Check Your Email!" success screen. 
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
            console.error("Failed to sign out from server", error);
        } finally {
            // Wipe frontend state regardless
            localStorage.removeItem("mock_user_session");
            sessionStorage.removeItem("mock_user_session");
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
