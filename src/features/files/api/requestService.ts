import { api, apiFetch } from "@/lib/apiClient";
import type { FileRequest, RejectReason, RequestStats, FileStatus } from "@/types/domain";

// ============================================================================
// USER FUNCTIONS
// ============================================================================

/**
 * Creates a new file upload request.
 * userId is NOT sent — backend extracts it from the JWT cookie.
 * @backend POST /api/v1/courses/{course_id}/upload
 */
export const createFileRequest = async (payload: {
    courseId: string;
    lecturerId: string;
    type_id: string;   // UUID — renamed from `type` to match backend Form field
    title: string;
    academic_year: number;  // program year level: 1, 2, 3, or 4
    material_year: number;  // calendar year of the material, e.g. 2024
    notes?: string;
    file: File;
}): Promise<FileRequest> => {
    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("lecturer_id", payload.lecturerId);
    formData.append("type_id", payload.type_id);
    formData.append("academic_year", payload.academic_year.toString());
    formData.append("material_year", payload.material_year.toString());
    formData.append("file", payload.file);
    if (payload.notes) {
        formData.append("notes", payload.notes);
    }

    // FormData must be sent as-is — do NOT set Content-Type manually.
    // The browser sets it automatically with the correct multipart boundary.
    return api<FileRequest>(`/courses/${payload.courseId}/upload`, {
        method: "POST",
        body: formData as any,
    });
};

/**
 * Lists all file requests for the current authenticated user.
 * No userId param — backend resolves identity from the JWT cookie.
 * @backend GET /api/v1/me/requests
 */
export const listMyRequests = async (): Promise<FileRequest[]> => {
    return api<FileRequest[]>("/me/requests");
};

/**
 * Withdraws a pending file request.
 * No userId sent — backend validates ownership via JWT.
 * @backend DELETE /api/v1/me/requests/:requestId
 */
export const withdrawRequest = async (requestId: string): Promise<void> => {
    await api(`/me/requests/${requestId}`, { method: "DELETE" });
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Lists all file requests with optional status filter (admin only).
 * @backend GET /api/v1/admin/requests?status=
 */
export const listAllRequests = async (filters?: { status?: FileStatus }): Promise<FileRequest[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    const qs = params.toString();
    return api<FileRequest[]>(`/admin/requests${qs ? `?${qs}` : ""}`);
};

/**
 * Lists only pending file requests (admin only).
 * @backend GET /api/v1/admin/requests?status=pending
 */
export const listPendingRequests = async (): Promise<FileRequest[]> => {
    return listAllRequests({ status: "pending" });
};

/**
 * Gets aggregate request stats for the admin dashboard.
 * @backend GET /api/v1/admin/requests/stats
 */
export const getRequestStats = async (): Promise<RequestStats> => {
    return api<RequestStats>("/admin/requests/stats");
};

/**
 * Approves a file request (admin only).
 * Admin identity is derived from the JWT on the server — not sent in body.
 * @backend POST /api/v1/admin/requests/:requestId/approve
 */
export const approveRequest = async (requestId: string): Promise<FileRequest | null> => {
    return api<FileRequest>(`/admin/requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ approve: true }),
    });
};

/**
 * Rejects a file request with a reason (admin only).
 * Admin identity is derived from the JWT on the server — not sent in body.
 * @backend POST /api/v1/admin/requests/:requestId/reject
 */
export const rejectRequest = async (
    requestId: string,
    reason: RejectReason,
    note?: string
): Promise<FileRequest | null> => {
    return api<FileRequest>(`/admin/requests/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason, note }),
    });
};

/**
 * Renames (edits the title of) a file request (admin only).
 * Syncs the linked catalog Material title too if the request is already approved.
 * Admin identity is derived from the JWT on the server — not sent in body.
 * @backend PATCH /api/v1/admin/requests/:requestId
 */
export const renameRequest = async (
    requestId: string,
    title: string
): Promise<{ id: string; title: string }> => {
    return api<{ id: string; title: string }>(`/admin/requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
    });
};

/**
 * Bulk approves multiple requests (admin only).
 * Admin identity is derived from the JWT on the server — not sent in body.
 * @backend POST /api/v1/admin/requests/bulk-approve
 */
export const bulkApprove = async (
    requestIds: string[]
): Promise<{ approved: number; skipped: number }> => {
    return api<{ approved: number; skipped: number }>("/admin/requests/bulk-approve", {
        method: "POST",
        body: JSON.stringify({ request_ids: requestIds }),  // snake_case — matches BulkActionPayload on backend
    });
};

/**
 * Bulk rejects multiple requests (admin only).
 * Admin identity is derived from the JWT on the server — not sent in body.
 * @backend POST /api/v1/admin/requests/bulk-reject
 */
export const bulkReject = async (
    requestIds: string[],
    reason: RejectReason
): Promise<{ rejected: number; skipped: number }> => {
    return api<{ rejected: number; skipped: number }>("/admin/requests/bulk-reject", {
        method: "POST",
        body: JSON.stringify({ request_ids: requestIds, reason }), // snake_case — matches BulkActionPayload
    });
};

/**
 * Reverts an approved request back to pending and removes XP (admin only).
 * Admin identity is derived from the JWT on the server — not sent in body.
 * @backend POST /api/v1/admin/requests/:requestId/undo-approve
 */
export const undoApprove = async (requestId: string): Promise<void> => {
    await api(`/admin/requests/${requestId}/undo-approve`, { method: "POST" });
};

/**
 * Reverts a rejected request back to pending (admin only).
 * Admin identity is derived from the JWT on the server — not sent in body.
 * @backend POST /api/v1/admin/requests/:requestId/undo-reject
 */
export const undoReject = async (requestId: string): Promise<void> => {
    await api(`/admin/requests/${requestId}/undo-reject`, { method: "POST" });
};

/**
 * Streams an unapproved file request and wraps it in a blob object URL for preview.
 * NOTE: the returned object URL must be revoked by the caller (URL.revokeObjectURL)
 * once it is no longer rendered, or the blob leaks for the page's lifetime.
 * @backend GET /api/v1/admin/requests/{request_id}/preview
 */
export const getRequestPreviewUrl = async (requestId: string): Promise<{ url: string }> => {
    const res = await apiFetch(`/admin/requests/${requestId}/preview`);
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob) };
};