/**
 * ============================================================================
 * REQUEST SERVICE - Mock Implementation
 * ============================================================================
 * 
 * This service handles file request operations: creating, listing, withdrawing,
 * and admin approval/rejection of file upload requests.
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
 *    createFileRequest(payload) → POST /api/file-requests
 *    listMyRequests(userId) → GET /api/me/file-requests
 *    withdrawRequest(requestId) → DELETE /api/me/file-requests/:requestId
 *    listAllRequests(filters) → GET /api/admin/file-requests
 *    approveRequest(requestId, adminId) → PATCH /api/admin/file-requests/:requestId/approve
 *    rejectRequest(...) → PATCH /api/admin/file-requests/:requestId/reject
 *    bulkApprove(ids, adminId) → POST /api/admin/file-requests/bulk-approve
 *    bulkReject(ids, adminId, reason) → POST /api/admin/file-requests/bulk-reject
 *    getRequestStats() → GET /api/admin/file-requests/stats
 *    undoApprove(requestId) → POST /api/admin/file-requests/:requestId/undo-approve
 *    undoReject(requestId) → POST /api/admin/file-requests/:requestId/undo-reject
 * 
 * 3. Key security notes for backend:
 *    - Never expose other users' requests
 *    - Points awarding must be idempotent (use request_id as unique key)
 *    - Admin endpoints require role check middleware
 *    - All mutations must write to audit_logs table
 * ============================================================================
 */

import { fileRequests, randomDelay, pointsTransactions, auditLog, DEMO_ADMIN } from "@/mock/mock-db";
import type { FileRequest, MaterialType, RejectReason, RequestStats, AuditLogEntry, FileStatus } from "@/types/domain";

// Helper to generate mock IDs
const generateId = () => Math.random().toString(36).substring(7);

// Helper to check if date is today
const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
};

// Helper to write audit log
const writeAuditLog = (
    action: AuditLogEntry["action"],
    targetIds: string[],
    actorId: string,
    actorName: string,
    metadata: AuditLogEntry["metadata"]
) => {
    auditLog.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        actorId,
        actorName,
        action,
        targetType: "FileRequest",
        targetIds,
        metadata
    });
};

// ============================================================================
// USER FUNCTIONS
// ============================================================================

/**
 * Creates a new file upload request.
 * @backend POST /api/file-requests
 */
