import { api } from "@/lib/apiClient";
import type { FileRequest, RejectReason, RequestStats, FileStatus } from "@/types/domain";

/**
 * Creates a new file upload request.
 * @backend POST /api/v1/courses/{course_id}/upload
 */
export const createFileRequest = async (payload: {
    userId: string;
    courseId: string;
    lecturerId: string;
    type: string; // type_id
    title: string;
    year: number;
    notes?: string;
    file?: File;
}): Promise<FileRequest> => {
    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("lecturer_id", payload.lecturerId);
    formData.append("type_id", payload.type);
    formData.append("year", payload.year.toString());
    if (payload.notes) {
        formData.append("notes", payload.notes);
    }
    if (payload.file) {
        formData.append("file", payload.file);
    }

    // Since we're sending FormData, we need to ensure the apiClient doesn't 
    // force application/json. The apiClient should omit Content-Type for FormData.
    return api<FileRequest>(`/courses/${payload.courseId}/upload`, {
        method: "POST",
        body: formData as any
    });
};

/**
 * Lists all file requests for a specific user.
 * @backend GET /api/v1/me/requests
 */
export const listMyRequests = async (_userId: string): Promise<FileRequest[]> => {
    return api<FileRequest[]>("/me/requests");
};

/**
 * Withdraws/deletes a pending file request.
 * @backend DELETE /api/v1/me/requests/:requestId
 */
export const withdrawRequest = async (requestId: string, _userId: string): Promise<void> => {
    await api(`/me/requests/${requestId}`, { method: "DELETE" });
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Lists all file requests with optional filters (admin only).
 * @backend GET /api/v1/admin/requests
 */
export const listAllRequests = async (filters?: { status?: FileStatus }): Promise<FileRequest[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    return api<FileRequest[]>(`/admin/requests?${params.toString()}`);
};

/**
 * Lists pending file requests (admin only).
 * @backend GET /api/v1/admin/requests?status=pending
 */
export const listPendingRequests = async (): Promise<FileRequest[]> => {
    return listAllRequests({ status: "pending" });
};

/**
 * Gets request stats for admin dashboard.
 * @backend GET /api/v1/admin/requests/stats
 */
export const getRequestStats = async (): Promise<RequestStats> => {
    return api<RequestStats>("/admin/requests/stats");
};

/**
 * Approves a file request and awards points (admin only).
 * @backend PATCH /api/v1/admin/requests/:requestId/approve
 */
export const approveRequest = async (requestId: string, adminId: string, adminName: string): Promise<FileRequest | null> => {
    return api<FileRequest>(`/admin/requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ adminId, adminName, approve: true })
    });
};

/**
 * Rejects a file request with reason (admin only).
 * @backend PATCH /api/v1/admin/requests/:requestId/reject
 */
export const rejectRequest = async (
    requestId: string,
    adminId: string,
    reason: RejectReason,
    adminName: string,
    note?: string
): Promise<FileRequest | null> => {
    return api<FileRequest>(`/admin/requests/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminId, adminName, reason, note })
    });
};

/**
 * Bulk approve requests (admin only).
 * @backend POST /api/v1/admin/requests/bulk-approve
 */
export const bulkApprove = async (requestIds: string[], adminId: string, adminName: string): Promise<{ approved: number; skipped: number }> => {
    return api<{ approved: number; skipped: number }>("/admin/requests/bulk-approve", {
        method: "POST",
        body: JSON.stringify({ requestIds, adminId, adminName })
    });
};

/**
 * Bulk reject requests (admin only).
 * @backend POST /api/v1/admin/requests/bulk-reject
 */
export const bulkReject = async (
    requestIds: string[],
    adminId: string,
    reason: RejectReason,
    adminName: string
): Promise<{ rejected: number; skipped: number }> => {
    return api<{ rejected: number; skipped: number }>("/admin/requests/bulk-reject", {
        method: "POST",
        body: JSON.stringify({ requestIds, adminId, adminName, reason })
    });
};

/**
 * Undo approval (admin only) - reverts to pending and removes points.
 * @backend POST /api/v1/admin/requests/:requestId/undo-approve
 */
export const undoApprove = async (requestId: string, adminId: string, adminName: string): Promise<boolean> => {
    return api<boolean>(`/admin/requests/${requestId}/undo-approve`, {
        method: "POST",
        body: JSON.stringify({ adminId, adminName })
    });
};

/**
 * Undo rejection (admin only) - reverts to pending.
 * @backend POST /api/v1/admin/requests/:requestId/undo-reject
 */
export const undoReject = async (requestId: string, adminId: string, adminName: string): Promise<boolean> => {
    return api<boolean>(`/admin/requests/${requestId}/undo-reject`, {
        method: "POST",
        body: JSON.stringify({ adminId, adminName })
    });
};
