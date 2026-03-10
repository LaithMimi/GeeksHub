export type AuthError = {
    message: string;
    field?: string;
};

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const API_URL = "http://localhost:8000/api/v1";

export const authService = {
    signIn: async ({ email, password }: Record<string, any>) => {
        const response = await fetch(`${API_URL}/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include' // [backend update] Important for sending cookies
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw { message: "Please check your email to verify your account before logging in." };
            }

            const errorData = await response.json();
            let errorMessage = "Login failed";
            if (errorData.detail) {
                if (Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
                } else if (typeof errorData.detail === 'object') {
                    errorMessage = errorData.detail.msg || JSON.stringify(errorData.detail);
                } else {
                    errorMessage = String(errorData.detail);
                }
            }
            throw { message: errorMessage };
        }

        const data = await response.json();

        // Token is now set securely via HttpOnly cookie by the backend
        // We only need to return the user payload to populate the app state
        return {
            user: data.user
        };
    },

    signUp: async ({ name, email, password, majorId }: Record<string, string>) => {
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: name,
                email,
                password,
                password_confirm: password,
                major_id: majorId
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = "Signup failed";
            if (errorData.detail) {
                if (Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
                } else if (typeof errorData.detail === 'object') {
                    errorMessage = errorData.detail.msg || JSON.stringify(errorData.detail);
                } else {
                    errorMessage = String(errorData.detail);
                }
            }
            throw { message: errorMessage };
        }

        return await response.json();
    },


    // [backend update] Signout now calls the API to clear the cookie on the server side
    signOut: async () => {
        try {
            const response = await fetch(`${API_URL}/signout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // VERY IMPORTANT: This tells the browser to send the cookie 
                // so the backend knows which session to destroy!
                credentials: 'include',
            });

            if (!response.ok) {
                console.warn("Server-side signout returned an error, clearing local state anyway.");
            }

            return { success: true };
        } catch (error) {
            console.error("Network error during signout:", error);
            // We still return success so the AuthContext clears the frontend UI
            return { success: true };
        }
    },



    requestPasswordReset: async (email: string) => {
        const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to request password reset");
        }

        return response.json();
    },

    confirmPasswordReset: async ({ token, password }: Record<string, string>) => {
        await delay(600);
        if (token === "invalid") throw { message: "Invalid or expired token." };
        if (password.length < 8) throw { message: "Password must be at least 8 characters." };
        return { success: true, message: "Password has been reset successfully." };
    }
};
