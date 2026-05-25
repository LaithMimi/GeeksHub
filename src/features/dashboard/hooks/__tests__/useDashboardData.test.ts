import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDashboardData } from "../useDashboardData";
import type { Course, Major, FileRequest } from "@/types/domain";

describe("useDashboardData", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // May 15, 2024 is a Wednesday.
        vi.setSystemTime(new Date("2024-05-15T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("recentCourses", () => {
        it("deduplicates by courseId, returns max 3", () => {
            const recentFiles = [
                { id: "f1", courseId: "c1", title: "F1", viewedAt: "2024-05-15T10:00:00Z" },
                { id: "f2", courseId: "c1", title: "F2", viewedAt: "2024-05-15T09:00:00Z" },
                { id: "f3", courseId: "c2", title: "F3", viewedAt: "2024-05-15T08:00:00Z" },
                { id: "f4", courseId: "c3", title: "F4", viewedAt: "2024-05-15T07:00:00Z" },
                { id: "f5", courseId: "c4", title: "F5", viewedAt: "2024-05-15T06:00:00Z" },
            ];

            const { result } = renderHook(() => useDashboardData(recentFiles, [], [], []));

            expect(result.current.recentCourses).toHaveLength(3);
            expect(result.current.recentCourses.map(c => c.id)).toEqual(["c1", "c2", "c3"]);
        });

        it("maps course name fallback to courseId when allCourses is undefined", () => {
            const recentFiles = [
                { id: "f1", courseId: "c1", title: "F1", viewedAt: "2024-05-15T10:00:00Z" },
            ];
            
            const { result } = renderHook(() => useDashboardData(recentFiles, [], undefined, undefined));
            
            expect(result.current.recentCourses[0].name).toBe("c1");
            expect(result.current.recentCourses[0].meta).toBe("Course");
        });

        it("computes progress from approved/total request ratio", () => {
            const recentFiles = [
                { id: "f1", courseId: "c1", title: "F1", viewedAt: "2024-05-15T10:00:00Z" },
            ];
            const requests = [
                { id: "r1", courseId: "c1", status: "approved" },
                { id: "r2", courseId: "c1", status: "approved" },
                { id: "r3", courseId: "c1", status: "rejected" },
                { id: "r4", courseId: "c1", status: "pending" },
            ] as FileRequest[];

            const { result } = renderHook(() => useDashboardData(recentFiles, requests, [], []));

            // 2 approved out of 4 total = 50%
            expect(result.current.recentCourses[0].progress).toBe(50);
        });
    });

    describe("weeklyActivity", () => {
        it("maps each day of week to file-view count", () => {
            // Week starts on Sunday (May 12, 2024) and ends on Saturday (May 18, 2024)
            const recentFiles = [
                { id: "f1", courseId: "c1", title: "F1", viewedAt: "2024-05-13T10:00:00Z" }, // Monday
                { id: "f2", courseId: "c1", title: "F2", viewedAt: "2024-05-13T11:00:00Z" }, // Monday
                { id: "f3", courseId: "c1", title: "F3", viewedAt: "2024-05-15T10:00:00Z" }, // Wednesday
            ];

            const { result } = renderHook(() => useDashboardData(recentFiles, [], [], []));

            const mondayActivity = result.current.weeklyActivity.find(a => a.day === "Mon");
            const wednesdayActivity = result.current.weeklyActivity.find(a => a.day === "Wed");
            const tuesdayActivity = result.current.weeklyActivity.find(a => a.day === "Tue");

            // count * 20
            expect(mondayActivity?.value).toBe(40);
            expect(wednesdayActivity?.value).toBe(20);
            expect(tuesdayActivity?.value).toBe(0);
        });

        it("caps value at 100", () => {
            // Monday
            const recentFiles = Array.from({ length: 10 }).map((_, i) => ({
                id: `f${i}`,
                courseId: "c1",
                title: `F${i}`,
                viewedAt: "2024-05-13T10:00:00Z"
            }));

            const { result } = renderHook(() => useDashboardData(recentFiles, [], [], []));

            const mondayActivity = result.current.weeklyActivity.find(a => a.day === "Mon");
            
            // 10 files * 20 = 200, should be capped at 100
            expect(mondayActivity?.value).toBe(100);
        });
    });
});
