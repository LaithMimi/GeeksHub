import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RequestFilesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    pending: boolean;
    /** Human label for what is being requested, e.g. "lecture notes", "past exams", "materials". */
    typeLabel: string;
}

/**
 * Yes/no confirm before broadcasting a materials request to the course cohort.
 */
export function RequestFilesDialog({
    open, onOpenChange, onConfirm, pending, typeLabel,
}: RequestFilesDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request {typeLabel}?</DialogTitle>
                    <DialogDescription>
                        We'll notify students in this course's year to upload {typeLabel}.
                        Anyone who uploads earns bonus XP once it's approved.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onConfirm} disabled={pending}>
                        {pending ? "Sending…" : "Yes, request"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
