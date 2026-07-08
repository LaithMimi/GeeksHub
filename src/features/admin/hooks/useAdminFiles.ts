import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listFiles, updateFile, deleteFile } from "@/features/files/api/fileService";
import type { FileFilters } from "@/features/files/api/fileService";
import type { File } from "@/types/domain";

/**
 * Hook for admins to fetch all files with optional filters.
 * Doesn't require a courseId like the regular useFiles hook.
 */
export const useAdminFiles = (filters: FileFilters = {}) => useQuery({
    queryKey: ["admin", "files", filters],
    queryFn: () => listFiles(filters),
});

export const useAdminUpdateFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<File> }) => updateFile(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "files"] });
            // Invalidate regular files cache too if they are cached
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all() });
        }
    });
};

export const useAdminDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteFile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "files"] });
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all() });
        }
    });
};
