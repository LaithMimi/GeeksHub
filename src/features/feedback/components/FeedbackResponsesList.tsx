import { Bug, Lightbulb, Heart, MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FeedbackCategory, FeedbackSubmission } from "@/types/domain";
import { sanitizePagePath } from "@/features/feedback/utils";

const CATEGORY_META: Record<FeedbackCategory, { label: string; icon: React.ElementType; className: string }> = {
    idea: { label: "Idea", icon: Lightbulb, className: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    bug: { label: "Bug", icon: Bug, className: "text-red-500 bg-red-500/10 border-red-500/20" },
    praise: { label: "Praise", icon: Heart, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    other: { label: "Other", icon: MoreHorizontal, className: "text-muted-foreground bg-muted border-border" },
};

/** Tint an NPS score by its promoter/passive/detractor band. */
const scoreClass = (score: number) =>
    score >= 9
        ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        : score >= 7
            ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
            : "text-red-500 bg-red-500/10 border-red-500/20";

const formatWhen = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export function FeedbackResponsesList({
    items,
    loading,
}: {
    items?: FeedbackSubmission[];
    loading: boolean;
}) {
    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (!items || items.length === 0) {
        return (
            <div className="liquid-glass-subtle rounded-xl px-5 py-10 text-center text-sm text-muted-foreground">
                No feedback yet.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {items.map((item) => {
                const meta = CATEGORY_META[item.category] ?? CATEGORY_META.other;
                const Icon = meta.icon;
                return (
                    <div key={item.id} className="liquid-glass-subtle rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                                    meta.className,
                                )}
                            >
                                <Icon className="h-3 w-3" />
                                {meta.label}
                            </span>
                            {item.score !== null && (
                                <span
                                    className={cn(
                                        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                                        scoreClass(item.score),
                                    )}
                                >
                                    NPS {item.score}
                                </span>
                            )}
                            <span className="text-[12px] font-medium text-foreground">{item.userName}</span>
                            <span className="ms-auto text-[11px] text-muted-foreground/60">{formatWhen(item.createdAt)}</span>
                        </div>
                        {item.comment && (
                            <p className="mt-2 text-[13px] text-foreground/90 whitespace-pre-wrap break-words">{item.comment}</p>
                        )}
                        {item.page && (
                            <p className="mt-1 text-[11px] text-muted-foreground/50">on {sanitizePagePath(item.page)}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
