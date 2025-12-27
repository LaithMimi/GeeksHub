/**
 * ============================================================================
 * AUDIT QUERY HOOKS
 * ============================================================================
 * 
 * TanStack Query hooks for audit log queries (admin only).
 * ============================================================================
 */

import { useQuery } from "@tanstack/react-query";
import { listAuditLogs, type AuditLogFilters } from "@/services/auditService";

/**
 * Fetches audit log entries with optional filters.
 */
export const useAuditLogs = (filters?: AuditLogFilters) => useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => listAuditLogs(filters)
});
