import { Link } from "react-router-dom";
import { ClipboardList, ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestStats } from "@/features/files/hooks/useRequests";

export default function AdminHome() {
    const { data: stats, isLoading, error } = useRequestStats();

    return (
        <div className="animate-fade-in max-w-3xl mx-auto pb-20">
            {/* Header */}
            <div className="py-4 mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <LayoutDashboard className="h-5 w-5 text-blue-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Admin Dashboard
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    Manage file requests and monitor moderation activity.
                </p>
            </div>

            {/* KPI Card */}
            <div className="mb-6">
                <div className="liquid-glass-subtle rounded-xl px-5 py-4 flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Pending Requests
                        </p>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : error ? (
                            <span className="text-destructive text-2xl font-bold">—</span>
                        ) : (
                            <div className="text-2xl font-bold text-foreground">{stats?.pending ?? 0}</div>
                        )}
                        <p className="text-[12px] text-muted-foreground/60 mt-0.5">Awaiting review</p>
                    </div>
                    <ClipboardList className="h-8 w-8 text-amber-400/60" />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="liquid-glass-subtle rounded-xl px-5 py-4 mb-6">
                <p className="text-[14px] font-semibold text-foreground mb-1">Quick Actions</p>
                <p className="text-[12px] text-muted-foreground mb-4">Jump directly into moderation tasks</p>
                <Button asChild size="lg" className="gap-2">
                    <Link to="/admin/requests">
                        <ClipboardList className="h-4 w-4" />
                        Start Reviewing
                        {stats?.pending ? (
                            <span className="ml-1 bg-foreground/20 px-2 py-0.5 rounded-full text-xs">
                                {stats.pending}
                            </span>
                        ) : null}
                        <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                </Button>
            </div>

            {/* Info Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="liquid-glass-subtle rounded-xl px-5 py-4 border border-dashed border-border/60">
                    <p className="text-[14px] font-semibold text-foreground mb-3">Keyboard Shortcuts</p>
                    <div className="text-[13px] text-muted-foreground space-y-2">
                        <p><kbd className="px-2 py-1 bg-foreground/10 rounded text-xs">Click row</kbd> → Open request details</p>
                        <p><kbd className="px-2 py-1 bg-foreground/10 rounded text-xs">Checkbox</kbd> → Select for bulk actions</p>
                        <p className="text-muted-foreground/50">More shortcuts coming soon...</p>
                    </div>
                </div>
                <div className="liquid-glass-subtle rounded-xl px-5 py-4 border border-dashed border-border/60">
                    <p className="text-[14px] font-semibold text-foreground mb-3">Moderation Guidelines</p>
                    <div className="text-[13px] text-muted-foreground space-y-2">
                        <p>• <strong>Approve</strong> files that are relevant and high quality</p>
                        <p>• <strong>Reject</strong> duplicates, outdated, or incorrect content</p>
                        <p>• Always provide a reason when rejecting</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
