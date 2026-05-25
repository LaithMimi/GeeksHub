import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTasksQuery, useTasks } from "@/features/dashboard/hooks/useTasks";

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

const sampleTask = {
    id: "1",
    title: "Test task",
    date: "2026-05-22",
    startHour: 9,
    duration: 1,
    priority: "normal",
    completed: false,
    createdAt: "2026-05-22T09:00:00Z",
};

describe("useTasksQuery", () => {
    it("returns tasks on success", async () => {
        server.use(
            http.get("/api/v1/me/tasks", () => HttpResponse.json([sampleTask]))
        );
        const { result } = renderHook(() => useTasksQuery(), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data?.[0].title).toBe("Test task");
    });

    it("surfaces an error when the API fails", async () => {
        server.use(
            http.get("/api/v1/me/tasks", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 })
            )
        );
        const { result } = renderHook(() => useTasksQuery(), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});

describe("useTasks (compatibility wrapper)", () => {
    it("sorts tasks: incomplete first, then by date asc", async () => {
        const tasks = [
            { ...sampleTask, id: "a", date: "2026-06-01", completed: true },
            { ...sampleTask, id: "b", date: "2026-06-05", completed: false },
            { ...sampleTask, id: "c", date: "2026-06-02", completed: false },
        ];
        server.use(
            http.get("/api/v1/me/tasks", () => HttpResponse.json(tasks))
        );
        const { result } = renderHook(() => useTasks(), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.tasks).toHaveLength(3));
        // incomplete (c, b) before completed (a); within incomplete, earlier date first
        expect(result.current.tasks.map(t => t.id)).toEqual(["c", "b", "a"]);
    });

    it("derives taskDates only from incomplete tasks", async () => {
        const tasks = [
            { ...sampleTask, id: "a", date: "2026-06-01", completed: true },
            { ...sampleTask, id: "b", date: "2026-06-05", completed: false },
        ];
        server.use(
            http.get("/api/v1/me/tasks", () => HttpResponse.json(tasks))
        );
        const { result } = renderHook(() => useTasks(), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.tasks).toHaveLength(2));
        expect(Array.from(result.current.taskDates)).toEqual(["2026-06-05"]);
    });
});
