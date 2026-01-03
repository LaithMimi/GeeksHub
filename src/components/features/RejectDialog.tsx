/**
 * RejectDialog Component
 * 
 * A dialog for rejecting file requests with:
 * - Required reason category
 * - Optional note (visible to student)
 */

import * as React from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { RejectReason } from "@/types/domain";

const REJECT_REASONS: { value: RejectReason; label: string }[] = [
    { value: "DUPLICATE", label: "Duplicate content" },
    { value: "OUTDATED", label: "Outdated material" },
    { value: "INCORRECT_COURSE", label: "Incorrect course/category" },
    { value: "BAD_QUALITY", label: "Poor quality" },
    { value: "OTHER", label: "Other reason" },
];

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
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            {isBulk
                                ? `Reject ${selectedCount} selected request(s). The reason will be visible to students.`
                                : "Provide a reason for rejection. This will be visible to the student."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="reason">Reason *</Label>
                            <Select
                                value={reason}
                                onValueChange={(value) => setReason(value as RejectReason)}
                            >
                                <SelectTrigger id="reason">
                                    <SelectValue placeholder="Select a reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    {REJECT_REASONS.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
