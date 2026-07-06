/**
 * ============================================================================
 * REQUEST QUERY HOOKS
 * ============================================================================
 *
 * TanStack Query hooks for file request operations (create, list, withdraw,
 * admin approval/rejection). Includes queries and mutations with toast + undo.
 *
 * ============================================================================
 * BACKEND ALIGNMENT NOTES
 * ============================================================================
 *
 * - All user identity is derived server-side from the HTTP-Only JWT cookie.
 *   No userId, adminId, or adminName is passed in any request payload.
 *
 * - useMyRequests: no userId param — query key is simply ['my-requests'].
 *
 * - useWithdrawRequest: mutationFn only sends requestId.
 *   Cache invalidation uses the stable ['my-requests'] key.
 *
 * - useApproveRequest / useRejectRequest / useBulkApprove / useBulkReject:
 *   admin identity is stripped from all service call arguments.
 *   The backend reads adminId and adminName from the JWT claims for audit logs.
 *
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
    undoReject,
    getRequestPreviewUrl,
} from "@/features/files/api/requestService";
import { toast } from "sonner";
import { ApiError } from "@/lib/apiClient";
import type { RejectReason, FileStatus } from "@/types/domain";
import { queryKeys } from "@/lib/queryKeys";

function invalidateAdmin(qc: ReturnType<typeof useQueryClient>): void {
    qc.invalidateQueries({ queryKey: queryKeys.requests.all() });
    qc.invalidateQueries({ queryKey: queryKeys.requests.stats() });
    qc.invalidateQueries({ queryKey: queryKeys.audit.all() });
}

// ============================================================================
// USER HOOKS
// ============================================================================

/**
 * Fetches the current user's file requests.
 * No userId param — backend resolves identity from the JWT cookie.
 */
export const useMyRequests = () =>
    useQuery({
        queryKey: queryKeys.requests.mine(),
        queryFn: listMyRequests,
    });

/**
 * Mutation to create a new file request.
 * userId is NOT included in the payload — backend extracts it from the JWT.
 */
export const useCreateRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createFileRequest,
        onSuccess: () => {
            // Stable key — no userId segment needed anymore
            queryClient.invalidateQueries({ queryKey: queryKeys.requests.mine() });
            toast.success("File submitted successfully");
        },
        onError: (err) => {
            const detail = err instanceof ApiError ? err.message : null;
            toast.error(detail || "Failed to submit file. Try again.");
        },
    });
};

/**
 * Mutation to withdraw a pending file request.
 * userId is NOT sent — backend validates ownership via JWT.
 */
export const useWithdrawRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId }: { requestId: string }) =>
            withdrawRequest(requestId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.requests.mine() });
            toast.success("Request withdrawn");
        },
        onError: () => {
            toast.error("Failed to withdraw request. Try again.");
        },
    });
};

// ============================================================================
// ADMIN HOOKS
// ============================================================================

/**
 * Fetches the secure preview URL for a pending request.
 */
export const useRequestPreviewUrl = (requestId?: string) =>
    useQuery({
        queryKey: queryKeys.requests.preview(requestId),
        queryFn: () => getRequestPreviewUrl(requestId!),
        enabled: !!requestId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

/**
 * Fetches all file requests with optional status filter (admin only).
 */
export const useAllRequests = (filters?: { status?: FileStatus }) =>
    useQuery({
        queryKey: queryKeys.requests.filtered(filters),
        queryFn: () => listAllRequests(filters),
    });

/**
 * Fetches only pending file requests (admin only).
 */
export const usePendingRequests = () =>
    useQuery({
        queryKey: queryKeys.requests.filtered({ status: "pending" }),
        queryFn: listPendingRequests,
    });

/**
 * Fetches aggregate request stats for the admin dashboard.
 * Refreshes automatically every 30 seconds.
 */
export const useRequestStats = () =>
    useQuery({
        queryKey: queryKeys.requests.stats(),
        queryFn: getRequestStats,
        refetchInterval: 30_000,
    });

/**
 * Mutation to approve a file request with undo support.
 * Admin identity comes from the JWT — not passed as arguments.
 */
export const useApproveRequest = () => {
    const queryClient = useQueryClient();

    const invalidateAdmin = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.stats() });
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.all() });
    };

    return useMutation({
        mutationFn: ({ requestId }: { requestId: string }) =>
            approveRequest(requestId),
        onSuccess: (result, variables) => {
            invalidateAdmin();

            if (result) {
                toast.success(`Approved "${result.title}"`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            await undoApprove(variables.requestId);
                            invalidateAdmin();
                            toast.info("Approval undone");
                        },
                    },
                });
            }
        },
        onError: () => {
            toast.error("Failed to approve request");
        },
    });
};

/**
 * Mutation to reject a file request with undo support.
 * Admin identity comes from the JWT — not passed as arguments.
 */
export const useRejectRequest = () => {
    const queryClient = useQueryClient();

    const invalidateAdmin = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.stats() });
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.all() });
    };

    return useMutation({
        mutationFn: ({
            requestId,
            reason,
            note,
        }: {
            requestId: string;
            reason: RejectReason;
            note?: string;
        }) => rejectRequest(requestId, reason, note),
        onSuccess: (result, variables) => {
            invalidateAdmin();

            if (result) {
                toast.success(`Rejected "${result.title}"`, {
                    action: {
                        label: "Undo",
                        onClick: async () => {
                            await undoReject(variables.requestId);
                            invalidateAdmin();
                            toast.info("Rejection undone");
                        },
                    },
                });
            }
        },
        onError: () => {
            toast.error("Failed to reject request");
        },
    });
};

/**
 * Mutation to bulk approve requests.
 * Admin identity comes from the JWT — not passed as arguments.
 */
export const useBulkApprove = () => {
    const queryClient = useQueryClient();


    return useMutation({
        mutationFn: (requestIds: string[]) => bulkApprove(requestIds),
        onSuccess: (result) => {
            invalidateAdmin(queryClient);
            toast.success(
                `Approved ${result.approved} request(s)` +
                (result.skipped > 0 ? ` (${result.skipped} skipped)` : "")
            );
        },
        onError: () => {
            toast.error("Failed to bulk approve");
        },
    });
};

/**
 * Mutation to bulk reject requests.
 * Admin identity comes from the JWT — not passed as arguments.
 */
export const useBulkReject = () => {
    const queryClient = useQueryClient();


    return useMutation({
        mutationFn: ({
            requestIds,
            reason,
        }: {
            requestIds: string[];
            reason: RejectReason;
        }) => bulkReject(requestIds, reason),
        onSuccess: (result) => {
            invalidateAdmin(queryClient);
            toast.success(
                `Rejected ${result.rejected} request(s)` +
                (result.skipped > 0 ? ` (${result.skipped} skipped)` : "")
            );
        },
        onError: () => {
            toast.error("Failed to bulk reject");
        },
    });
};