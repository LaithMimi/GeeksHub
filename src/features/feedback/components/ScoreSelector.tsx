import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NPS 0–10 selector rendered as a labelled radiogroup. Detractor (0–6) / passive
 * (7–8) / promoter (9–10) bands are tinted so the meaning is visible at a glance.
 * Implements the WAI-ARIA radio pattern: a single tab stop with arrow-key
 * navigation that moves (and selects) the focused option.
 */
export function ScoreSelector({
    value,
    onChange,
    labelledBy,
}: {
    value: number | null;
    onChange: (score: number) => void;
    labelledBy?: string;
}) {
    const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

    const focusScoreAt = (index: number) => {
        const next = ((index % 11) + 11) % 11; // wrap 0–10
        onChange(next);
        refs.current[next]?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        switch (e.key) {
            case "ArrowRight":
            case "ArrowUp":
                e.preventDefault();
                focusScoreAt(index + 1);
                break;
            case "ArrowLeft":
            case "ArrowDown":
                e.preventDefault();
                focusScoreAt(index - 1);
                break;
            case "Home":
                e.preventDefault();
                focusScoreAt(0);
                break;
            case "End":
                e.preventDefault();
                focusScoreAt(10);
                break;
        }
    };

    const bandClass = (n: number, selected: boolean) => {
        if (selected) {
            if (n <= 6) return "border-red-500/60 bg-red-500/15 text-red-500 ring-1 ring-red-500/30";
            if (n <= 8) return "border-amber-500/60 bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30";
            return "border-emerald-500/60 bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30";
        }
        return "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/50";
    };

    return (
        <div>
            <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
                {Array.from({ length: 11 }, (_, n) => {
                    const selected = value === n;
                    // Roving tabindex: the selected radio is the single tab stop;
                    // when nothing is selected yet, the first radio (0) is.
                    const tabbable = selected || (value === null && n === 0);
                    return (
                        <button
                            key={n}
                            ref={(el) => { refs.current[n] = el; }}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${n}`}
                            tabIndex={tabbable ? 0 : -1}
                            onClick={() => onChange(n)}
                            onKeyDown={(e) => handleKeyDown(e, n)}
                            className={cn(
                                "h-9 w-9 shrink-0 rounded-lg border text-sm font-semibold transition-all",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                                bandClass(n, selected),
                            )}
                        >
                            {n}
                        </button>
                    );
                })}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground/70">
                <span>Not likely</span>
                <span>Very likely</span>
            </div>
        </div>
    );
}
