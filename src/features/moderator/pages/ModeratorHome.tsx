import { Link } from "react-router-dom";
import { LayoutDashboard, Users, UserPlus, ArrowRight, MessageSquare, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDirectoryStats } from "@/features/directory/hooks/useDirectory";
import { useFeedbackStats } from "@/features/feedback/hooks/useFeedback";

const KPI = ({
    label, value, hint, icon: Icon, loading,
}: {
    label: string;
    // string allows a "—" placeholder (e.g. NPS with no scored responses yet).
    value?: number | string;
    hint: string;
    icon: typeof Users;
    loading: boolean;
}) => (
    <div className="liquid-glass-subtle rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {label}
            </p>
            {loading ? (
                <Skeleton className="h-8 w-16" />
            ) : (
                <div className="text-2xl font-bold text-foreground">{value ?? 0}</div>
            )}
            <p className="text-[12px] text-muted-foreground/60 mt-0.5">{hint}</p>
        </div>
        <Icon className="h-8 w-8 text-amber-400/60" />
    </div>
);

export default function ModeratorHome() {
    const { data: stats, isLoading } = useDirectoryStats();
    const { data: feedback, isLoading: feedbackLoading } = useFeedbackStats();

    return (
        <div className="animate-fade-in max-w-3xl mx-auto pb-20">
            {/* Header */}
            <div className="py-4 mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <LayoutDashboard className="h-5 w-5 text-amber-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Moderator Dashboard
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    Manage platform users — view accounts, edit roles, and remove members.
                </p>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <KPI label="Total Users" value={stats?.totalUsers} hint="Registered accounts" icon={Users} loading={isLoading} />
                <KPI label="New This Week" value={stats?.newUsersThisWeek} hint="Joined in last 7 days" icon={UserPlus} loading={isLoading} />
                <KPI label="NPS Score" value={feedback?.npsScore ?? "—"} hint={`${feedback?.responded ?? 0} scored responses`} icon={TrendingUp} loading={feedbackLoading} />
            </div>

            {/* Quick links */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="liquid-glass-subtle rounded-xl px-5 py-5 flex flex-col gap-4">
                    <Users className="h-8 w-8 text-amber-400/80 shrink-0" />
                    <div className="flex-1">
                        <p className="text-[14px] font-semibold text-foreground mb-0.5">Manage Users</p>
                        <p className="text-[12px] text-muted-foreground">View, search, edit roles, and remove accounts.</p>
                    </div>
                    <Button asChild className="gap-2 w-full sm:w-auto sm:self-start">
                        <Link to="/moderator/users">
                            Open Users
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>

                <div className="liquid-glass-subtle rounded-xl px-5 py-5 flex flex-col gap-4">
                    <MessageSquare className="h-8 w-8 text-amber-400/80 shrink-0" />
                    <div className="flex-1">
                        <p className="text-[14px] font-semibold text-foreground mb-0.5">Feedback & NPS</p>
                        <p className="text-[12px] text-muted-foreground">See satisfaction trends and every user response.</p>
                    </div>
                    <Button asChild className="gap-2 w-full sm:w-auto sm:self-start">
                        <Link to="/moderator/feedback">
                            View Feedback
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
