/**
 * FeedbackDashboard (moderator-only)
 *
 * NPS + feedback statistics: headline KPIs, a promoter/passive/detractor split,
 * an NPS trend line and score-distribution bars (Recharts), a category
 * breakdown, and a filterable list of individual responses.
 */

import { useState } from "react";
import {
    MessageSquare, TrendingUp, ThumbsUp, ThumbsDown, Inbox,
} from "lucide-react";
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FeedbackCategory } from "@/types/domain";
import { useFeedbackStats, useFeedbackList } from "@/features/feedback/hooks/useFeedback";
import { StatCard } from "@/features/feedback/components/StatCard";
import { FeedbackResponsesList } from "@/features/feedback/components/FeedbackResponsesList";

const AXIS_TICK = { fill: "#94a3b8", fontSize: 11 };
const GRID_STROKE = "rgb(148 163 184 / 0.15)";
// Theme-aware via CSS tokens so tooltips read correctly in both light and dark.
const TOOLTIP_STYLE = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--popover-foreground))",
} as const;

/** Parse a "YYYY-MM-DD" date as local time (not UTC) so labels don't shift a day. */
const localDateLabel = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const CATEGORY_FILTERS: { value: FeedbackCategory | "all"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "idea", label: "Ideas" },
    { value: "bug", label: "Bugs" },
    { value: "praise", label: "Praise" },
    { value: "other", label: "Other" },
];

/** Bar colour for an NPS score by its band. */
const scoreBandColor = (score: number) =>
    score >= 9 ? "#10b981" : score >= 7 ? "#f59e0b" : "#ef4444";

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default function FeedbackDashboard() {
    const { data: stats, isLoading: statsLoading } = useFeedbackStats();
    const [category, setCategory] = useState<FeedbackCategory | "all">("all");
    const { data: responses, isLoading: listLoading } = useFeedbackList(
        category === "all" ? undefined : { category },
    );

    const distributionData = stats
        ? Object.entries(stats.distribution).map(([score, count]) => ({ score: Number(score), count }))
        : [];
    const trendData = stats
        ? stats.trend.map((p) => ({ ...p, label: localDateLabel(p.date) }))
        : [];
    const categoryData = stats
        ? Object.entries(stats.byCategory).map(([name, count]) => ({ name, count }))
        : [];

    const responded = stats?.responded ?? 0;

    return (
        <div className="animate-fade-in max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="py-4 mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <MessageSquare className="h-5 w-5 text-amber-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Feedback & NPS
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    What users are telling us — satisfaction score, trends, and every response.
                </p>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard
                    label="NPS Score"
                    value={stats?.npsScore ?? "—"}
                    hint={`${responded} scored ${responded === 1 ? "response" : "responses"}`}
                    icon={TrendingUp}
                    loading={statsLoading}
                    accent="text-blue-400/70"
                />
                <StatCard
                    label="Total Feedback"
                    value={stats?.total}
                    hint="All submissions"
                    icon={Inbox}
                    loading={statsLoading}
                />
                <StatCard
                    label="Promoters"
                    value={stats ? `${pct(stats.promoters, responded)}%` : undefined}
                    hint={`${stats?.promoters ?? 0} rated 9–10`}
                    icon={ThumbsUp}
                    loading={statsLoading}
                    accent="text-emerald-400/70"
                />
                <StatCard
                    label="Detractors"
                    value={stats ? `${pct(stats.detractors, responded)}%` : undefined}
                    hint={`${stats?.detractors ?? 0} rated 0–6`}
                    icon={ThumbsDown}
                    loading={statsLoading}
                    accent="text-red-400/70"
                />
            </div>

            {/* Promoter / passive / detractor split */}
            <div className="liquid-glass-subtle rounded-xl px-5 py-4 mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Response Breakdown
                </p>
                {statsLoading ? (
                    <Skeleton className="h-4 w-full" />
                ) : responded > 0 && stats ? (
                    <>
                        <div className="flex h-3 w-full overflow-hidden rounded-full">
                            <div style={{ width: `${pct(stats.detractors, responded)}%` }} className="bg-red-500" />
                            <div style={{ width: `${pct(stats.passives, responded)}%` }} className="bg-amber-500" />
                            <div style={{ width: `${pct(stats.promoters, responded)}%` }} className="bg-emerald-500" />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
                            <span><span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1.5" />Detractors {stats.detractors}</span>
                            <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500 mr-1.5" />Passives {stats.passives}</span>
                            <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />Promoters {stats.promoters}</span>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">No scored responses yet.</p>
                )}
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2 mb-6">
                {/* NPS trend */}
                <div className="liquid-glass-subtle rounded-xl px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        NPS Trend (weekly)
                    </p>
                    {statsLoading ? (
                        <Skeleton className="h-[220px] w-full" />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis domain={[-100, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={TOOLTIP_STYLE}
                                    formatter={(v) => [v ?? "—", "NPS"]}
                                />
                                <ReferenceLine y={0} stroke={GRID_STROKE} />
                                <Line type="monotone" dataKey="npsScore" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Score distribution */}
                <div className="liquid-glass-subtle rounded-xl px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Score Distribution
                    </p>
                    {statsLoading ? (
                        <Skeleton className="h-[220px] w-full" />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={distributionData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                <XAxis dataKey="score" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
                                    contentStyle={TOOLTIP_STYLE}
                                    formatter={(v) => [v, "Responses"]}
                                    labelFormatter={(l) => `Score ${l}`}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {distributionData.map((d) => (
                                        <Cell key={d.score} fill={scoreBandColor(d.score)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Category breakdown */}
            <div className="liquid-glass-subtle rounded-xl px-5 py-4 mb-8">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    By Category
                </p>
                {statsLoading ? (
                    <Skeleton className="h-[140px] w-full" />
                ) : categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} />
                            <Tooltip
                                cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
                                contentStyle={TOOLTIP_STYLE}
                                formatter={(v) => [v, "Count"]}
                            />
                            <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-sm text-muted-foreground">No feedback yet.</p>
                )}
            </div>

            {/* Responses list */}
            <div>
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="text-[15px] font-display font-semibold text-foreground">Responses</h2>
                    <div className="flex gap-1.5 flex-wrap">
                        {CATEGORY_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setCategory(f.value)}
                                className={cn(
                                    "rounded-lg px-3 py-1 text-[12px] font-medium border transition-colors",
                                    category === f.value
                                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                        : "border-border text-muted-foreground hover:bg-muted/50",
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <FeedbackResponsesList items={responses} loading={listLoading} />
            </div>
        </div>
    );
}
