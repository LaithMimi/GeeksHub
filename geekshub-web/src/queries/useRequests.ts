/**
 * ============================================================================
 * REQUEST QUERY HOOKS
 * ============================================================================
 * 
 * TanStack Query hooks for file request operations (create, list, withdraw,
 * admin approval). Includes both queries and mutations with toast notifications.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * ✅ MOSTLY NO CHANGES NEEDED when backend is implemented!
 * 
 * The only change you may need:
 * 
 * 1. REMOVE userId PARAMETER from useMyRequests:
 *    When the backend uses authentication (JWT/session), it will identify
 *    the current user automatically. You can simplify:
 *    
 *    BEFORE (mock):
 *    ```ts
 *    export const useMyRequests = (userId: string) => useQuery({
 *        queryKey: ['my-requests', userId],
 *        queryFn: () => listMyRequests(userId),
 *        enabled: !!userId
 *    });
 *    ```
 *    
 *    AFTER (real backend):
 *    ```ts
 *    export const useMyRequests = () => useQuery({
 *        queryKey: ['my-requests'],
 *        queryFn: listMyRequests, // No userId, backend uses auth
 *    });
 *    ```
 *    
 *    Then update components that call useMyRequests() to not pass userId.
 * 
 * 2. INVALIDATION: After approving a request, you may want to invalidate
 *    the user's reputation query. The backend should return the affected
 *    userId so you can invalidate: ['reputation', userId]
 * 
 * 3. ADMIN HOOKS: usePendingRequests and useApproveRequest should only be
 *    called from admin pages. Consider adding role checks in components.
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRequest, listMyRequests, listPendingRequests, approveRequest, withdrawRequest } from "@/services/requestService";
import { toast } from "sonner";

/**
 * Fetches the current user's file requests.
 * @param userId - User ID to filter by (will be removed when backend uses auth)
 * @backend When authenticated, backend filters by session user automatically
 */
export const useMyRequests = (userId: string) => useQuery({
    queryKey: ['my-requests', userId],
    queryFn: () => listMyRequests(userId),
    enabled: !!userId
});

/**
 * Mutation to create a new file request.
 * Shows success/error toast and invalidates my-requests query.
 */
export const useCreateRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createFileRequest,
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['my-requests', variables.userId] });
            toast.success("Request submitted successfully");
        },
        onError: () => {
            toast.error("Failed to submit request");
        }
    });
};

/**
 * Mutation to withdraw a pending file request.
 * Only the owner can withdraw their own requests.
 */
export const useWithdrawRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, userId }: { requestId: string, userId: string }) => withdrawRequest(requestId, userId),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['my-requests', variables.userId] });
            toast.success("Request withdrawn");
        }
    });
}

// ============================================================================
// ADMIN HOOKS
// ============================================================================
// These hooks are for admin/moderator use only.
// Ensure the calling components check user role before rendering.

/**
 * Fetches all pending file requests (admin only).
 * @security Only call from admin pages that verify user role
 */
export const usePendingRequests = () => useQuery({
    queryKey: ['pending-requests'],
    queryFn: listPendingRequests
});

/**
 * Mutation to approve a file request and award points (admin only).
 * @security Backend must verify admin role before processing
 */
export const useApproveRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, adminId }: { requestId: string, adminId: string }) => approveRequest(requestId, adminId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
            // TODO: When backend returns affected userId, also invalidate:
            // queryClient.invalidateQueries({ queryKey: ['reputation', userId] });
            toast.success("Request approved");
        }
    });
}
