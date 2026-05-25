import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listMyTasks,
    createTask,
    updateTask,
    deleteTask,
    type Task,
    type CreateTaskPayload,
    type PatchTaskPayload,
} from "@/features/dashboard/api/taskService";
import { queryKeys } from "@/lib/queryKeys";

export type { Task };

// ── Raw TanStack hooks ────────────────────────────────────────────────────────

export const useTasksQuery = () =>
    useQuery({
        queryKey: queryKeys.tasks.all(),
        queryFn: listMyTasks,
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

export const useCreateTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createTask,
        onMutate: async (newTask) => {
            await qc.cancelQueries({ queryKey: queryKeys.tasks.all() });
            const previousTasks = qc.getQueryData<Task[]>(queryKeys.tasks.all());
            qc.setQueryData<Task[]>(queryKeys.tasks.all(), (old = []) => [
                ...old,
                {
                    id: Math.random().toString(36).substring(7),
                    completed: false,
                    ...newTask,
                } as Task,
            ]);
            return { previousTasks };
        },
        onError: (_err, _newTodo, context) => {
            qc.setQueryData(queryKeys.tasks.all(), context?.previousTasks);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.tasks.all() });
        },
    });
};

export const useToggleTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            updateTask(id, { completed }),
        onMutate: async ({ id, completed }) => {
            await qc.cancelQueries({ queryKey: queryKeys.tasks.all() });
            const previousTasks = qc.getQueryData<Task[]>(queryKeys.tasks.all());
            qc.setQueryData<Task[]>(queryKeys.tasks.all(), (old = []) =>
                old.map(task => task.id === id ? { ...task, completed } : task)
            );
            return { previousTasks };
        },
        onError: (_err, _variables, context) => {
            qc.setQueryData(queryKeys.tasks.all(), context?.previousTasks);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.tasks.all() });
        },
    });
};

export const useUpdateTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: PatchTaskPayload }) =>
            updateTask(id, patch),
        onMutate: async ({ id, patch }) => {
            await qc.cancelQueries({ queryKey: queryKeys.tasks.all() });
            const previousTasks = qc.getQueryData<Task[]>(queryKeys.tasks.all());
            qc.setQueryData<Task[]>(queryKeys.tasks.all(), (old = []) =>
                old.map(task => task.id === id ? { ...task, ...patch } : task)
            );
            return { previousTasks };
        },
        onError: (_err, _variables, context) => {
            qc.setQueryData(queryKeys.tasks.all(), context?.previousTasks);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.tasks.all() });
        },
    });
};

export const useDeleteTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteTask,
        onMutate: async (id) => {
            await qc.cancelQueries({ queryKey: queryKeys.tasks.all() });
            const previousTasks = qc.getQueryData<Task[]>(queryKeys.tasks.all());
            qc.setQueryData<Task[]>(queryKeys.tasks.all(), (old = []) =>
                old.filter(task => task.id !== id)
            );
            return { previousTasks };
        },
        onError: (_err, _variables, context) => {
            qc.setQueryData(queryKeys.tasks.all(), context?.previousTasks);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: queryKeys.tasks.all() });
        },
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
