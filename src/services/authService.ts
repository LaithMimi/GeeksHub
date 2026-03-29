import { api } from "@/lib/apiClient";

export type AuthError = {
    message: string;
    field?: string;
};

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatAuthError = (errStr: string, defaultMsg: string): string => {
    if (typeof errStr !== "string") return defaultMsg;
    if (errStr.includes("Wrong email or password")) return "Invalid email or password.";
    if (errStr.includes("Too Many Requests") || errStr.includes("429")) return "Too many failed attempts. Please try again later.";

    try {
        const first = errStr.indexOf('{');
        const last = errStr.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
            const errData = JSON.parse(errStr.substring(first, last + 1));

            if (errData.error_description) {
                let msg = errData.error_description;
                if (msg.includes("Wrong email or password")) return "Invalid email or password.";
                return msg;
            }
            if (errData.message) {
                let msg = errData.message;
                if (msg.includes("PasswordStrengthError")) {
                    return "Password is too weak. It must be at least 8 characters and include a number, an uppercase letter, and a lowercase letter.";
                }
                return msg;
            }
        }
    } catch {
        // ignore JSON parse errors
    }

    return errStr || defaultMsg;
};

export const authService = {
    signIn: async ({ email, password }: Record<string, any>) => {
        try {
            const data = await api<any>("/signin", {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            return { user: data.user };
        } catch (err: any) {
            if (err.status === 403) {
                throw { message: "Please check your email to verify your account before logging in." };
            }
            let errorMessage = "Login failed";
            if (err.data?.detail) {
                if (Array.isArray(err.data.detail)) {
                    errorMessage = err.data.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
                } else if (typeof err.data.detail === 'object') {
                    errorMessage = err.data.detail.msg || JSON.stringify(err.data.detail);
                } else {
                    errorMessage = formatAuthError(String(err.data.detail), "Login failed");
                }
            } else if (err.message) {
                errorMessage = formatAuthError(err.message, "Login failed");
            }
            throw { message: errorMessage };
        }
    },

    signUp: async ({ name, email, password, majorId }: Record<string, string>) => {
        try {
            return await api<any>("/signup", {
                method: 'POST',
                body: JSON.stringify({
                    username: name,
                    email,
                    password,
                    password_confirm: password,
                    major_id: majorId
                }),
            });
        } catch (err: any) {
            let errorMessage = "Signup failed";
            if (err.data?.detail) {
                if (Array.isArray(err.data.detail)) {
                    errorMessage = err.data.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
                } else if (typeof err.data.detail === 'object') {
                    errorMessage = err.data.detail.msg || JSON.stringify(err.data.detail);
                } else {
                    errorMessage = formatAuthError(String(err.data.detail), "Signup failed");
                }
            } else if (err.message) {
                errorMessage = formatAuthError(err.message, "Signup failed");
            }
            throw { message: errorMessage };
        }
    },

    signOut: async () => {
        try {
            await api<any>("/signout", {
                method: 'POST',
            });
            return { success: true };
        } catch (error) {
            console.error("Network error during signout:", error);
            return { success: true };
        }
    },

    requestPasswordReset: async (email: string) => {
        return await api<any>("/forgot-password", {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    confirmPasswordReset: async ({ token, password }: Record<string, string>) => {
        await delay(600);
        if (token === "invalid") throw { message: "Invalid or expired token." };
        if (password.length < 8) throw { message: "Password must be at least 8 characters." };
        return { success: true, message: "Password has been reset successfully." };
    }
};

