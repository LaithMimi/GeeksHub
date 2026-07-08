/**
 * AuditLog Page — redesigned
 *
 * Timeline-style activity feed showing every admin action with
 * human-readable descriptions instead of raw IDs.
 */

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/formatDate";
import {
    FileSearch, Search, Filter, CheckCircle2, XCircle, Undo2,
    Pencil, Trash2, Settings2, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuditLogs } from "@/features/admin/hooks/useAudit";
import type { AuditLogEntry } from "@/types/domain";

/* ------------------------------------------------------------------ */
/* Action config                                                       */
/* ------------------------------------------------------------------ */

const actionConfig: Record<string, {
    label: string;
    icon: typeof CheckCircle2;
    color: string;       // tailwind text color
    bgColor: string;     // tailwind bg color for icon circle
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
}> = {
    approve:      { label: "Approved",      icon: CheckCircle2, color: "text-emerald-400", bgColor: "bg-emerald-500/15", badgeVariant: "default" },
    reject:       { label: "Rejected",      icon: XCircle,      color: "text-red-400",     bgColor: "bg-red-500/15",     badgeVariant: "destructive" },
    bulk_approve: { label: "Bulk Approved", icon: CheckCircle2, color: "text-emerald-400", bgColor: "bg-emerald-500/15", badgeVariant: "default" },
    bulk_reject:  { label: "Bulk Rejected", icon: XCircle,      color: "text-red-400",     bgColor: "bg-red-500/15",     badgeVariant: "destructive" },
    withdraw:     { label: "Withdrawn",     icon: Undo2,        color: "text-amber-400",   bgColor: "bg-amber-500/15",   badgeVariant: "secondary" },
    undo_approve: { label: "Undo Approve",  icon: Undo2,        color: "text-slate-400",   bgColor: "bg-slate-500/15",   badgeVariant: "outline" },
    undo_reject:  { label: "Undo Reject",   icon: Undo2,        color: "text-slate-400",   bgColor: "bg-slate-500/15",   badgeVariant: "outline" },
    rename:       { label: "Renamed",       icon: Pencil,       color: "text-blue-400",    bgColor: "bg-blue-500/15",    badgeVariant: "secondary" },
    Update:       { label: "Updated",       icon: Settings2,    color: "text-blue-400",    bgColor: "bg-blue-500/15",    badgeVariant: "secondary" },
    Delete:       { label: "Deleted",       icon: Trash2,       color: "text-red-400",     bgColor: "bg-red-500/15",     badgeVariant: "destructive" },
};

const fallbackConfig = { label: "Action", icon: ShieldCheck, color: "text-muted-foreground", bgColor: "bg-muted/50", badgeVariant: "outline" as const };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Build a human-readable sentence from a log entry. */
function buildDescription(log: AuditLogEntry): string {
    const meta = log.metaData ?? {};
    const target = meta.targetName ?? "a file";
    const actor = log.actorName ?? "An admin";

    switch (log.action) {
        case "approve":
            return `${actor} approved "${target}"`;
        case "reject": {
            const reason = meta.reason || meta.note;
            return reason
                ? `${actor} rejected "${target}" — ${reason}`
                : `${actor} rejected "${target}"`;
        }
        case "bulk_approve":
            return `${actor} bulk-approved ${target}`;
        case "bulk_reject":
            return `${actor} bulk-rejected ${target}`;
        case "withdraw":
            return `${actor} withdrew "${target}"`;
        case "undo_approve":
            return `${actor} undid approval of "${target}"`;
        case "undo_reject":
            return `${actor} undid rejection of "${target}"`;
        case "rename":
            return meta.from && meta.to
                ? `${actor} renamed "${meta.from}" → "${meta.to}"`
                : `${actor} renamed "${target}"`;
        default:
            // "Update", "Delete", or unknown
            return `${actor} ${log.action.toLowerCase()}d "${target}"`;
    }
}

function relativeTime(iso: string): string {
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
        return iso;
    }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AuditLog() {
    const [searchQuery, setSearchQuery] = useState("");
    const [actionFilter, setActionFilter] = useState<string>("all");
    const { data: logs, isLoading, error } = useAuditLogs();

    const filtered = useMemo(() => {
        if (!logs) return [];
        return logs.filter(log => {
            if (actionFilter !== "all" && log.action !== actionFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const description = buildDescription(log).toLowerCase();
                const actorName = log.actorName?.toLowerCase() || "";
                return description.includes(q) || actorName.includes(q);
            }
            return true;
        });
    }, [logs, searchQuery, actionFilter]);

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="py-4 mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <FileSearch className="h-5 w-5 text-blue-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Audit Log
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    Every admin action is recorded here. This log is immutable.
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                        placeholder="Search by file name, admin, or action…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="w-full sm:w-48">
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger>
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
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="liquid-glass-subtle rounded-xl px-4 py-4 flex gap-4 items-start">
                            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="text-center py-16 text-muted-foreground text-[14px]">
                    Failed to load audit logs.
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                    <FileSearch className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-[14px] text-muted-foreground">
                        {logs && logs.length > 0
                            ? "No entries match your search."
                            : "No audit entries yet. They'll appear as you moderate."}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((log) => {
                        const config = actionConfig[log.action] ?? fallbackConfig;
                        const Icon = config.icon;
                        const description = buildDescription(log);
                        const meta = log.metaData ?? {};

                        return (
                            <div
                                key={log.id}
                                className="liquid-glass-subtle rounded-xl overflow-hidden"
                            >
                                <div className="flex items-start gap-3.5 px-4 py-3.5">
                                    {/* Icon */}
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${config.bgColor}`}>
                                        <Icon className={`h-4 w-4 ${config.color}`} />
                                    </div>

                                    {/* Description */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] text-foreground leading-relaxed">
                                            {description}
                                        </p>
                                        {/* Extra detail chips */}
                                        {(meta.courseName || meta.lecturerName || meta.filename || meta.pointsAwarded) && (
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {meta.courseName && (
                                                    <span className="text-[11px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-md">
                                                        {meta.courseName}
                                                    </span>
                                                )}
                                                {meta.lecturerName && (
                                                    <span className="text-[11px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-md">
                                                        {meta.lecturerName}
                                                    </span>
                                                )}
                                                {meta.filename && (
                                                    <span className="text-[11px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-md font-mono">
                                                        {meta.filename}
                                                    </span>
                                                )}
                                                {meta.pointsAwarded && (
                                                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                        +{meta.pointsAwarded} XP
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right side: badge + time */}
                                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                                        <Badge variant={config.badgeVariant} className="text-[10px]">
                                            {config.label}
                                        </Badge>
                                        <span
                                            className="text-[11px] text-muted-foreground/60 whitespace-nowrap"
                                            title={formatDate(log.timestamp, "PPpp")}
                                        >
                                            {relativeTime(log.timestamp)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
