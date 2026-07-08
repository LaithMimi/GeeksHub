/**
 * AuditLog Page
 * 
 * Displays an immutable record of all admin decisions.
 * Columns: Timestamp, Action, Request Title, Performed By, Details
 */

import { useState } from "react";
import { formatDate } from "@/lib/formatDate";
import { FileSearch, History, Search, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuditLogs } from "@/features/admin/hooks/useAudit";
import type { AuditAction, AuditLogEntry } from "@/types/domain";

// Action display config
const actionConfig: Record<AuditAction, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    approve: { label: "Approved", variant: "default" },
    reject: { label: "Rejected", variant: "destructive" },
    bulk_approve: { label: "Bulk Approved", variant: "default" },
    bulk_reject: { label: "Bulk Rejected", variant: "destructive" },
    withdraw: { label: "Withdrawn", variant: "secondary" },
    undo_approve: { label: "Undo Approve", variant: "outline" },
    undo_reject: { label: "Undo Reject", variant: "outline" },
    rename: { label: "Renamed", variant: "secondary" },
};

export default function AuditLog() {
    const [searchQuery, setSearchQuery] = useState("");
    const [actionFilter, setActionFilter] = useState<string>("all");
    
    // We pass undefined filters to the hook to get all, then filter locally
    // since the API may not support full text search on targetName.
    const { data: logs, isLoading, error } = useAuditLogs();

    const formatDetails = (log: AuditLogEntry) => {
        const meta = log.metaData ?? {};
        const parts: string[] = [];
        if (meta.courseName) parts.push(`Course: ${meta.courseName}`);
        if (meta.lecturerName) parts.push(`Lecturer: ${meta.lecturerName}`);
        if (meta.reason) parts.push(`Reason: ${meta.reason}`);
        if (meta.pointsAwarded) parts.push(`+${meta.pointsAwarded} pts`);
        if (meta.note) parts.push(`"${meta.note}"`);
        if (meta.from || meta.to) parts.push(`"${meta.from ?? ""}" → "${meta.to ?? ""}"`);
        return parts.join(" · ");
    };

    // Local filtering
    const filteredLogs = logs?.filter(log => {
        if (actionFilter !== "all" && log.action !== actionFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const targetName = log.metaData?.targetName?.toLowerCase() || "";
            const actorName = log.actorName?.toLowerCase() || "";
            const targetId = log.targetIds[0]?.toLowerCase() || "";
            return targetName.includes(q) || actorName.includes(q) || targetId.includes(q);
        }
        return true;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2 text-foreground">
                    <FileSearch className="h-6 w-6" />
                    Audit Log
                </h1>
                <p className="text-foreground/60 mt-1">
                    Immutable record of all moderation decisions.
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by target or actor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background/50 border-border/50 focus-visible:ring-blue-500/30"
                    />
                </div>
                <div className="w-full sm:w-48">
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="bg-background/50 border-border/50">
                            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            {Object.entries(actionConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                    {config.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content */}
            <Card className="glass-card bg-transparent border-border text-foreground">
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
                        <div className="text-center py-8 text-foreground/60">
                            Failed to load audit logs.
                        </div>
                    ) : !filteredLogs || filteredLogs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileSearch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-medium">No audit logs found</h3>
                            <p className="text-foreground/60 mt-1">
                                {logs && logs.length > 0 
                                    ? "No entries match your search filters."
                                    : "Audit entries will appear here after you approve or reject requests."}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border border-border bg-card">
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
                                    {filteredLogs.map((log) => {
                                        const config = actionConfig[log.action] ?? { label: log.action, variant: "outline" as const };
                                        
                                        let targetDisplay = "Unknown";
                                        if (log.metaData?.targetName) {
                                            targetDisplay = log.metaData.targetName;
                                        } else if (log.targetIds.length === 1) {
                                            targetDisplay = log.targetIds[0];
                                        } else if (log.targetIds.length > 1) {
                                            targetDisplay = `${log.targetIds.length} items`;
                                        }

                                        return (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-sm text-foreground/60 whitespace-nowrap">
                                                    {formatDate(log.timestamp, "MMM d, yyyy h:mm a")}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={config.variant}>
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">
                                                    {targetDisplay}
                                                </TableCell>
                                                <TableCell className="text-sm whitespace-nowrap">
                                                    {log.actorName}
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground/60">
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
