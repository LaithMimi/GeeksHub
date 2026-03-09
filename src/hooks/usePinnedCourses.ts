/**
 * ============================================================================
 * PINNED COURSES HOOK – Mock Implementation (localStorage)
 * ============================================================================
 *
 * Lets users pin/unpin favourite courses for quick access.
 * Currently persists entirely in localStorage.
 *
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 *
 * 1. Required Backend Endpoints:
 *
 *    GET    /api/me/pinned-courses
 *      → SELECT course_id FROM pinned_courses WHERE user_id = :currentUserId
 *      → Response: string[]   (array of course IDs)
 *
 *    POST   /api/me/pinned-courses/:courseId
 *      → INSERT INTO pinned_courses (user_id, course_id) VALUES (:userId, :courseId)
 *        ON CONFLICT DO NOTHING
 *      → Response: 201 Created
 *
 *    DELETE /api/me/pinned-courses/:courseId
 *      → DELETE FROM pinned_courses WHERE user_id = :userId AND course_id = :courseId
 *      → Response: 204 No Content
 *
 * 2. SQL Schema:
 *    ```sql
 *    CREATE TABLE pinned_courses (
 *        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *        course_id  VARCHAR(50) NOT NULL REFERENCES courses(id),
 *        pinned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *        PRIMARY KEY (user_id, course_id)
 *    );
 *    ```
 *
 * 3. TanStack Query Migration:
 *    ```ts
 *    export const usePinnedCourses = () => useQuery({
 *        queryKey: ["pinned-courses"],
 *        queryFn: () => api<string[]>("GET", "/api/me/pinned-courses"),
 *    });
 *
 *    export const useTogglePin = () => {
 *        const qc = useQueryClient();
 *        return useMutation({
 *            mutationFn: ({ courseId, isPinned }: { courseId: string; isPinned: boolean }) =>
 *                isPinned
 *                    ? api("DELETE", `/api/me/pinned-courses/${courseId}`)
 *                    : api("POST",   `/api/me/pinned-courses/${courseId}`),
 *            onSuccess: () => qc.invalidateQueries({ queryKey: ["pinned-courses"] }),
 *        });
 *    };
 *    ```
 *
 * 4. Keep the togglePin/isPinned API unchanged so components don't need updates.
 * ============================================================================
 */

import { useState, useEffect } from "react";

export function usePinnedCourses() {
    /**
     * @backend REPLACE localStorage read with:
     *   const { data: pinnedIds = [] } = useQuery({
     *       queryKey: ["pinned-courses"],
     *       queryFn: () => fetch("/api/me/pinned-courses").then(r => r.json()),
     *   });
     */
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem("pinned_courses");
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    /**
     * @backend REMOVE this useEffect – mutations will handle persistence.
     */
    useEffect(() => {
        try {
            localStorage.setItem("pinned_courses", JSON.stringify(pinnedIds));
        } catch {
            // silently ignore write failures
        }
    }, [pinnedIds]);

    /**
     * @backend REPLACE with mutation:
     *   isPinned(courseId)
     *     ? DELETE /api/me/pinned-courses/:courseId
     *     : POST   /api/me/pinned-courses/:courseId
     *   Then invalidate queryKey ["pinned-courses"].
     */
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
