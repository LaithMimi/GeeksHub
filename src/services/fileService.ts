import { api } from "@/lib/apiClient";
import type { Contributor, File } from "@/types/domain";

export interface FileFilters {
    majorId?: string;
    courseId?: string;
    lecturerId?: string;
    type?: string;
    search?: string;
}

/**
 * Lists files with optional filters.
 * @param filters - Filter by courseId, lecturerId, type, search
 * @backend GET /api/v1/files?course_id=...&type_id=...&lecturer_id=...&search=...
 */
export const listFiles = async (filters: FileFilters): Promise<File[]> => {
    const params = new URLSearchParams();
    if (filters.courseId) params.append("course_id", filters.courseId);
    if (filters.lecturerId) params.append("lecturer_id", filters.lecturerId);
    if (filters.type) params.append("type_id", filters.type);
    if (filters.search) params.append("search", filters.search);

    return await api<File[]>(`/files?${params.toString()}`);
};

/**
 * Fetches a single file by ID.
 * @param fileId - The file ID to fetch
 * @backend GET /api/v1/files/:fileId
 * @returns File object with downloadUrl for PDF viewer
 */
export const getFile = async (fileId: string): Promise<File | null> => {
    return await api<File>(`/files/${fileId}`);
};

/**
 * Fetches top contributors ranked by points.
 * @backend GET /api/v1/reputation/leaderboard
 */
export const listTopContributors = async (): Promise<Contributor[]> => {
    return await api<Contributor[]>("/reputation/leaderboard");
}

/**
 * Fetches the current user's recently viewed files.
 * @backend GET /api/v1/me/recent-files
 */
export const listRecentFiles = async (): Promise<any[]> => {
    return await api<any[]>("/me/recent-files");
}

/**
 * Marks a file as recently viewed for the current user.
 * @param file - The file object to mark as viewed
 * @backend POST /api/v1/me/recent-files/:fileId
 */
export const addRecentFile = async (file: any): Promise<void> => {
    await api(`/me/recent-files/${file.id}`, { method: "POST" });
}

/**
 * Clears all recently viewed files for the current user.
 * @backend DELETE /api/v1/me/recent-files
 */
export const clearRecentFiles = async (): Promise<void> => {
    await api("/me/recent-files", { method: "DELETE" });
}
