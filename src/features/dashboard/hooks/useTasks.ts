import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listMyTasks,
    createTask,
    updateTask,
    deleteTask,
    type Task,
    type CreateTaskPayload,
    type PatchTaskPayload,
} from "@/services/taskService";

export type { Task };

// ── Raw TanStack hooks ────────────────────────────────────────────────────────

export const useTasksQuery = () =>
    useQuery({
        queryKey: ["my-tasks"],
        queryFn: listMyTasks,
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

export const useCreateTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createTask,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
    });
};

export const useToggleTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            updateTask(id, { completed }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
    });
};

export const useUpdateTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: PatchTaskPayload }) =>
            updateTask(id, patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
    });
};

export const useDeleteTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteTask,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
    });
};

// ── Compatibility wrapper ─────────────────────────────────────────────────────
// Keeps the same { tasks, taskDates, addTask, toggleTask, deleteTask } shape
// that Dashboard.tsx already uses — no component changes needed.

export function useTasks() {
    const { data: tasks = [] } = useTasksQuery();
    const createMutation = useCreateTask();
    const toggleMutation = useToggleTask();
    const updateMutation = useUpdateTask();
    const deleteMutation = useDeleteTask();

    const addTask = (
        title: string,
        date: string,
        priority: Task["priority"],
        startHour: number,
        duration: number,
    ) => {
        const payload: CreateTaskPayload = { title, date, priority, startHour, duration };
        createMutation.mutate(payload);
    };

    const toggleTask = (id: string) => {
        const task = tasks.find(t => t.id === id);
        if (task) toggleMutation.mutate({ id, completed: !task.completed });
    };

    const moveTask = (id: string, date: string, startHour: number) => {
        updateMutation.mutate({ id, patch: { date, startHour } });
    };

    const removeTask = (id: string) => deleteMutation.mutate(id);

    // Sort: incomplete first, then by date asc
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const taskDates = new Set(tasks.filter(t => !t.completed).map(t => t.date));

    return { tasks: sortedTasks, taskDates, addTask, toggleTask, moveTask, deleteTask: removeTask };
}
