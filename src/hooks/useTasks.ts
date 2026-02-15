/**
 * ============================================================================
 * TASKS HOOK – Mock Implementation (localStorage)
 * ============================================================================
 *
 * Manages the user's personal task / learning-plan items.
 * Currently persists entirely in localStorage.
 *
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 *
 * 1. Create a Task Service (e.g. src/services/taskService.ts):
 *    ```ts
 *    import { api } from "@/lib/apiClient";   // your axios / fetch wrapper
 *
 *    // All endpoints use the JWT from the auth header – no userId param needed.
 *    export const listMyTasks   = ()                       => api<Task[]>("GET",  "/api/me/tasks");
 *    export const createTask    = (body: CreateTaskPayload) => api<Task>  ("POST", "/api/me/tasks", body);
 *    export const updateTask    = (id: string, body: Partial<Task>) =>
 *                                                             api<Task>  ("PATCH",`/api/me/tasks/${id}`, body);
 *    export const deleteTask    = (id: string)              => api<void>  ("DELETE",`/api/me/tasks/${id}`);
 *    ```
 *
 * 2. Required Backend Endpoints:
 *
 *    GET    /api/me/tasks
 *      → SELECT * FROM tasks WHERE user_id = :currentUserId ORDER BY date ASC
 *      → Response: Task[]
 *
 *    POST   /api/me/tasks
 *      → INSERT INTO tasks (user_id, title, date, start_hour, duration, priority)
 *        VALUES (:userId, :title, :date, :startHour, :duration, :priority)
 *      → Request body: { title, date, startHour, duration, priority }
 *      → Response: Task (with server-generated id & createdAt)
 *
 *    PATCH  /api/me/tasks/:taskId
 *      → UPDATE tasks SET completed = :completed WHERE id = :taskId AND user_id = :userId
 *      → Request body: { completed?: boolean, title?: string, ... }
 *      → Response: Task (updated)
 *      → Used for toggling completion & editing fields.
 *
 *    DELETE /api/me/tasks/:taskId
 *      → DELETE FROM tasks WHERE id = :taskId AND user_id = :userId
 *      → Response: 204 No Content
 *
 * 3. Create TanStack Query hooks (e.g. src/queries/useTasks.ts):
 *    ```ts
 *    export const useTasks = () => useQuery({
 *        queryKey: ["my-tasks"],
 *        queryFn: listMyTasks,
 *    });
 *
 *    export const useCreateTask = () => {
 *        const qc = useQueryClient();
 *        return useMutation({
 *            mutationFn: createTask,
 *            onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
 *        });
 *    };
 *
 *    export const useToggleTask = () => {
 *        const qc = useQueryClient();
 *        return useMutation({
 *            mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
 *                updateTask(id, { completed }),
 *            onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
 *        });
 *    };
 *
 *    export const useDeleteTask = () => {
 *        const qc = useQueryClient();
 *        return useMutation({
 *            mutationFn: deleteTask,
 *            onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
 *        });
 *    };
 *    ```
 *
 * 4. SQL Schema (example):
 *    ```sql
 *    CREATE TABLE tasks (
 *        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *        title       VARCHAR(255) NOT NULL,
 *        date        DATE NOT NULL,
 *        start_hour  REAL NOT NULL DEFAULT 12,     -- 0–23, supports 0.5 steps
 *        duration    REAL NOT NULL DEFAULT 1,      -- hours
 *        priority    VARCHAR(10) NOT NULL DEFAULT 'normal',  -- 'urgent','high','normal'
 *        completed   BOOLEAN NOT NULL DEFAULT FALSE,
 *        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *    );
 *    CREATE INDEX idx_tasks_user_date ON tasks(user_id, date);
 *    ```
 *
 * 5. Update Dashboard.tsx to consume the new query hooks:
 *    Replace:  const { tasks, taskDates, addTask, toggleTask, deleteTask } = useTasks();
 *    With:     const { data: tasks = [] } = useTasks();
 *              const createTask = useCreateTask();
 *              const toggleTask = useToggleTask();
 *              const removeTask = useDeleteTask();
 *    Then pass mutation.mutate() calls instead of the current callbacks.
 *
 * 6. Keep the Task interface unchanged – backend should return the same shape.
 * ============================================================================
 */

