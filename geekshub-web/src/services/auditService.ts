/**
 * ============================================================================
 * AUDIT SERVICE - Mock Implementation
 * ============================================================================
 * 
 * This service provides access to admin audit logs.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * When the backend is implemented:
 * 
 *    listAuditLogs(filters) → GET /api/admin/audit-logs
 *    - Backend: SELECT * FROM audit_logs ORDER BY timestamp DESC
 *    - Add pagination: ?page=1&limit=50
 *    - Add filters: ?action=APPROVE&actorId=...
 * ============================================================================
 */

import { auditLog, randomDelay } from "@/mock/mock-db";
import type { AuditLogEntry, AuditAction } from "@/types/domain";

export interface AuditLogFilters {
    action?: AuditAction;
    actorId?: string;
    limit?: number;
}

/**
 * Lists audit log entries with optional filters.
 * @backend GET /api/admin/audit-logs
 */
export const listAuditLogs = async (filters?: AuditLogFilters): Promise<AuditLogEntry[]> => {
    await randomDelay();

    let result = [...auditLog];

    if (filters?.action) {
        result = result.filter(e => e.action === filters.action);
    }
    if (filters?.actorId) {
        result = result.filter(e => e.actorId === filters.actorId);
    }

    // Sort by timestamp descending (newest first)
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (filters?.limit) {
        result = result.slice(0, filters.limit);
    }

    return result;
};
