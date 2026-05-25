import { api, ApiError } from "@/lib/apiClient";
import { logger } from "@/lib/logger";
import type { Role } from "@/types/domain";

export type AuthError = {
    message: string;
    field?: string;
};

/** Shape returned by /signin after snake_case→camelCase conversion. */
export interface AuthUserDTO {
    id: string;
    name: string;
    email: string;
    role: Role;
    majorId?: string;
    totalPoints?: number;
    createdAt?: string;
}

export interface SignInResponse {
    user: AuthUserDTO;
}

export interface SignUpResponse {
    user: AuthUserDTO;
}

interface ValidationErrorItem {
    msg?: string;
    [key: string]: unknown;
}

/**
 * Extract a human-readable message from an ApiError's `data` payload.
 * Handles FastAPI's `{ detail: string | { msg } | [{ msg }] }` envelope plus
 * Auth0's `{ error_description }` payload. No string parsing.
 */
function extractAuthErrorMessage(err: unknown, fallback: string): string {
    if (!(err instanceof ApiError)) {
        return err instanceof Error ? err.message : fallback;
    }

    const data = err.data as
        | { detail?: string | ValidationErrorItem | ValidationErrorItem[]; error_description?: string; message?: string }
        | undefined;

    if (data?.detail) {
        const { detail } = data;
        if (Array.isArray(detail)) {
            return detail.map((d) => d.msg ?? JSON.stringify(d)).join(", ");
        }
        if (typeof detail === "object") {
            return detail.msg ?? JSON.stringify(detail);
        }
        if (typeof detail === "string") {
            if (detail.includes("Wrong email or password")) return "Invalid email or password.";
            if (detail.includes("Too Many Requests") || detail.includes("429")) {
                return "Too many failed attempts. Please try again later.";
            }
            if (detail.includes("PasswordStrengthError")) {
                return "Password is too weak. It must be at least 8 characters and include a number, an uppercase letter, and a lowercase letter.";
            }
            return detail;
        }
    }

    if (data?.error_description) {
        return data.error_description.includes("Wrong email or password")
            ? "Invalid email or password."
            : data.error_description;
    }

    return data?.message ?? err.message ?? fallback;
}

export interface SignInPayload {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface SignUpPayload {
    name: string;
    email: string;
    password: string;
    passwordConfirm: string;
    majorId: string;
}

export const authService = {
    signIn: async ({ email, password }: SignInPayload): Promise<SignInResponse> => {
        try {
            const data = await api<SignInResponse>("/signin", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });
            return { user: data.user };
        } catch (err: unknown) {
            if (err instanceof ApiError && err.status === 403) {
                throw { message: "Please check your email to verify your account before logging in." };
            }
            throw { message: extractAuthErrorMessage(err, "Login failed") };
        }
    },

    signUp: async ({ name, email, password, passwordConfirm, majorId }: SignUpPayload): Promise<SignUpResponse> => {
        try {
            return await api<SignUpResponse>("/signup", {
                method: "POST",
                body: JSON.stringify({
                    username: name,
                    email,
                    password,
                    password_confirm: passwordConfirm,
                    major_id: majorId,
                }),
            });
        } catch (err: unknown) {
            throw { message: extractAuthErrorMessage(err, "Signup failed") };
        }
    },

    /**
     * Fetches the authenticated user from the server, which derives identity
     * and role from the HttpOnly JWT cookie. This is the authoritative source
     * of the user's role — never trust the role cached in localStorage.
     */
    getMe: async (): Promise<AuthUserDTO> => {
        return api<AuthUserDTO>("/me");
    },

    signOut: async (): Promise<{ success: true }> => {
        try {
            await api<unknown>("/signout", { method: "POST" });
        } catch (error) {
            logger.error("Network error during signout:", error);
        }
        return { success: true };
    },

    requestPasswordReset: async (email: string): Promise<{ success: boolean; message?: string }> => {
        return await api<{ success: boolean; message?: string }>("/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    },

    confirmPasswordReset: async ({ token, password }: { token: string; password: string }): Promise<{ success: boolean; message: string }> => {
        return await api<{ success: boolean; message: string }>("/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, password }),
        });
    },
};