import { useState, useCallback, useEffect } from "react";

export interface Task {
    id: string;
    title: string;
    date: string;           // ISO date string "YYYY-MM-DD"
    startHour: number;       // 0–23 (e.g. 14 = 2:00 PM)
    duration: number;        // hours (e.g. 1.5 = 1h 30m)
    priority: "urgent" | "high" | "normal";
    completed: boolean;
    createdAt: string;
}

const STORAGE_KEY = "geekshub-tasks";

/**
 * Loads tasks from localStorage.
 * @backend REPLACE with: return await fetch("/api/me/tasks").then(r => r.json());
 */
function loadTasks(): Task[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return getDefaultTasks();
        const parsed: Task[] = JSON.parse(stored);
        // Migrate old tasks missing time fields
        return parsed.map(t => ({
            ...t,
            startHour: t.startHour ?? 12,
            duration: t.duration ?? 1,
        }));
    } catch {
        return getDefaultTasks();
    }
}

function getDefaultTasks(): Task[] {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun

    // Helper: get a date for a specific weekday this week (0=Sun, 1=Mon...)
    const dateForDay = (targetDay: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + (targetDay - dayOfWeek));
        return d.toISOString().split("T")[0];
    };

    return [
        {
            id: "default-1",
            title: "UI/UX Design",
            date: dateForDay(1), // Monday
            startHour: 15,
            duration: 2,
            priority: "urgent",
            completed: false,
            createdAt: today.toISOString(),
        },
        {
            id: "default-2",
            title: "Design Thinking",
            date: dateForDay(1), // Monday
            startHour: 19,
            duration: 2,
            priority: "normal",
            completed: false,
            createdAt: today.toISOString(),
        },
        {
            id: "default-3",
            title: "3D Motion",
            date: dateForDay(2), // Tuesday
            startHour: 13,
            duration: 3,
            priority: "normal",
            completed: false,
            createdAt: today.toISOString(),
        },
        {
            id: "default-4",
            title: "Animation",
            date: dateForDay(2), // Tuesday
            startHour: 17,
            duration: 2,
            priority: "high",
            completed: false,
            createdAt: today.toISOString(),
        },
        {
            id: "default-5",
            title: "UI/UX Design",
            date: dateForDay(5), // Friday
            startHour: 15,
            duration: 2,
            priority: "normal",
            completed: false,
            createdAt: today.toISOString(),
        },
        {
            id: "default-6",
            title: "Design Thinking",
            date: dateForDay(5), // Friday
            startHour: 19,
            duration: 2,
            priority: "high",
            completed: false,
            createdAt: today.toISOString(),
        },
    ];
}

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>(loadTasks);

    /**
     * Persists tasks to localStorage on every change.
     * @backend REMOVE this useEffect entirely.
     *          With TanStack Query, each mutation (create/toggle/delete) will
     *          call the API and then invalidate the "my-tasks" query to refetch.
     */
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }, [tasks]);

    /**
     * Creates a new task.
     * @backend REPLACE with: POST /api/me/tasks
     *   Body: { title, date, startHour, duration, priority }
     *   The server generates `id` and `createdAt`.
     *   After the mutation, invalidate queryKey ["my-tasks"].
     */
    const addTask = useCallback((title: string, date: string, priority: Task["priority"], startHour: number, duration: number) => {
        const newTask: Task = {
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            date,
            startHour,
            duration,
            priority,
            completed: false,
            createdAt: new Date().toISOString(),
        };
        setTasks(prev => [newTask, ...prev]);
    }, []);

    /**
     * Toggles a task's completed status.
     * @backend REPLACE with: PATCH /api/me/tasks/:taskId
     *   Body: { completed: !currentValue }
     *   Then invalidate queryKey ["my-tasks"].
     */
    const toggleTask = useCallback((id: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    }, []);

    /**
     * Deletes a task.
     * @backend REPLACE with: DELETE /api/me/tasks/:taskId
     *   Response: 204 No Content
     *   Then invalidate queryKey ["my-tasks"].
     */
    const deleteTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    }, []);

    // Sort: incomplete first, then by date ascending
    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const taskDates = new Set(tasks.filter(t => !t.completed).map(t => t.date));

    return { tasks: sortedTasks, taskDates, addTask, toggleTask, deleteTask };
}
