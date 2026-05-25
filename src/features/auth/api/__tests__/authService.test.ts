import { describe, it, expect } from "vitest";
import { extractAuthErrorMessage } from "../authService";
import { ApiError } from "@/lib/apiClient";

describe("authService - extractAuthErrorMessage", () => {
    it("ApiError with detail: string → returns cleaned string", () => {
        const error = new ApiError(400, "Error", { detail: "Some error" });
        expect(extractAuthErrorMessage(error, "Fallback")).toBe("Some error");
    });

    it("ApiError with detail: [{ msg: '...' }] → joins msg array", () => {
        const error = new ApiError(400, "Error", { detail: [{ msg: "Error 1" }, { msg: "Error 2" }] });
        expect(extractAuthErrorMessage(error, "Fallback")).toBe("Error 1, Error 2");
    });

    it("ApiError with error_description → returns description", () => {
        const error = new ApiError(400, "Error", { error_description: "Auth0 error" });
        expect(extractAuthErrorMessage(error, "Fallback")).toBe("Auth0 error");
    });

    it("ApiError with status 429 / 'Too Many Requests' → returns rate-limit message", () => {
        const error1 = new ApiError(429, "Error", { detail: "429 Too Many Requests" });
        const error2 = new ApiError(400, "Error", { detail: "Too Many Requests" });
        
        expect(extractAuthErrorMessage(error1, "Fallback")).toBe("Too many failed attempts. Please try again later.");
        expect(extractAuthErrorMessage(error2, "Fallback")).toBe("Too many failed attempts. Please try again later.");
    });

    it("ApiError with PasswordStrengthError → returns strength message", () => {
        const error = new ApiError(400, "Error", { detail: "PasswordStrengthError: password too short" });
        expect(extractAuthErrorMessage(error, "Fallback")).toBe("Password is too weak. It must be at least 8 characters and include a number, an uppercase letter, and a lowercase letter.");
    });

    it("Non-ApiError Error → returns err.message", () => {
        const error = new Error("Standard error message");
        expect(extractAuthErrorMessage(error, "Fallback")).toBe("Standard error message");
    });

    it("Unknown thrown value → returns fallback", () => {
        const error = "String error";
        expect(extractAuthErrorMessage(error, "Fallback")).toBe("Fallback");
    });
});
