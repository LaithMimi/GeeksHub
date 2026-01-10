export type AuthError = {
    message: string;
    field?: string;
};

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
    signIn: async ({ email, password }: Record<string, string>) => {
        await delay(600); // Simulate network
        // Mock check
        if (password === "error") throw { message: "Simulated error" };
        if (email === "error@example.com") {
            throw { message: "Invalid email or password." };
        }
        return { user: { name: "Demo User", email } };
    },

    signUp: async ({ name, email }: Record<string, string>) => {
        await delay(800);
        if (email === "taken@example.com") {
            throw { message: "This email is already in use.", field: "email" };
        }
        return { user: { name, email } };
    },

    requestPasswordReset: async ({ email }: { email: string }) => {
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
