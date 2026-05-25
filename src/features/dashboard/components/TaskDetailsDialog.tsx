import { format } from "date-fns";
import type { Task } from "@/features/dashboard/hooks/useTasks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatHour } from "@/lib/utils";

interface TaskDetailsDialogProps {
    task: Task;
    onClose: () => void;
}

export default function TaskDetailsDialog({ task, onClose }: TaskDetailsDialogProps) {
    const endHour = task.startHour + task.duration;

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-full max-w-md bg-background/90 backdrop-blur-xl border-border sm:rounded-[24px] p-6 shadow-[0_0_60px_-15px_rgba(76,201,216,0.15)] text-foreground">
                <DialogHeader>
                    <DialogTitle className="text-xl font-display font-semibold tracking-tight text-foreground">
                        Task Details
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Review the information for this scheduled task.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div>
                        <p className="text-[12px] text-muted-foreground uppercase tracking-[0.2em] mb-2">Title</p>
                        <p className="text-[16px] font-semibold text-foreground">{task.title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[12px] text-muted-foreground uppercase tracking-[0.2em]">Date</p>
                            <p className="text-[14px] text-foreground">{format(new Date(task.date), "EEEE, MMM d yyyy")}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[12px] text-muted-foreground uppercase tracking-[0.2em]">Time</p>
                            <p className="text-[14px] text-foreground">{formatHour(task.startHour)} – {formatHour(endHour)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[12px] text-muted-foreground uppercase tracking-[0.2em]">Priority</p>
                            <p className="text-[14px] text-foreground capitalize">{task.priority}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[12px] text-muted-foreground uppercase tracking-[0.2em]">Status</p>
                            <p className={`text-[14px] font-semibold ${task.completed ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {task.completed ? 'Completed' : 'Pending'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[12px] text-muted-foreground uppercase tracking-[0.2em]">Created</p>
                        <p className="text-[14px] text-foreground">{format(new Date(task.createdAt), "PPP 'at' p")}</p>
                    </div>
                </div>

                <DialogFooter className="mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl bg-blue-600 text-white px-4 py-3 text-[14px] font-semibold transition-all hover:bg-blue-500"
                    >
                        Close
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
