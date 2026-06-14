import { api } from "@/lib/apiClient";
import type { Contributor, File } from "@/types/domain";

export interface FileFilters {
    majorId?: string;
    courseId?: string;
    lecturerId?: string;
    type?: string;
    search?: string;
}

/** Backend max page size for GET /files (page_size has `le=100`). */
const FILES_PAGE_SIZE = 100;

/**
 * Fetches a single page of files.
 * @param filters - Filter by courseId, lecturerId, type, search
 * @param page - 1-based page number
 * @backend GET /api/v1/files?course_id=...&type_id=...&lecturer_id=...&search=...&page=...&page_size=...
 */
export const listFilesPage = async (filters: FileFilters, page: number): Promise<File[]> => {
    const params = new URLSearchParams();
    if (filters.courseId) params.append("course_id", filters.courseId);
    if (filters.lecturerId) params.append("lecturer_id", filters.lecturerId);
    if (filters.type) params.append("type_id", filters.type);
    if (filters.search) params.append("search", filters.search);
    params.append("page", String(page));
    params.append("page_size", String(FILES_PAGE_SIZE));

    return await api<File[]>(`/files?${params.toString()}`);
};

/**
 * Lists files with optional filters. The backend paginates this endpoint
 * (page_size defaults to 50, max 100), so we page through until a short page
 * to avoid silently truncating courses that have more than one page of files.
 * @param filters - Filter by courseId, lecturerId, type, search
 */
export const listFiles = async (filters: FileFilters): Promise<File[]> => {
    const all: File[] = [];
    for (let page = 1; ; page++) {
        const batch = await listFilesPage(filters, page);
        all.push(...batch);
        if (batch.length < FILES_PAGE_SIZE) break;
    }
    return all;
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
    const rawData = await api<any[]>("/reputation/leaderboard");
    return rawData.map(item => ({
        id: item.userId || item.id,
        name: item.name,
        avatar: item.name ? item.name.substring(0, 2).toUpperCase() : "?",
        points: item.totalPoints || item.points || 0,
        badge: item.badge,
        major: item.major || "Unknown"
    }));
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
