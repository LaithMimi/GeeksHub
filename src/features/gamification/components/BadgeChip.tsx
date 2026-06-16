import { Gem, Medal, Star } from "lucide-react";
import type { BadgeTier } from "@/types/domain";

/** Visual style + icon for each reputation tier. */
const TIER: Record<BadgeTier, { label: string; icon: typeof Medal; className: string }> = {
    diamond:  { label: "Diamond",  icon: Gem,   className: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10" },
    gold:     { label: "Gold",     icon: Medal, className: "text-yellow-300 border-yellow-400/30 bg-yellow-400/10" },
    silver:   { label: "Silver",   icon: Medal, className: "text-slate-200 border-slate-300/30 bg-slate-300/10" },
    bronze:   { label: "Bronze",   icon: Medal, className: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    newcomer: { label: "Newcomer", icon: Star,  className: "text-muted-foreground border-border bg-foreground/5" },
};

/** Small pill showing a user's reputation tier (Diamond/Gold/Silver/Bronze/Newcomer). */
export function BadgeChip({ tier, className = "" }: { tier: BadgeTier; className?: string }) {
    const t = TIER[tier] ?? TIER.newcomer;
    const Icon = t.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium ${t.className} ${className}`}>
            <Icon className="h-3 w-3" />
            {t.label}
        </span>
    );
}
