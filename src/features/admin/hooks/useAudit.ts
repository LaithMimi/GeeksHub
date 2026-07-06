/**
 * ============================================================================
 * AUDIT QUERY HOOKS
 * ============================================================================
 * 
 * TanStack Query hooks for audit log queries (admin only).
 * ============================================================================
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { listAuditLogs, type AuditLogFilters } from "@/features/admin/api/auditService";

/**
 * Fetches audit log entries with optional filters.
 */
export const useAuditLogs = (filters?: AuditLogFilters) => useQuery({
    queryKey: queryKeys.audit.filtered(filters),
    queryFn: () => listAuditLogs(filters)
});
