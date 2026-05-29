import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

function listPinnedCourses(): Promise<string[]> {
    return api<string[]>("/me/pinned-courses");
}

function pinCourse(courseId: string): Promise<unknown> {
    return api(`/me/pinned-courses/${courseId}`, { method: "POST" });
}

function unpinCourse(courseId: string): Promise<unknown> {
    return api(`/me/pinned-courses/${courseId}`, { method: "DELETE" });
}

export function usePinnedCourses() {
    const qc = useQueryClient();

    const { data: pinnedIds = [] } = useQuery({
        queryKey: ["pinned-courses"],
        queryFn: listPinnedCourses,
    });

    const { mutate } = useMutation({
        mutationFn: ({ courseId, pinned }: { courseId: string; pinned: boolean }) =>
            pinned ? unpinCourse(courseId) : pinCourse(courseId),
        onMutate: async ({ courseId, pinned }) => {
            await qc.cancelQueries({ queryKey: ["pinned-courses"] });
            const prev = qc.getQueryData<string[]>(["pinned-courses"]) ?? [];
            qc.setQueryData<string[]>(
                ["pinned-courses"],
                pinned ? prev.filter(id => id !== courseId) : [...prev, courseId]
            );
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) qc.setQueryData(["pinned-courses"], ctx.prev);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: ["pinned-courses"] }),
    });

    const togglePin = (courseId: string) =>
        mutate({ courseId, pinned: pinnedIds.includes(courseId) });

    const isPinned = (courseId: string) => pinnedIds.includes(courseId);

    return { pinnedIds, togglePin, isPinned };
}
