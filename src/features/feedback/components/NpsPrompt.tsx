/**
 * NpsPrompt
 *
 * A small, dismissible modal that occasionally asks the classic NPS question.
 * Throttled entirely client-side via localStorage: it shows at most once per
 * cooldown window, and never again once the user has answered it. Dismissing
 * also stamps the timestamp so we don't nag.
 */

import * as React from "react";
import { useLocation } from "react-router-dom";
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
import { useAuth } from "@/features/auth/context/AuthContext";
import { useSubmitFeedback } from "@/features/feedback/hooks/useFeedback";
import { sanitizePagePath } from "@/features/feedback/utils";
import { ScoreSelector } from "./ScoreSelector";

const COOLDOWN_DAYS = 30;
// Give a new session a moment before interrupting.
const INITIAL_DELAY_MS = 45_000;

// Keys are scoped per user id so shared machines don't leak "answered" across
// accounts and signing out/in doesn't suppress (or re-trigger) the wrong user.
const lastShownKey = (userId: string) => `nps_prompt_last_shown:${userId}`;
const answeredKey = (userId: string) => `nps_prompt_answered:${userId}`;

const shouldShow = (userId: string): boolean => {
    try {
        if (localStorage.getItem(answeredKey(userId))) return false;
        const last = localStorage.getItem(lastShownKey(userId));
        if (!last) return true;
        const elapsed = Date.now() - Number(last);
        return Number.isFinite(elapsed) && elapsed > COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    } catch {
        return false; // storage blocked → never nag
    }
};

const stamp = (key: string) => {
    try {
        localStorage.setItem(key, String(Date.now()));
    } catch {
        /* ignore */
    }
};

export function NpsPrompt() {
    const location = useLocation();
    const { user } = useAuth();
    const submit = useSubmitFeedback();
    const [open, setOpen] = React.useState(false);
    const [score, setScore] = React.useState<number | null>(null);
    const [comment, setComment] = React.useState("");
    const userId = user?.id;

    React.useEffect(() => {
        if (!userId) return;
        const t = setTimeout(() => {
            // Checked inside the timeout so an answer in another tab during the
            // delay still suppresses the prompt.
            if (shouldShow(userId)) {
                stamp(lastShownKey(userId));
                setOpen(true);
            }
        }, INITIAL_DELAY_MS);
        return () => clearTimeout(t);
    }, [userId]);

    const close = () => setOpen(false);

    const handleSubmit = () => {
        if (score === null || !userId) return;
        submit.mutate(
            {
                category: "other",
                score,
                comment: comment || null,
                page: sanitizePagePath(location.pathname),
                source: "nps_prompt",
            },
            {
                onSuccess: () => {
                    stamp(answeredKey(userId));
                    close();
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Quick question</DialogTitle>
                    <DialogDescription id="nps-prompt-question">
                        How likely are you to recommend GeeksHub to a friend or classmate?
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <ScoreSelector value={score} onChange={setScore} labelledBy="nps-prompt-question" />
                    {score !== null && (
                        <div className="grid gap-2">
                            <Label htmlFor="nps-comment">
                                What's the main reason? <span className="text-muted-foreground">(optional)</span>
                            </Label>
                            <Textarea
                                id="nps-comment"
                                placeholder="Tell us more..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={2}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={close} disabled={submit.isPending}>
                        Maybe later
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={score === null || submit.isPending}>
                        {submit.isPending ? "Sending..." : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
