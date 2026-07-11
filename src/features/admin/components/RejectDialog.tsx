/**
 * RejectDialog Component
 *
 * A dialog for rejecting file requests with:
 * - Required reason category (friendly selectable cards)
 * - Optional note (visible to student)
 */

import * as React from "react";
import { Copy, CalendarX, FolderX, ImageOff, MoreHorizontal, Check } from "lucide-react";
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
import type { RejectReason } from "@/types/domain";
import { REJECT_REASON_LABELS } from "@/lib/constants";

/** Per-reason presentation: icon + a short, plain-language hint for the moderator. */
const REASON_META: Record<RejectReason, { icon: React.ElementType; hint: string }> = {
    DUPLICATE: { icon: Copy, hint: "This material is already in the library." },
    OUTDATED: { icon: CalendarX, hint: "The content is no longer current." },
    INCORRECT_COURSE: { icon: FolderX, hint: "Filed under the wrong course or type." },
    BAD_QUALITY: { icon: ImageOff, hint: "Unclear, incomplete, or low-quality file." },
    OTHER: { icon: MoreHorizontal, hint: "Something else — please add a note below." },
};

const REJECT_REASONS = (Object.entries(REJECT_REASON_LABELS) as [RejectReason, string][])
    .map(([value, label]) => ({ value, label, ...REASON_META[value] }));

interface RejectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason: RejectReason, note?: string) => void;
    title?: string;
    isBulk?: boolean;
    selectedCount?: number;
    isPending?: boolean;
}

export function RejectDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Reject Request",
    isBulk = false,
    selectedCount = 1,
    isPending = false,
}: RejectDialogProps) {
    const [reason, setReason] = React.useState<RejectReason | "">("");
    const [note, setNote] = React.useState("");
    const radioRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

    // Roving-tabindex + arrow-key navigation for the radiogroup. The focused
    // radio becomes the selected one, matching the WAI-ARIA radio pattern.
    const focusRadioAt = (index: number) => {
        const count = REJECT_REASONS.length;
        const next = ((index % count) + count) % count;
        setReason(REJECT_REASONS[next].value);
        radioRefs.current[next]?.focus();
    };

    const handleRadioKeyDown = (e: React.KeyboardEvent, index: number) => {
        switch (e.key) {
            case "ArrowDown":
            case "ArrowRight":
                e.preventDefault();
                focusRadioAt(index + 1);
                break;
            case "ArrowUp":
            case "ArrowLeft":
                e.preventDefault();
                focusRadioAt(index - 1);
                break;
            case "Home":
                e.preventDefault();
                focusRadioAt(0);
                break;
            case "End":
                e.preventDefault();
                focusRadioAt(REJECT_REASONS.length - 1);
                break;
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (reason) {
            onConfirm(reason, note || undefined);
            // Reset form
            setReason("");
            setNote("");
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Reset form on close
            setReason("");
            setNote("");
        }
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            {isBulk
                                ? `Reject ${selectedCount} selected request(s). The reason will be visible to students.`
                                : "Pick a reason for rejection. This will be visible to the student."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label id="reject-reason-label">Reason <span className="text-destructive">*</span></Label>
                            <div
                                role="radiogroup"
                                aria-labelledby="reject-reason-label"
                                className="grid gap-2"
                            >
                                {REJECT_REASONS.map((r, index) => {
                                    const Icon = r.icon;
                                    const selected = reason === r.value;
                                    // Roving tabindex: the selected radio is the single tab
                                    // stop; when nothing is selected yet, the first radio is.
                                    const tabbable = selected || (reason === "" && index === 0);
                                    return (
                                        <button
                                            key={r.value}
                                            ref={(el) => { radioRefs.current[index] = el; }}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            tabIndex={tabbable ? 0 : -1}
                                            onClick={() => setReason(r.value)}
                                            onKeyDown={(e) => handleRadioKeyDown(e, index)}
                                            className={cn(
                                                "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
                                                selected
                                                    ? "border-destructive/50 bg-destructive/10 ring-1 ring-destructive/30"
                                                    : "border-border hover:border-border/80 hover:bg-muted/50",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                                                    selected
                                                        ? "bg-destructive/15 text-destructive"
                                                        : "bg-muted text-muted-foreground",
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-foreground">{r.label}</span>
                                                <span className="block text-xs text-muted-foreground">{r.hint}</span>
                                            </span>
                                            {selected && <Check className="h-4 w-4 shrink-0 text-destructive" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="note">
                                Additional Note <span className="text-muted-foreground">(optional)</span>
                            </Label>
                            <Textarea
                                id="note"
                                placeholder="Add more details if needed..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                                This note will be visible to the student.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={!reason || isPending}
                        >
                            {isPending ? "Rejecting..." : isBulk ? `Reject ${selectedCount}` : "Reject"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
