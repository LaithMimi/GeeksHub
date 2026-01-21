import { useState, useEffect } from "react";

export function usePinnedCourses() {
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem("pinned_courses");
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error("Failed to parse pinned_courses", error);
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem("pinned_courses", JSON.stringify(pinnedIds));
        } catch (error) {
            console.error("Failed to save pinned_courses", error);
        }
    }, [pinnedIds]);

    const togglePin = (courseId: string) => {
        setPinnedIds(prev =>
            prev.includes(courseId)
                ? prev.filter(id => id !== courseId)
                : [...prev, courseId]
        );
    };

    const isPinned = (courseId: string) => pinnedIds.includes(courseId);

    return { pinnedIds, togglePin, isPinned };
}
