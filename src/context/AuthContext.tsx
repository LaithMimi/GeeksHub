import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { authService } from "@/services/authService";
import type { User, Role } from "@/types/domain";

interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
}

interface AuthContextValue extends AuthState {
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (name: string, email: string, password: string) => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth state persists to localStorage to survive page reloads.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>(() => {
        const saved = localStorage.getItem("mock_user_session");
        return {
            user: saved ? JSON.parse(saved) : null,
            isLoading: false,
            error: null,
        };
    });

    const signIn = useCallback(async (email: string, password: string) => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const {user, token} = await authService.signIn({ email, password }); // Removed { }
            const newUser = {
                id: user.id,
                email,
                displayName: user.name, // Note: backend uses 'name'
                role: user.role as Role,
                avatarInitials: user.name.charAt(0).toUpperCase()    
            };
            localStorage.setItem("mock_user_session", JSON.stringify(newUser));
            localStorage.setItem("token", token);
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

    const signUp = useCallback(async (name: string, email: string, password: string) => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const user = await authService.signUp({ name, email, password }); // Removed { }
            const newUser = {
                id: user.id,
                email,
                displayName: name,
                role: user.role as Role,
                avatarInitials: name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2),
            };
            localStorage.setItem("mock_user_session", JSON.stringify(newUser));
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

    const signOut = useCallback(() => {
        localStorage.removeItem("mock_user_session");
        setState({ user: null, isLoading: false, error: null });
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
