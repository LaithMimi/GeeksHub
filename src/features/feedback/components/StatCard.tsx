import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * KPI tile matching the moderator dashboard style (`liquid-glass-subtle`).
 * Mirrors the local KPI used in ModeratorHome, generalized for feedback stats.
 */
export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    loading,
    accent = "text-amber-400/60",
}: {
    label: string;
    value?: ReactNode;
    hint?: string;
    icon: React.ElementType;
    loading?: boolean;
    accent?: string;
}) {
    return (
        <div className="liquid-glass-subtle rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {label}
                </p>
                {loading ? (
                    <Skeleton className="h-8 w-16" />
                ) : (
                    <div className="text-2xl font-bold text-foreground">{value ?? "—"}</div>
                )}
                {hint && <p className="text-[12px] text-muted-foreground/60 mt-0.5">{hint}</p>}
            </div>
            <Icon className={`h-8 w-8 shrink-0 ${accent}`} />
        </div>
    );
}
