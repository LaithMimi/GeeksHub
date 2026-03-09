export type AuthError = {
    message: string;
    field?: string;
};

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const API_URL = "http://localhost:8000/api/v1";

export const authService = {
    signIn: async ({ email, password, rememberMe = false }: Record<string, any>) => {
        const response = await fetch(`${API_URL}/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
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

        // Save the real token
        if (rememberMe) {
            localStorage.setItem('token', data.token);
            sessionStorage.removeItem('token');
        } else {
            sessionStorage.setItem('token', data.token);
            localStorage.removeItem('token');
        }

        // Return BOTH token and user to the AuthContext
        return {
            token: data.token,
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

    requestPasswordReset: async ({ email: _email }: { email: string }) => {
        await delay(400);
        return { success: true, message: "If an account exists, a reset link has been sent." };
    },

    confirmPasswordReset: async ({ token, password }: Record<string, string>) => {
        await delay(600);
        if (token === "invalid") throw { message: "Invalid or expired token." };
        if (password.length < 8) throw { message: "Password must be at least 8 characters." };
        return { success: true, message: "Password has been reset successfully." };
    }
};
