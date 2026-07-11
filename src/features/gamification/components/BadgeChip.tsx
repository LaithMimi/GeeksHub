import { Gem, Medal, Star } from "lucide-react";
import type { BadgeTier } from "@/types/domain";

/** Visual style + icon for each reputation tier.
 *  Light-mode uses darker metal tones so the chip stays legible on pale glass;
 *  `dark:` overrides keep the brighter tints used on the dark surface. */
const TIER: Record<BadgeTier, { label: string; icon: typeof Medal; className: string }> = {
    diamond:  { label: "Diamond",  icon: Gem,   className: "text-cyan-700 border-cyan-500/40 bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/30 dark:bg-cyan-400/10" },
    gold:     { label: "Gold",     icon: Medal, className: "text-amber-600 border-amber-500/40 bg-amber-400/15 dark:text-yellow-300 dark:border-yellow-400/30 dark:bg-yellow-400/10" },
    silver:   { label: "Silver",   icon: Medal, className: "text-slate-600 border-slate-400/40 bg-slate-400/15 dark:text-slate-200 dark:border-slate-300/30 dark:bg-slate-300/10" },
    bronze:   { label: "Bronze",   icon: Medal, className: "text-amber-700 border-amber-600/40 bg-amber-600/10 dark:text-amber-400 dark:border-amber-500/30 dark:bg-amber-500/10" },
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
