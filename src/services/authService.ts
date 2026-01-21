export type AuthError = {
    message: string;
    field?: string;
};

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// const API_URL = "http://localhost:8000/api/v1";

export const authService = {
    signIn: async ({ email, password }: Record<string, string>) => {
        // --- REAL IMPLEMENTATION ---
        // const response = await fetch(`${API_URL}/signin`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ email, password }),
        // });
        // 
        // if (!response.ok) {
        //     const errorData = await response.json();
        //     throw { message: errorData.detail || "Login failed" };
        // }
        // 
        // const tokenData = await response.json();
        // // Store token (e.g., localStorage or cookie)
        // localStorage.setItem('token', tokenData.access_token);
        // return { user: { email } }; // Adjust return based on actual response or fetch user data
        // ---------------------------

        await delay(600); // Simulate network
        // Mock check
        if (password === "error") throw { message: "Simulated error" };
        if (email === "error@example.com") {
            throw { message: "Invalid email or password." };
        }
        return { user: { name: "Demo User", email } };
    },

    signUp: async ({ name, email, password }: Record<string, string>) => {
        // --- REAL IMPLEMENTATION ---
        // const response = await fetch(`${API_URL}/signup`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ username: name, email, password }),
        // });
        //
        // if (!response.ok) {
        //     const errorData = await response.json();
        //     throw { message: errorData.detail || "Signup failed" };
        // }
        //
        // return await response.json();
        // ---------------------------

        await delay(800);
        if (email === "taken@example.com") {
            throw { message: "This email is already in use.", field: "email" };
        }
        return { user: { name, email } };
    },

    requestPasswordReset: async ({ email }: { email: string }) => {
        // --- REAL IMPLEMENTATION ---
        // // Note: Backend does not seemingly have a direct reset password endpoint yet, 
        // // usually handled by Auth0 directly or a specific /forgot-password endpoint.
        // const response = await fetch(`${API_URL}/forgot-password`, {
        //    method: 'POST',
        //    headers: { 'Content-Type': 'application/json' },
        //    body: JSON.stringify({ email })
        // });
        // if (!response.ok) throw new Error("Failed to send reset link");
        // return await response.json();
        // ---------------------------

        await delay(400);
        // Always return success for security (unless specific validation fails)
        return { success: true, message: "If an account exists, a reset link has been sent." };
    },

    confirmPasswordReset: async ({ token, password }: Record<string, string>) => {
        await delay(600);
        if (token === "invalid") throw { message: "Invalid or expired token." };
        // Simulate password validation
        if (password.length < 8) throw { message: "Password must be at least 8 characters." };
        return { success: true, message: "Password has been reset successfully." };
    }
};
