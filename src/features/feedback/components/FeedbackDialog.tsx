/**
 * FeedbackDialog
 *
 * User-initiated feedback form: a category (friendly selectable cards, mirroring
 * the RejectDialog radiogroup a11y pattern), an optional 0–10 NPS score, and an
 * optional comment. Captures the current route as `page` for moderator context.
 */

import * as React from "react";
import { useLocation } from "react-router-dom";
import { Bug, Lightbulb, Heart, MoreHorizontal, Check } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FeedbackCategory } from "@/types/domain";
import { useSubmitFeedback } from "@/features/feedback/hooks/useFeedback";
import { sanitizePagePath } from "@/features/feedback/utils";
import { ScoreSelector } from "./ScoreSelector";

const CATEGORIES: { value: FeedbackCategory; label: string; hint: string; icon: React.ElementType }[] = [
    { value: "idea", label: "Idea", hint: "A suggestion or feature request.", icon: Lightbulb },
    { value: "bug", label: "Bug", hint: "Something is broken or not working.", icon: Bug },
    { value: "praise", label: "Praise", hint: "Something you love about GeeksHub.", icon: Heart },
    { value: "other", label: "Other", hint: "Anything else on your mind.", icon: MoreHorizontal },
];

export function FeedbackDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const location = useLocation();
    const submit = useSubmitFeedback();

    const [category, setCategory] = React.useState<FeedbackCategory>("idea");
    const [score, setScore] = React.useState<number | null>(null);
    const [comment, setComment] = React.useState("");
    const radioRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

    const reset = () => {
        setCategory("idea");
        setScore(null);
        setComment("");
    };

    // Roving-tabindex + arrow-key navigation for the category radiogroup.
    const focusCategoryAt = (index: number) => {
        const count = CATEGORIES.length;
        const next = ((index % count) + count) % count;
        setCategory(CATEGORIES[next].value);
        radioRefs.current[next]?.focus();
    };

    const handleRadioKeyDown = (e: React.KeyboardEvent, index: number) => {
        switch (e.key) {
            case "ArrowDown":
            case "ArrowRight":
                e.preventDefault();
                focusCategoryAt(index + 1);
                break;
            case "ArrowUp":
            case "ArrowLeft":
                e.preventDefault();
                focusCategoryAt(index - 1);
                break;
            case "Home":
                e.preventDefault();
                focusCategoryAt(0);
                break;
            case "End":
                e.preventDefault();
                focusCategoryAt(CATEGORIES.length - 1);
                break;
        }
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) reset();
        onOpenChange(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submit.mutate(
            {
                category,
                score,
                comment: comment || null,
                page: sanitizePagePath(location.pathname),
                source: "form",
            },
            {
                onSuccess: () => {
                    reset();
                    onOpenChange(false);
                },
            },
        );
    };

    // A comment is required only for pure "other" feedback with no score.
    const canSubmit = score !== null || comment.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Send feedback</DialogTitle>
                        <DialogDescription>
                            Tell us what's working, what's not, or what you'd love to see.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Category */}
                        <div className="grid gap-2">
                            <Label id="feedback-category-label">Category</Label>
                            <div
                                role="radiogroup"
                                aria-labelledby="feedback-category-label"
                                className="grid gap-2 sm:grid-cols-2"
                            >
                                {CATEGORIES.map((c, index) => {
                                    const Icon = c.icon;
                                    const selected = category === c.value;
                                    return (
                                        <button
                                            key={c.value}
                                            ref={(el) => { radioRefs.current[index] = el; }}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            tabIndex={selected ? 0 : -1}
                                            onClick={() => setCategory(c.value)}
                                            onKeyDown={(e) => handleRadioKeyDown(e, index)}
                                            className={cn(
                                                "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                                                selected
                                                    ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30"
                                                    : "border-border hover:border-border/80 hover:bg-muted/50",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                                                    selected ? "bg-blue-500/15 text-blue-500" : "bg-muted text-muted-foreground",
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                                    {c.label}
                                                    {selected && <Check className="h-3.5 w-3.5 text-blue-500" />}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">{c.hint}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* NPS score (optional) */}
                        <div className="grid gap-2">
                            <Label id="feedback-score-label">
                                How likely are you to recommend GeeksHub?{" "}
                                <span className="text-muted-foreground">(optional)</span>
                            </Label>
                            <ScoreSelector value={score} onChange={setScore} labelledBy="feedback-score-label" />
                        </div>

                        {/* Comment */}
                        <div className="grid gap-2">
                            <Label htmlFor="feedback-comment">
                                Comment <span className="text-muted-foreground">(optional)</span>
                            </Label>
                            <Textarea
                                id="feedback-comment"
                                placeholder="Share the details..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submit.isPending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit || submit.isPending}>
                            {submit.isPending ? "Sending..." : "Send feedback"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
