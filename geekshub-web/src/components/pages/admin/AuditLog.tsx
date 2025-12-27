/**
 * AuditLog Page
 * 
 * Displays an immutable record of all admin decisions.
 * Columns: Timestamp, Action, Request Title, Performed By, Details
 */

import { format } from "date-fns";
import { FileSearch, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuditLogs } from "@/queries/useAudit";
import type { AuditAction, AuditLogEntry } from "@/types/domain";

// Action display config
const actionConfig: Record<AuditAction, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    APPROVE: { label: "Approved", variant: "default" },
    REJECT: { label: "Rejected", variant: "destructive" },
    BULK_APPROVE: { label: "Bulk Approved", variant: "default" },
    BULK_REJECT: { label: "Bulk Rejected", variant: "destructive" },
    WITHDRAW: { label: "Withdrawn", variant: "secondary" },
    UNDO_APPROVE: { label: "Undo Approve", variant: "outline" },
    UNDO_REJECT: { label: "Undo Reject", variant: "outline" },
};

export default function AuditLog() {
    const { data: logs, isLoading, error } = useAuditLogs();

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "MMM d, yyyy h:mm:ss a");
        } catch {
            return dateStr;
        }
    };

    const formatDetails = (log: AuditLogEntry) => {
        const parts: string[] = [];
        if (log.metadata.reason) {
            parts.push(`Reason: ${log.metadata.reason}`);
        }
        if (log.metadata.pointsAwarded) {
            parts.push(`+${log.metadata.pointsAwarded} pts`);
        }
        if (log.metadata.note) {
            parts.push(`"${log.metadata.note}"`);
        }
        return parts.join(" · ");
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FileSearch className="h-6 w-6" />
                    Audit Log
                </h1>
                <p className="text-muted-foreground mt-1">
                    Immutable record of all moderation decisions.
                </p>
            </div>

            {/* Content */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Recent Activity
                    </CardTitle>
                    <CardDescription>
                        All approve, reject, and undo actions are logged here.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Failed to load audit logs.
                        </div>
                    ) : !logs || logs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileSearch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-medium">No audit logs yet</h3>
                            <p className="text-muted-foreground mt-1">
                                Audit entries will appear here after you approve or reject requests.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Target(s)</TableHead>
                                        <TableHead>Performed By</TableHead>
                                        <TableHead>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => {
                                        const config = actionConfig[log.action];
                                        return (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDate(log.timestamp)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={config.variant}>
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {log.targetIds.length === 1
                                                        ? log.targetIds[0]
                                                        : `${log.targetIds.length} items`
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    {log.actorName}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                    {formatDetails(log) || "—"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
