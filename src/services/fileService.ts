/**
 * ============================================================================
 * FILE SERVICE - Mock Implementation
 * ============================================================================
 * 
 * This service handles file operations: listing files, getting file details,
 * managing recent files, and fetching top contributors.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * When the backend is implemented, replace each function's implementation:
 * 
 * 1. Import your API client instead of mock-db:
 *    ```ts
 *    import { api } from "@/lib/apiClient";
 *    ```
 * 
 * 2. Replace function bodies with fetch calls:
 * 
 *    listFiles(filters) → GET /api/files?courseId=...&type=...&lecturerId=...
 *    - Backend: SELECT * FROM files WHERE course_id = ? AND type = ? AND status = 'approved'
 *    - Add pagination: ?page=1&limit=20
 *    - Add search: ?search=...
 * 
 *    getFile(id) → GET /api/files/:id
 *    - Backend: SELECT * FROM files WHERE id = ?
 *    - Return download URL (pre-signed S3/GCS URL)
 * 
 *    listTopContributors() → GET /api/contributors/top?limit=5
 *    - Backend: SELECT u.*, SUM(pt.amount) as points 
 *               FROM users u JOIN points_transactions pt ON u.id = pt.user_id
 *               GROUP BY u.id ORDER BY points DESC LIMIT 5
 * 
 *    listRecentFiles() → GET /api/me/recent-files
 *    - Backend: SELECT f.* FROM files f 
 *               JOIN user_recent_files urf ON f.id = urf.file_id 
 *               WHERE urf.user_id = :currentUserId ORDER BY urf.viewed_at DESC
 * 
 *    addRecentFile(file) → POST /api/me/recent-files/:fileId
 *    - Backend: INSERT INTO user_recent_files (user_id, file_id, viewed_at) 
 *               VALUES (?, ?, NOW()) ON CONFLICT UPDATE viewed_at = NOW()
 * 
 *    clearRecentFiles() → DELETE /api/me/recent-files
 *    - Backend: DELETE FROM user_recent_files WHERE user_id = :currentUserId
 * 
 * 3. Example real implementation:
 *    ```ts
 *    export const listFiles = async (filters: FileFilters): Promise<File[]> => {
 *        const params = new URLSearchParams();
 *        if (filters.courseId) params.set("courseId", filters.courseId);
 *        if (filters.type) params.set("type", filters.type);
 *        if (filters.lecturerId) params.set("lecturerId", filters.lecturerId);
 *        return api<File[]>(`/api/files?${params}`);
 *    };
 *    
 *    export const addRecentFile = async (file: File): Promise<void> => {
 *        await api(`/api/me/recent-files/${file.id}`, { method: "POST" });
 *    };
 *    ```
 * 
 * 4. Keep function signatures unchanged - TanStack Query hooks won't need updates.
 * ============================================================================
 */

import { files, randomDelay, topContributors, recentFiles } from "@/mock/mock-db";
import type { Contributor, File, MaterialType } from "@/types/domain";

// const API_URL = "http://localhost:8000/api/v1";

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
 * @backend GET /api/files?courseId=...&type=...&lecturerId=...&search=...
 */
export const listFiles = async (filters: FileFilters): Promise<File[]> => {
    // --- REAL IMPLEMENTATION ---
    // // Note: Backend currently lacks a dedicated 'list files' endpoint or 'Materials' table.
    // // Current backend implementation deletes FileRequest upon approval, losing metadata.
    // // Hypothetical endpoint:
    // const params = new URLSearchParams();
    // if (filters.courseId) params.append("course_id", filters.courseId);
    // if (filters.type) params.append("type_id", filters.type);
    // 
    // const response = await fetch(`${API_URL}/files?${params.toString()}`);
    // if (!response.ok) throw new Error("Failed to fetch files");
    // return await response.json();
    // ---------------------------

    await randomDelay(300, 800);

    let result = files;

    if (filters.courseId) {
        result = result.filter(f => f.courseId === filters.courseId);
    }
    if (filters.lecturerId) {
        // TODO: Implement lecturerId filter when backend ready
        // Backend will handle this with: WHERE lecturer_id = ?
    }
    if (filters.type) {
        result = result.filter(f => f.type === filters.type as MaterialType);
    }

    return result;
};

/**
 * Fetches a single file by ID.
 * @param fileId - The file ID to fetch
 * @backend GET /api/files/:fileId
 * @returns File object with downloadUrl for PDF viewer
 */
export const getFile = async (fileId: string): Promise<File | null> => {
    // --- REAL IMPLEMENTATION ---
    // // Backend /api/v1/files/{file_id}/download returns { download_url }
    // // Ideally we also need file metadata.
    // const response = await fetch(`${API_URL}/files/${fileId}/download`);
    // if (!response.ok) return null;
    // const { download_url } = await response.json();
    // return { id: fileId, downloadUrl: download_url } as File; 
    // ---------------------------

    await randomDelay(200, 400);
    const file = files.find(f => f.id === fileId);
    if (!file) {
        return null;
    }
    return file;
};

/**
 * Fetches top contributors ranked by points.
 * @backend GET /api/contributors/top?limit=5
 */
export const listTopContributors = async (): Promise<Contributor[]> => {
    await randomDelay();
    return topContributors;
}

/**
 * Fetches the current user's recently viewed files.
 * @backend GET /api/me/recent-files
 * @note Backend should return files sorted by viewedAt DESC
 */
export const listRecentFiles = async (): Promise<any[]> => {
    await randomDelay();
    return recentFiles;
}

/**
 * Marks a file as recently viewed for the current user.
 * @param file - The file object to mark as viewed
 * @backend POST /api/me/recent-files/:fileId
 * @note Backend should use UPSERT to handle duplicates
 */
export const addRecentFile = async (file: any): Promise<void> => {
    // In-memory mock add
    const exists = recentFiles.find(f => f.id === file.id);
    if (exists) {
        exists.viewedAt = new Date().toISOString();
        // Move to top
        const idx = recentFiles.indexOf(exists);
        recentFiles.splice(idx, 1);
        recentFiles.unshift(exists);
    } else {
        recentFiles.unshift({
            ...file,
            viewedAt: new Date().toISOString()
        });
    }
}

/**
 * Clears all recently viewed files for the current user.
 * @backend DELETE /api/me/recent-files
 */
export const clearRecentFiles = async (): Promise<void> => {
    // In-memory mock clear
    recentFiles.length = 0;
}
