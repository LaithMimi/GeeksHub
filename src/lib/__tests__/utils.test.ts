import { describe, it, expect } from "vitest";
import { snakeToCamel } from "@/lib/apiClient";
import { getGreeting, formatDeadline } from "@/lib/utils";
import { format, addDays, subDays } from "date-fns";

describe("snakeToCamel", () => {
    it("converts a flat object", () => {
        expect(snakeToCamel({ total_points: 10, created_at: "2024" }))
            .toEqual({ totalPoints: 10, createdAt: "2024" });
    });

    it("converts nested objects", () => {
        expect(snakeToCamel({ user_data: { major_id: "cs" } }))
            .toEqual({ userData: { majorId: "cs" } });
    });

    it("leaves already-camelCase keys unchanged", () => {
        expect(snakeToCamel({ totalPoints: 10 })).toEqual({ totalPoints: 10 });
    });

    it("walks arrays of objects", () => {
        expect(snakeToCamel([{ first_name: "a" }, { first_name: "b" }]))
            .toEqual([{ firstName: "a" }, { firstName: "b" }]);
    });

    it("preserves primitives and null", () => {
        expect(snakeToCamel(null)).toBeNull();
        expect(snakeToCamel(42)).toBe(42);
        expect(snakeToCamel("hi")).toBe("hi");
    });

    it("does not mangle Date instances", () => {
        const d = new Date("2024-01-01");
        expect(snakeToCamel(d)).toBe(d);
    });
});

describe("getGreeting", () => {
    it("returns 'Good morning' before noon", () => {
        expect(getGreeting(9)).toBe("Good morning");
    });

    it("returns 'Good afternoon' between noon and 5pm", () => {
        expect(getGreeting(14)).toBe("Good afternoon");
    });

    it("returns 'Good evening' after 5pm", () => {
        expect(getGreeting(20)).toBe("Good evening");
    });

    it("returns a known greeting when called with no argument", () => {
        expect(["Good morning", "Good afternoon", "Good evening"]).toContain(getGreeting());
    });
});

describe("formatDeadline", () => {
    it("returns 'Due Today' for today", () => {
        const today = format(new Date(), "yyyy-MM-dd");
        expect(formatDeadline(today)).toEqual({ label: "Due Today", urgent: true });
    });

    it("returns 'Due Tomorrow' for tomorrow", () => {
        const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
        expect(formatDeadline(tomorrow)).toEqual({ label: "Due Tomorrow", urgent: true });
    });

    it("marks past dates as Overdue", () => {
        const past = format(subDays(new Date(), 3), "yyyy-MM-dd");
        const result = formatDeadline(past);
        expect(result.urgent).toBe(true);
        expect(result.label).toMatch(/^Overdue/);
    });

    it("returns a non-urgent label for future dates beyond tomorrow", () => {
        const future = format(addDays(new Date(), 10), "yyyy-MM-dd");
        const result = formatDeadline(future);
        expect(result.urgent).toBe(false);
        expect(result.label).toBeTruthy();
    });
});
