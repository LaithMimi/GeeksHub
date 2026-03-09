export type AuthError = {
    message: string;
    field?: string;
};

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const API_URL = "http://localhost:8000/api/v1";

export const authService = {
    signIn: async ({ email, password }: Record<string, string>) => {
        const response = await fetch(`${API_URL}/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw { message: errorData.detail || "Login failed" };
        }

        const data = await response.json();

        // Save the real token to localStorage
        localStorage.setItem('token', data.token);

        // Return BOTH token and user to the AuthContext
        return {
            token: data.token,
            user: data.user
        };
    },

    signUp: async ({ name, email, password }: Record<string, string>) => {
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: name,
                email,
                password,
                password_confirm: password
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw { message: errorData.detail || "Signup failed" };
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
