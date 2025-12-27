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
 *    - Backend: INSERT INTO file_requests (...) VALUES (...)
 *    - Return the created request with server-generated ID
 *    - Handle file upload to S3/GCS if file is attached
 * 
 *    listMyRequests(userId) → GET /api/me/file-requests
 *    - Backend: SELECT * FROM file_requests WHERE user_id = :currentUserId
 *    - ⚠️ SECURITY: Backend MUST filter by authenticated user, never trust client userId
 *    - Add pagination: ?page=1&limit=20&status=pending
 * 
 *    withdrawRequest(requestId) → DELETE /api/me/file-requests/:requestId
 *    - Backend: UPDATE file_requests SET status = 'withdrawn' WHERE id = ? AND user_id = :currentUserId
 *    - ⚠️ SECURITY: Always verify ownership before deleting
 * 
 *    listPendingRequests() → GET /api/admin/file-requests?status=pending
 *    - Backend: SELECT * FROM file_requests WHERE status = 'pending' (admin only)
 *    - Requires admin authorization middleware
 * 
 *    approveRequest(requestId, adminId) → PATCH /api/admin/file-requests/:requestId/approve
 *    - Backend: 
 *      1. UPDATE file_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
 *      2. INSERT INTO points_transactions (...) - IDEMPOTENT (check if already awarded)
 *    - Use database transaction for atomicity
 * 
 * 3. Example real implementation:
 *    ```ts
 *    export const createFileRequest = async (payload: CreateRequestPayload): Promise<FileRequest> => {
 *        return api<FileRequest>("/api/file-requests", {
 *            method: "POST",
 *            body: JSON.stringify(payload)
 *        });
 *    };
 *    
 *    export const listMyRequests = async (): Promise<FileRequest[]> => {
 *        // No userId param needed - backend uses session/JWT
 *        return api<FileRequest[]>("/api/me/file-requests");
 *    };
 *    ```
 * 
 * 4. Key security notes for backend:
 *    - Never expose other users' requests
 *    - Points awarding must be idempotent (use request_id as unique key)
 *    - Admin endpoints require role check middleware
 * 
 * 5. Keep function signatures unchanged - TanStack Query hooks won't need updates.
 * ============================================================================
 */

import { fileRequests, randomDelay, pointsTransactions } from "@/mock/mock-db";
import type { FileRequest, MaterialType } from "@/types/domain";

/**
 * Creates a new file upload request.
 * @param payload - Request details (userId, courseId, lecturerId, type, title, notes)
 * @backend POST /api/file-requests
 * @returns The created FileRequest with server-generated ID
 */
export const createFileRequest = async (payload: {
    userId: string;
    courseId: string;
    lecturerId: string;
    type: MaterialType;
    title: string;
    notes?: string;
}): Promise<FileRequest> => {
    await randomDelay(500, 1000); // Slower write

    const newRequest: FileRequest = {
        id: Math.random().toString(36).substring(7), // Mock ID - backend generates this
        userId: payload.userId,
        courseId: payload.courseId,
        lecturerId: payload.lecturerId,
        lecturerName: "Unknown Lecturer", // Backend should look up from lecturerId
        type: payload.type,
        title: payload.title,
        notes: payload.notes,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    // In-memory mutation
    fileRequests.push(newRequest);
    return newRequest;
};

/**
 * Lists all file requests for a specific user.
 * @param userId - The user ID to filter by
 * @backend GET /api/me/file-requests
 * @security Backend MUST filter by authenticated session, not client-provided userId
 */
export const listMyRequests = async (userId: string): Promise<FileRequest[]> => {
    await randomDelay();
    return fileRequests.filter(r => r.userId === userId);
};

/**
 * Withdraws/deletes a pending file request.
 * @param requestId - The request ID to withdraw
 * @param userId - The user ID (for ownership verification)
 * @backend DELETE /api/me/file-requests/:requestId
 * @security Backend MUST verify ownership before deletion
 */
export const withdrawRequest = async (requestId: string, userId: string): Promise<void> => {
    await randomDelay();
    const index = fileRequests.findIndex(r => r.id === requestId);
    if (index !== -1 && fileRequests[index].userId === userId) {
        // Ideally change status to withdrawn or delete
        fileRequests.splice(index, 1);
    }
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Lists all pending file requests (admin only).
 * @backend GET /api/admin/file-requests?status=pending
 * @security Requires ADMIN or MODERATOR role
 */
export const listPendingRequests = async (): Promise<FileRequest[]> => {
    await randomDelay();
    return fileRequests.filter(r => r.status === "pending");
};

/**
 * Approves a file request and awards points (admin only).
 * @param requestId - The request ID to approve
 * @param adminId - The admin user ID who approved
 * @backend PATCH /api/admin/file-requests/:requestId/approve
 * @security Requires ADMIN role
 * @note Points awarding is IDEMPOTENT - backend checks if already awarded
 */
export const approveRequest = async (requestId: string, adminId: string): Promise<void> => {
    await randomDelay(400, 800);
    const request = fileRequests.find(r => r.id === requestId);

    if (request && request.status === "pending") {
        request.status = "approved";
        request.reviewedBy = adminId;
        request.reviewedAt = new Date().toISOString();
        request.points = 10;

        // Award points transaction (Idempotency check: simplified)
        // Backend: INSERT INTO points_transactions (...) ON CONFLICT (request_id) DO NOTHING
        const existingTx = pointsTransactions.find(t => t.requestId === requestId);
        if (!existingTx) {
            pointsTransactions.push({
                id: Math.random().toString(36).substring(7),
                userId: request.userId,
                amount: 10,
                reason: "File Approved",
                date: new Date().toISOString(),
                requestId: requestId
            });
        }
    }
};
