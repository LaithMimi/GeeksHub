/**
 * ============================================================================
 * RECENT FILES HOOK – Mock Implementation (localStorage)
 * ============================================================================
 *
 * Tracks which files the user has recently opened, for the "Continue Studying"
 * hero section on the Dashboard.  Persists in localStorage.
 *
 * NOTE: There is ALSO a TanStack Query hook in queries/useFiles.ts
 * (`useRecentFiles`) that calls `fileService.listRecentFiles()`. When you
 * connect the backend, you should consolidate both into the query-layer hook
 * and delete this localStorage version.
 *
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 *
 * 1. Required Backend Endpoints (already documented in fileService.ts):
 *
 *    GET    /api/me/recent-files
 *      → Returns the current user's recently viewed files, sorted by viewedAt DESC
 *      → Response: RecentFile[]
 *
 *    POST   /api/me/recent-files/:fileId
 *      → Marks a file as recently viewed (UPSERT – updates viewedAt if exists)
 *      → Response: 201 Created
 *
 *    DELETE /api/me/recent-files
 *      → Clears all recent files for the current user
 *      → Response: 204 No Content
 *
 * 2. SQL Schema (from fileService.ts):
 *    ```sql
 *    CREATE TABLE user_recent_files (
 *        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *        file_id    UUID NOT NULL REFERENCES files(id),
 *        viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *        PRIMARY KEY (user_id, file_id)
 *    );
 *    CREATE INDEX idx_recent_user_time ON user_recent_files(user_id, viewed_at DESC);
 *    ```
 *
 * 3. Migration Steps:
 *    a) Delete this file entirely.
 *    b) Use the existing query hooks from queries/useFiles.ts:
 *       - useRecentFiles()      → GET  /api/me/recent-files
 *       - useAddRecentFile()    → POST /api/me/recent-files/:fileId
 *       - useClearRecentFiles() → DELETE /api/me/recent-files
 *    c) Update Dashboard.tsx imports:
 *       Replace:  import { useRecentFiles } from "@/hooks/useRecentFiles";
 *       With:     import { useRecentFiles } from "@/queries/useFiles";
 *    d) Update FileShell.tsx (the file viewer) to call useAddRecentFile()
 *       when a file is opened, instead of the localStorage version.
 * ============================================================================
 */

import { useState, useEffect } from 'react';

export interface RecentFile {
    id: string;
    title: string;
    courseId: string;
    type: string;
    viewedAt: string; // ISO string
}

const MAX_RECENT_FILES = 20;
const STORAGE_KEY = 'geekshub-recent-files';

export function useRecentFiles() {
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

    /**
     * Load from localStorage on mount.
     * @backend REMOVE – useQuery will fetch from GET /api/me/recent-files automatically.
     */
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setRecentFiles(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse recent files", e);
            }
        }
    }, []);

    /**
     * Marks a file as recently viewed.
     * @backend REPLACE with: POST /api/me/recent-files/:fileId
     *   Then invalidate queryKey ["recent-files"] to refetch.
     *   Use the useAddRecentFile() mutation from queries/useFiles.ts.
     */
    const addRecentFile = (file: Omit<RecentFile, 'viewedAt'>) => {
        setRecentFiles(prev => {
            // Remove if already exists to move to top
            const filtered = prev.filter(f => f.id !== file.id);
            const newFile = { ...file, viewedAt: new Date().toISOString() };
            const updated = [newFile, ...filtered].slice(0, MAX_RECENT_FILES);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    /**
     * Clears all recent file history.
     * @backend REPLACE with: DELETE /api/me/recent-files
     *   Then invalidate queryKey ["recent-files"].
     *   Use the useClearRecentFiles() mutation from queries/useFiles.ts.
     */
    const clearHistory = () => {
        setRecentFiles([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    return { recentFiles, addRecentFile, clearHistory };
}
