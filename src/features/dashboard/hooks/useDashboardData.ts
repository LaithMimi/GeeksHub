import { useMemo } from "react";
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import type { Course, Major, FileRequest } from "@/types/domain";

interface RecentFileLike {
    id: string;
    courseId: string;
    title: string;
    viewedAt: string;
}

export interface RecentCourseSummary {
    id: string;
    name: string;
    meta: string;
    color: string;
    lastAccess: string;
    progress: number;
}

export interface WeeklyActivityBar {
    day: string;
    value: number;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useDashboardData(
    recentFiles: RecentFileLike[] | undefined,
    requests: FileRequest[] | undefined,
    allCourses: Course[] | undefined,
    allMajors: Major[] | undefined,
) {
    const requestsByCourseId = useMemo(() => {
        const m = new Map<string, { total: number; approved: number }>();
        for (const r of requests ?? []) {
            const entry = m.get(r.courseId) ?? { total: 0, approved: 0 };
            entry.total++;
            if (r.status === "approved") entry.approved++;
            m.set(r.courseId, entry);
        }
        return m;
    }, [requests]);

    const recentCourses = useMemo<RecentCourseSummary[]>(() => {
        const out: RecentCourseSummary[] = [];
        const seen = new Set<string>();
        if (!recentFiles) return out;

        for (const file of recentFiles) {
            if (seen.has(file.courseId)) continue;
            seen.add(file.courseId);

            const course = allCourses?.find(c => c.id === file.courseId);

            const stats = requestsByCourseId.get(file.courseId) ?? { total: 0, approved: 0 };
            const progress = stats.total > 0
                ? Math.round((stats.approved / stats.total) * 100)
                : 0;

            const majorName = allMajors?.find(m => m.id === course?.majorId)?.name ?? course?.majorId;
            out.push({
                id: file.courseId,
                name: course?.name ?? file.courseId,
                meta: course ? `${course.term || `Semester ${course.semester}`} • ${majorName}` : "Course",
                color: ["blue", "green", "red"][out.length % 3],
                lastAccess: file.viewedAt,
                progress,
            });

            if (out.length >= 3) break;
        }
        return out;
    }, [recentFiles, requestsByCourseId, allCourses, allMajors]);

    const weeklyActivity = useMemo<WeeklyActivityBar[]>(() => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 });

        return DAY_LABELS.map((day, index) => {
            const count = (recentFiles ?? []).filter(f => {
                const d = new Date(f.viewedAt);
                return (
                    d.getDay() === index &&
                    isWithinInterval(d, { start: weekStart, end: weekEnd })
                );
            }).length;
            return { day, value: Math.min(count * 20, 100) };
        });
    }, [recentFiles]);

    return { recentCourses, weeklyActivity };
}
