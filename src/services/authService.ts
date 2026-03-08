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
            // MATCHES YOUR UserSignUp MODEL
            body: JSON.stringify({ 
                username: name, 
                email, 
                password, 
                password_confirm: password // temporarily using the same password for confirmation 
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw { message: errorData.detail || "Signup failed" };
        }

        return await response.json();
    },

    requestPasswordReset: async ({ email: _email }: { email: string }) => {
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
