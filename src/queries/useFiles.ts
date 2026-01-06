/**
 * ============================================================================
 * FILE QUERY HOOKS
 * ============================================================================
 * 
 * TanStack Query hooks for file operations (listing, fetching, recent files,
 * top contributors). Includes both queries and mutations.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * ✅ NO CHANGES NEEDED when backend is implemented!
 * 
 * These hooks call service functions which return Promises. When you update
 * the service layer to call real API endpoints, these hooks will continue
 * to work without modification.
 * 
 * Notes for backend integration:
 * 
 * 1. RECENT FILES: The backend should track user-specific recent files.
 *    The hook will work the same, but data will persist across sessions.
 * 
 * 2. TOP CONTRIBUTORS: Consider caching this heavily (staleTime: 10 min)
 *    since leaderboard data doesn't need real-time updates.
 * 
 * 3. FILE VIEWING: When addRecentFile() is called, the backend should
 *    update the user's viewing history. The mutation invalidates the
 *    'recent-files' query to refetch the updated list.
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listFiles, getFile, listTopContributors, listRecentFiles, addRecentFile, clearRecentFiles } from "@/services/fileService";
import type { FileFilters } from "@/services/fileService";

/**
 * Fetches files with filters. Only enabled when courseId is provided.
 * @param filters - Filter by courseId, lecturerId, type
 */
export const useFiles = (filters: FileFilters) => useQuery({
    queryKey: ['files', filters],
    queryFn: () => listFiles(filters),
    enabled: !!filters.courseId
});

/**
 * Fetches a single file by ID for the file viewer.
 * @param fileId - The file ID to fetch
 */
export const useFile = (fileId: string) => useQuery({
    queryKey: ['file', fileId],
    queryFn: () => getFile(fileId),
    enabled: !!fileId
});

/**
 * Fetches top contributors for the leaderboard.
 * Cached for 10 minutes as this data doesn't need frequent updates.
 */
export const useTopContributors = () => useQuery({
    queryKey: ['top-contributors'],
    queryFn: listTopContributors,
    staleTime: 1000 * 60 * 10 // 10 minutes
});

/**
 * Fetches the current user's recently viewed files.
 * @backend When authenticated, backend filters by current user automatically
 */
export const useRecentFiles = () => useQuery({
    queryKey: ['recent-files'],
    queryFn: listRecentFiles,
});

/**
 * Mutation to mark a file as recently viewed.
 * Invalidates recent-files query on success to show updated list.
 */
export const useAddRecentFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: addRecentFile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recent-files'] });
        }
    });
};

/**
 * Mutation to clear all recently viewed files.
 * Invalidates recent-files query on success.
 */
export const useClearRecentFiles = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: clearRecentFiles,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recent-files'] });
        }
    });
};
