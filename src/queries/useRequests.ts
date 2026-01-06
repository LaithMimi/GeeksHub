/**
 * ============================================================================
 * REQUEST QUERY HOOKS
 * ============================================================================
 * 
 * TanStack Query hooks for file request operations (create, list, withdraw,
 * admin approval/rejection). Includes queries and mutations with toast + undo.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * ✅ MOSTLY NO CHANGES NEEDED when backend is implemented!
 * 
 * The only change: Remove userId parameters when backend uses JWT auth.
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createFileRequest,
    listMyRequests,
    listAllRequests,
    listPendingRequests,
    approveRequest,
    rejectRequest,
    bulkApprove,
    bulkReject,
    withdrawRequest,
    getRequestStats,
    undoApprove,
    undoReject
} from "@/services/requestService";
import { toast } from "sonner";
import type { RejectReason, FileStatus } from "@/types/domain";
import { DEMO_ADMIN } from "@/mock/mock-db";

// ============================================================================
// USER HOOKS
// ============================================================================

/**
 * Fetches the current user's file requests.
 */
export const useMyRequests = (userId: string) => useQuery({
    queryKey: ['my-requests', userId],
    queryFn: () => listMyRequests(userId),
    enabled: !!userId
});

/**
 * Mutation to create a new file request.
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
 */
export const useWithdrawRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, userId }: { requestId: string, userId: string }) => withdrawRequest(requestId, userId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['my-requests', variables.userId] });
            toast.success("Request withdrawn");
        }
    });
};

// ============================================================================
// ADMIN HOOKS
// ============================================================================

/**
 * Fetches all file requests with optional status filter (admin only).
 */
export const useAllRequests = (filters?: { status?: FileStatus }) => useQuery({
    queryKey: ['admin-requests', filters],
    queryFn: () => listAllRequests(filters)
});

/**
 * Fetches pending file requests (admin only).
 */
export const usePendingRequests = () => useQuery({
    queryKey: ['admin-requests', { status: 'pending' }],
    queryFn: listPendingRequests
});

/**
 * Fetches request stats for admin dashboard.
 */
export const useRequestStats = () => useQuery({
    queryKey: ['admin-request-stats'],
    queryFn: getRequestStats,
    refetchInterval: 30000 // Refresh every 30s
});

/**
 * Mutation to approve a file request with undo support.
 */
export const useApproveRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId }: { requestId: string }) =>
            approveRequest(requestId, DEMO_ADMIN.id, DEMO_ADMIN.name),
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-request-stats'] });
            queryClient.invalidateQueries({ queryKey: ['audit-logs'] });

            if (result) {
                toast.success(`Approved "${result.title}"`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            await undoApprove(variables.requestId, DEMO_ADMIN.id, DEMO_ADMIN.name);
                            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
                            queryClient.invalidateQueries({ queryKey: ['admin-request-stats'] });
                            toast.info("Approval undone");
                        }
                    }
                });
            }
        },
        onError: () => {
            toast.error("Failed to approve request");
        }
    });
};

/**
 * Mutation to reject a file request with undo support.
 */
export const useRejectRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, reason, note }: { requestId: string; reason: RejectReason; note?: string }) =>
            rejectRequest(requestId, DEMO_ADMIN.id, reason, note, DEMO_ADMIN.name),
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-request-stats'] });
            queryClient.invalidateQueries({ queryKey: ['audit-logs'] });

            if (result) {
                toast.success(`Rejected "${result.title}"`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            await undoReject(variables.requestId, DEMO_ADMIN.id, DEMO_ADMIN.name);
                            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
                            queryClient.invalidateQueries({ queryKey: ['admin-request-stats'] });
                            toast.info("Rejection undone");
                        }
                    }
                });
            }
        },
        onError: () => {
            toast.error("Failed to reject request");
        }
    });
};

/**
 * Mutation to bulk approve requests.
 */
export const useBulkApprove = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (requestIds: string[]) =>
            bulkApprove(requestIds, DEMO_ADMIN.id, DEMO_ADMIN.name),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-request-stats'] });
            queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
            toast.success(`Approved ${result.approved} request(s)${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`);
        },
        onError: () => {
            toast.error("Failed to bulk approve");
        }
    });
};

/**
 * Mutation to bulk reject requests.
 */
export const useBulkReject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestIds, reason }: { requestIds: string[]; reason: RejectReason }) =>
            bulkReject(requestIds, DEMO_ADMIN.id, reason, DEMO_ADMIN.name),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-request-stats'] });
            queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
            toast.success(`Rejected ${result.rejected} request(s)${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`);
        },
        onError: () => {
            toast.error("Failed to bulk reject");
        }
    });
};
