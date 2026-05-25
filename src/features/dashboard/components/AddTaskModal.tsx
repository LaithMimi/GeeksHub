import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Task } from "@/features/dashboard/hooks/useTasks";

const START_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4];

function formatDurationLabel(d: number): string {
    if (d === 0.5) return "30 min";
    if (d === 1) return "1 hour";
    if (Number.isInteger(d)) return `${d} hours`;
    const hours = Math.floor(d);
    const mins = Math.round((d - hours) * 60);
    return hours === 0 ? `${mins} min` : `${hours}h ${mins}m`;
}

export interface AddTaskModalProps {
    onClose: () => void;
    onAdd: (title: string, date: string, priority: Task["priority"], startHour: number, duration: number) => void;
    initialDate?: string;
    initialStartHour?: number;
    initialDuration?: number;
}

export default function AddTaskModal({ onClose, onAdd, initialDate, initialStartHour, initialDuration }: AddTaskModalProps) {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(initialDate ?? format(new Date(), "yyyy-MM-dd"));
    const [priority, setPriority] = useState<Task["priority"]>("normal");
    const [startHour, setStartHour] = useState(initialStartHour ?? 14);
    const [duration, setDuration] = useState(initialDuration ?? 1);

    // If a drag created a duration longer than the standard list (e.g. 5h),
    // surface it as a selectable option so the modal reflects what the user drew.
    const durationOptions = useMemo(() => {
        if (initialDuration && !DURATIONS.includes(initialDuration)) {
            return [...DURATIONS, initialDuration].sort((a, b) => a - b);
        }
        return DURATIONS;
    }, [initialDuration]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim(), date, priority, startHour, duration);
        onClose();
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-full max-w-md bg-background/80 backdrop-blur-xl border-border sm:rounded-[24px] p-8 shadow-[0_0_60px_-15px_rgba(76,201,216,0.15)] text-foreground sm:max-w-md">
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-xl font-display font-semibold tracking-tight text-foreground">New Task</DialogTitle>
                    <DialogDescription className="sr-only">Add a new task to your schedule</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <label htmlFor="task-title" className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Task Title</label>
                        <input
                            id="task-title"
                            autoFocus
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Current objective..."
                            className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 border border-border hover:border-border/50 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                        />
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <label htmlFor="task-date" className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Due Date</label>
                        <input
                            id="task-date"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground border border-border hover:border-border/50 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                        />
                    </div>

                    {/* Time row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="task-start" className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Start Time</label>
                            <select
                                id="task-start"
                                value={startHour}
                                onChange={e => setStartHour(Number(e.target.value))}
                                className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground border border-border hover:border-border/50 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                            >
                                {START_HOURS.map(h => (
                                    <option key={h} value={h} className="bg-background text-foreground">
                                        {h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="task-duration" className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Duration</label>
                            <select
                                id="task-duration"
                                value={duration}
                                onChange={e => setDuration(Number(e.target.value))}
                                className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground border border-border hover:border-border/50 focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                            >
                                {durationOptions.map(d => (
                                    <option key={d} value={d} className="bg-background text-foreground">
                                        {formatDurationLabel(d)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2" role="radiogroup" aria-labelledby="priority-label">
                        <label id="priority-label" className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Priority</label>
                        <div className="flex gap-2">
                            {(["normal", "high", "urgent"] as const).map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    role="radio"
                                    aria-checked={priority === p}
                                    onClick={() => setPriority(p)}
                                    className={`flex-1 h-10 rounded-xl text-[13px] font-medium capitalize transition-all border ${priority === p
                                        ? p === "urgent"
                                            ? "bg-destructive/20 text-destructive border-destructive/30"
                                            : p === "high"
                                                ? "bg-amber-500/20 text-amber-500 border-amber-500/30"
                                                : "bg-primary/20 text-primary border-primary/30"
                                        : "border-border text-muted-foreground hover:bg-foreground/5"
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!title.trim()}
                        className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[14px] font-display font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Add Task
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
