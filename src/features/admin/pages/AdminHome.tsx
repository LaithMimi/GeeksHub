import { Link } from "react-router-dom";
import { ClipboardList, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestStats } from "@/hooks/useRequests";

export default function AdminHome() {
    const { data: stats, isLoading, error } = useRequestStats();

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-display font-bold tracking-tight text-white">Admin Dashboard</h1>
                <p className="text-white/60 mt-1">
                    Manage file requests and monitor moderation activity.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-1 max-w-md">
                {/* Pending */}
                <Card className="glass-card bg-transparent border-white/[0.06] text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                        <ClipboardList className="h-4 w-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : error ? (
                            <span className="text-destructive">Error</span>
                        ) : (
                            <div className="text-2xl font-bold">{stats?.pending ?? 0}</div>
                        )}
                        <p className="text-xs text-white/60">
                            Awaiting review
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card className="glass-card bg-transparent border-white/[0.06] text-white">
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Jump directly into moderation tasks</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <Button asChild size="lg" className="gap-2">
                        <Link to="/admin/requests">
                            <ClipboardList className="h-4 w-4" />
                            Start Reviewing
                            {stats?.pending ? (
                                <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                                    {stats.pending}
                                </span>
                            ) : null}
                            <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-dashed glass-card bg-transparent border-white/[0.06] text-white">
                    <CardHeader>
                        <CardTitle className="text-base">Keyboard Shortcuts</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-white/60 space-y-2">
                        <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Click row</kbd> → Open request details</p>
                        <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Checkbox</kbd> → Select for bulk actions</p>
                        <p>More shortcuts coming soon...</p>
                    </CardContent>
                </Card>
                <Card className="border-dashed glass-card bg-transparent border-white/[0.06] text-white">
                    <CardHeader>
                        <CardTitle className="text-base">Moderation Guidelines</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-white/60 space-y-2">
                        <p>• <strong>Approve</strong> files that are relevant and high quality</p>
                        <p>• <strong>Reject</strong> duplicates, outdated, or incorrect content</p>
                        <p>• Always provide a reason when rejecting</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
