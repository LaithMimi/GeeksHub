import { api } from "@/lib/apiClient";
import type { AuditLogEntry, AuditAction } from "@/types/domain";

export interface AuditLogFilters {
    action?: AuditAction;
    actorId?: string;
    limit?: number;
}

/**
 * Lists audit log entries with optional filters.
 * @backend GET /api/v1/admin/audit-logs
 */
export const listAuditLogs = async (filters?: AuditLogFilters): Promise<AuditLogEntry[]> => {
    const params = new URLSearchParams();
    if (filters?.action) params.append("action", filters.action);
    if (filters?.actorId) params.append("actor_id", filters.actorId);
    if (filters?.limit) params.append("limit", filters.limit.toString());

    return await api<AuditLogEntry[]>(`/admin/audit-logs?${params.toString()}`);
};
