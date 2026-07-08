import { describe, it, expect } from "vitest";
import { normalizeError } from "@/lib/errors";
import { ApiError } from "@/lib/apiClient";

describe("normalizeError — HTTP status → kind mapping", () => {
    const cases: Array<[number, string]> = [
        [401, "authentication"],
        [403, "authorization"],
        [404, "notFound"],
        [409, "conflict"],
        [429, "rateLimit"],
        [402, "payment"],
        [422, "validation"],
        [400, "validation"],
        [500, "server"],
        [503, "server"],
    ];

    it.each(cases)("maps status %i to kind '%s'", (status, kind) => {
        const n = normalizeError(new ApiError(status, "raw", { detail: "raw detail" }));
        expect(n.kind).toBe(kind);
        // Never empty, always actionable.
        expect(n.title.length).toBeGreaterThan(0);
        expect(n.message.length).toBeGreaterThan(0);
    });
});

describe("normalizeError — transport & unknown", () => {
    it("treats a status-0 ApiError as a network error with retry", () => {
        const n = normalizeError(new ApiError(0, "Network request failed"));
        expect(n.kind).toBe("network");
        expect(n.retryable).toBe(true);
        expect(n.message.toLowerCase()).toContain("connection");
    });

    it("treats a fetch TypeError as a network error", () => {
        const n = normalizeError(new TypeError("Failed to fetch"));
        expect(n.kind).toBe("network");
    });

    it("falls back to a safe unknown message for a plain string throw", () => {
        const n = normalizeError("boom");
        expect(n.kind).toBe("unknown");
        expect(n.message).toBeTruthy();
    });
});

describe("normalizeError — validation field extraction", () => {
    it("pulls { field: message } out of a FastAPI 422 body and camelCases keys", () => {
        const n = normalizeError(
            new ApiError(422, "Unprocessable", {
                detail: [
                    { loc: ["body", "email"], msg: "value is not a valid email address" },
                    { loc: ["body", "password_confirm"], msg: "field required" },
                ],
            }),
        );
        expect(n.kind).toBe("validation");
        expect(n.fieldErrors?.email).toContain("valid email");
        expect(n.fieldErrors?.passwordConfirm).toBe("This field is required.");
    });
});

describe("normalizeError — sanitization & rewrites", () => {
    it("rewrites a raw credential error into a friendly one", () => {
        const n = normalizeError(new ApiError(401, "x", { detail: "Wrong email or password" }));
        expect(n.message.toLowerCase()).toContain("email or password");
        expect(n.message.toLowerCase()).not.toContain("wrong email or password");
    });

    it("suppresses leaked internals (SQL / tracebacks) in favour of a safe default", () => {
        const n = normalizeError(
            new ApiError(500, "x", { detail: "IntegrityError: null value in column 'id' violates not-null" }),
        );
        expect(n.message).not.toContain("IntegrityError");
        expect(n.message).not.toContain("null value");
        // The safe server-error default is used instead.
        expect(n.kind).toBe("server");
    });

    it("honours a context hint to upgrade a generic bucket", () => {
        const n = normalizeError(new ApiError(400, "x", {}), { context: "upload" });
        expect(n.kind).toBe("upload");
    });

    it("uses a provided fallbackMessage when no safe backend message exists", () => {
        const n = normalizeError(new ApiError(500, "x", {}), { fallbackMessage: "Custom fallback." });
        expect(n.message).toBe("Custom fallback.");
    });
});
