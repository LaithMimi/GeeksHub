import { api } from "@/lib/apiClient";

export interface Task {
    id: string;
    title: string;
    date: string;        // "YYYY-MM-DD"
    startHour: number;
    duration: number;
    priority: "urgent" | "high" | "normal";
    completed: boolean;
    createdAt: string;
}

export interface CreateTaskPayload {
    title: string;
    date: string;
    priority: Task["priority"];
    startHour: number;
    duration: number;
}

export interface PatchTaskPayload {
    title?: string;
    date?: string;
    priority?: Task["priority"];
    startHour?: number;
    duration?: number;
    completed?: boolean;
}

export const listMyTasks = (): Promise<Task[]> =>
    api<Task[]>("/me/tasks");

export const createTask = (body: CreateTaskPayload): Promise<Task> =>
    api<Task>("/me/tasks", { method: "POST", body: JSON.stringify(body) });

export const updateTask = (id: string, body: PatchTaskPayload): Promise<Task> =>
    api<Task>(`/me/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteTask = (id: string): Promise<void> =>
    api<void>(`/me/tasks/${id}`, { method: "DELETE" });