export const createFileRequest = async (payload: {
    userId: string;
    courseId: string;
    lecturerId: string;
    type: MaterialType;
    title: string;
    notes?: string;
}): Promise<FileRequest> => {
    await randomDelay(500, 1000);

    const newRequest: FileRequest = {
        id: generateId(),
        userId: payload.userId,
        uploaderName: "Current User", // Backend would look up from auth
        courseId: payload.courseId,
        lecturerId: payload.lecturerId,
        lecturerName: "Unknown Lecturer",
        type: payload.type,
        title: payload.title,
        notes: payload.notes,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    fileRequests.push(newRequest);
    return newRequest;
};

/**
 * Lists all file requests for a specific user.
 * @backend GET /api/me/file-requests
 */
export const listMyRequests = async (userId: string): Promise<FileRequest[]> => {
    await randomDelay();
    return fileRequests.filter(r => r.userId === userId);
};

/**
 * Withdraws/deletes a pending file request.
 * @backend DELETE /api/me/file-requests/:requestId
 */
export const withdrawRequest = async (requestId: string, userId: string): Promise<void> => {
    await randomDelay();
    const index = fileRequests.findIndex(r => r.id === requestId);
    if (index !== -1 && fileRequests[index].userId === userId) {
        fileRequests.splice(index, 1);
    }
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Lists all file requests with optional filters (admin only).
 * @backend GET /api/admin/file-requests
 */
export const listAllRequests = async (filters?: { status?: FileStatus }): Promise<FileRequest[]> => {
    await randomDelay();
    let result = [...fileRequests];
    if (filters?.status) {
        result = result.filter(r => r.status === filters.status);
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

/**
 * Lists pending file requests (admin only).
 * @backend GET /api/admin/file-requests?status=pending
 */
export const listPendingRequests = async (): Promise<FileRequest[]> => {
    return listAllRequests({ status: "pending" });
};

/**
 * Gets request stats for admin dashboard.
 * @backend GET /api/admin/file-requests/stats
 */
export const getRequestStats = async (): Promise<RequestStats> => {
    await randomDelay(200, 400);
    return {
        pending: fileRequests.filter(r => r.status === "pending").length,
        approvedToday: fileRequests.filter(r => r.status === "approved" && r.reviewedAt && isToday(r.reviewedAt)).length,
        rejectedToday: fileRequests.filter(r => r.status === "rejected" && r.reviewedAt && isToday(r.reviewedAt)).length
    };
};

/**
 * Approves a file request and awards points (admin only).
 * IDEMPOTENT: If already approved, returns without double-awarding.
 * @backend PATCH /api/admin/file-requests/:requestId/approve
 */
export const approveRequest = async (requestId: string, adminId: string, adminName: string = DEMO_ADMIN.name): Promise<FileRequest | null> => {
    await randomDelay(300, 600);
    const request = fileRequests.find(r => r.id === requestId);

    if (!request) return null;

    // IDEMPOTENCY: Skip if already approved
    if (request.status === "approved") {
        return request;
    }

    const previousStatus = request.status;
    const pointsToAward = 10;

    request.status = "approved";
    request.reviewedById = adminId;
    request.reviewedAt = new Date().toISOString();
    request.pointsAwarded = pointsToAward;

    // Award points (idempotent check)
    const existingTx = pointsTransactions.find(t => t.requestId === requestId);
    if (!existingTx) {
        pointsTransactions.push({
            id: generateId(),
            userId: request.userId,
            amount: pointsToAward,
            reason: "File Approved",
            date: new Date().toISOString(),
            requestId: requestId
        });
    }

    // Write audit log
    writeAuditLog("APPROVE", [requestId], adminId, adminName, {
        previousStatus,
        newStatus: "approved",
        pointsAwarded: pointsToAward
    });

    return request;
};

/**
 * Rejects a file request with reason (admin only).
 * @backend PATCH /api/admin/file-requests/:requestId/reject
 */
export const rejectRequest = async (
    requestId: string,
    adminId: string,
    reason: RejectReason,
    note?: string,
    adminName: string = DEMO_ADMIN.name
): Promise<FileRequest | null> => {
    await randomDelay(300, 600);
    const request = fileRequests.find(r => r.id === requestId);

    if (!request || request.status !== "pending") return null;

    const previousStatus = request.status;

    request.status = "rejected";
    request.reviewedById = adminId;
    request.reviewedAt = new Date().toISOString();
    request.rejectionReason = reason;
    request.rejectionNote = note;

    // Write audit log
    writeAuditLog("REJECT", [requestId], adminId, adminName, {
        previousStatus,
        newStatus: "rejected",
        reason,
        note
    });

    return request;
};

/**
 * Bulk approve requests (admin only).
 * IDEMPOTENT: Skips already-approved requests.
 * @backend POST /api/admin/file-requests/bulk-approve
 */
export const bulkApprove = async (requestIds: string[], adminId: string, adminName: string = DEMO_ADMIN.name): Promise<{ approved: number; skipped: number }> => {
    await randomDelay(500, 1000);

    let approved = 0;
    let skipped = 0;
    const approvedIds: string[] = [];

    for (const id of requestIds) {
        const request = fileRequests.find(r => r.id === id);
        if (!request) {
            skipped++;
            continue;
        }
        if (request.status !== "pending") {
            skipped++;
            continue;
        }

        request.status = "approved";
        request.reviewedById = adminId;
        request.reviewedAt = new Date().toISOString();
        request.pointsAwarded = 10;

        // Award points (idempotent)
        const existingTx = pointsTransactions.find(t => t.requestId === id);
        if (!existingTx) {
            pointsTransactions.push({
                id: generateId(),
                userId: request.userId,
                amount: 10,
                reason: "File Approved (Bulk)",
                date: new Date().toISOString(),
                requestId: id
            });
        }

        approved++;
        approvedIds.push(id);
    }

    if (approvedIds.length > 0) {
        writeAuditLog("BULK_APPROVE", approvedIds, adminId, adminName, {
            newStatus: "approved",
            pointsAwarded: 10
        });
    }

    return { approved, skipped };
};

/**
 * Bulk reject requests (admin only).
 * @backend POST /api/admin/file-requests/bulk-reject
 */
export const bulkReject = async (
    requestIds: string[],
    adminId: string,
    reason: RejectReason,
    adminName: string = DEMO_ADMIN.name
): Promise<{ rejected: number; skipped: number }> => {
    await randomDelay(500, 1000);

    let rejected = 0;
    let skipped = 0;
    const rejectedIds: string[] = [];

    for (const id of requestIds) {
        const request = fileRequests.find(r => r.id === id);
        if (!request || request.status !== "pending") {
            skipped++;
            continue;
        }

        request.status = "rejected";
        request.reviewedById = adminId;
        request.reviewedAt = new Date().toISOString();
        request.rejectionReason = reason;

        rejected++;
        rejectedIds.push(id);
    }

    if (rejectedIds.length > 0) {
        writeAuditLog("BULK_REJECT", rejectedIds, adminId, adminName, {
            newStatus: "rejected",
            reason
        });
    }

    return { rejected, skipped };
};

/**
 * Undo approval (admin only) - reverts to pending and removes points.
 * @backend POST /api/admin/file-requests/:requestId/undo-approve
 */
export const undoApprove = async (requestId: string, adminId: string, adminName: string = DEMO_ADMIN.name): Promise<boolean> => {
    await randomDelay(300, 600);
    const request = fileRequests.find(r => r.id === requestId);

    if (!request || request.status !== "approved") return false;

    // Remove points transaction
    const txIndex = pointsTransactions.findIndex(t => t.requestId === requestId);
    if (txIndex !== -1) {
        pointsTransactions.splice(txIndex, 1);
    }

    const previousStatus = request.status;
    request.status = "pending";
    request.reviewedById = undefined;
    request.reviewedAt = undefined;
    request.pointsAwarded = undefined;

    writeAuditLog("UNDO_APPROVE", [requestId], adminId, adminName, {
        previousStatus,
        newStatus: "pending"
    });

    return true;
};

/**
 * Undo rejection (admin only) - reverts to pending.
 * @backend POST /api/admin/file-requests/:requestId/undo-reject
 */
export const undoReject = async (requestId: string, adminId: string, adminName: string = DEMO_ADMIN.name): Promise<boolean> => {
    await randomDelay(300, 600);
    const request = fileRequests.find(r => r.id === requestId);

    if (!request || request.status !== "rejected") return false;

    const previousStatus = request.status;
    request.status = "pending";
    request.reviewedById = undefined;
    request.reviewedAt = undefined;
    request.rejectionReason = undefined;
    request.rejectionNote = undefined;

    writeAuditLog("UNDO_REJECT", [requestId], adminId, adminName, {
        previousStatus,
        newStatus: "pending"
    });

    return true;
};
