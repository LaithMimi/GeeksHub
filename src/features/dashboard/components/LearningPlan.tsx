import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { format, isToday, addDays } from "date-fns";
import type { Task } from "@/features/dashboard/hooks/useTasks";
import { formatHour } from "@/lib/utils";

// Color palette for task blocks on the schedule
const BLOCK_COLORS = [
    { bg: "bg-rose-500/70", border: "border-rose-400/30", glow: "shadow-[0_0_10px_rgba(244,63,94,0.25)]" },
    { bg: "bg-blue-500/70", border: "border-blue-400/30", glow: "shadow-[0_0_10px_rgba(59,130,246,0.25)]" },
    { bg: "bg-amber-500/70", border: "border-amber-400/30", glow: "shadow-[0_0_10px_rgba(245,158,11,0.25)]" },
    { bg: "bg-violet-500/70", border: "border-violet-400/30", glow: "shadow-[0_0_10px_rgba(139,92,246,0.25)]" },
    { bg: "bg-emerald-500/70", border: "border-emerald-400/30", glow: "shadow-[0_0_10px_rgba(16,185,129,0.25)]" },
    { bg: "bg-pink-500/70", border: "border-pink-400/30", glow: "shadow-[0_0_10px_rgba(236,72,153,0.25)]" },
];

// Assign a consistent color per unique task title
function getBlockColor(title: string, colorMap: Map<string, number>): typeof BLOCK_COLORS[0] {
    if (!colorMap.has(title)) {
        colorMap.set(title, colorMap.size % BLOCK_COLORS.length);
    }
    return BLOCK_COLORS[colorMap.get(title)!];
}

// Fixed schedule range: 7 AM – 10 PM. Showing the same band every day
// means tasks scheduled outside the next 8h window are still visible.
const MIN_HOUR = 7;
const MAX_HOUR = 22;
const DAYS_VISIBLE = 7;

type DragMode = "create" | "move";

interface DragState {
    mode: DragMode;
    dateStr: string;
    startHour: number;
    endHour: number;
    /** For "move" drags: which task is being repositioned. */
    taskId?: string;
    /** For "move" drags: original duration, preserved as the user repositions. */
    duration?: number;
    /** For "move" drags: distance (in hours) between mouse and the block's leading edge at grab time. */
    grabOffsetHours?: number;
}

interface MoveGhostBlockProps {
    task: Task;
    dragState: DragState;
    colorMap: Map<string, number>;
    totalSlots: number;
    MIN_HOUR: number;
}

function MoveGhostBlock({ task, dragState, colorMap, totalSlots, MIN_HOUR }: MoveGhostBlockProps) {
    const color = getBlockColor(task.title, colorMap);
    const ghostStart = dragState.startHour;
    const ghostEnd = ghostStart + task.duration;
    const leftPercent = ((ghostStart - MIN_HOUR) / totalSlots) * 100;
    const widthPercent = (task.duration / totalSlots) * 100;
    return (
        <div
            className={`absolute top-1.5 bottom-1.5 rounded-lg ${color.bg} ${color.border} border flex items-center px-2 gap-1.5 overflow-hidden pointer-events-none z-30 ring-2 ring-foreground/20 shadow-2xl shadow-black/40 scale-[1.02]`}
            style={{ '--ghost-left': `${leftPercent}%`, '--ghost-width': `${widthPercent}%`, left: 'var(--ghost-left)', width: 'var(--ghost-width)' } as React.CSSProperties}
        >
            <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-border/200" />
            <div className="flex flex-col justify-center min-w-0">
                <span className="text-[12px] font-display font-semibold text-foreground truncate leading-tight">
                    {task.title}
                </span>
                <span className="text-[10px] text-foreground/80 truncate">
                    {formatHour(ghostStart)}–{formatHour(ghostEnd)}
                </span>
            </div>
        </div>
    );
}

export interface LearningPlanProps {
    tasks: Task[];
    onOpenAddModal: (date: string, startHour: number, duration: number) => void;
    onToggleTask: (id: string) => void;
    onMoveTask: (id: string, date: string, startHour: number) => void;
}

export default function LearningPlan({ tasks, onOpenAddModal, onToggleTask, onMoveTask }: LearningPlanProps) {
    const [dayOffset, setDayOffset] = useState(0);
    const [now, setNow] = useState(new Date());

    const [dragState, setDragState] = useState<DragState | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const didMoveRef = useRef(false);

    // Auto-update every 60 seconds so the "now" line moves
    useEffect(() => {
        let timer = setInterval(() => setNow(new Date()), 60_000);
        const handleVisibility = () => {
            if (document.hidden) {
                clearInterval(timer);
            } else {
                setNow(new Date());
                timer = setInterval(() => setNow(new Date()), 60_000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    // Days start at today (+ offset). No week/day split.
    const days = Array.from({ length: DAYS_VISIBLE }, (_, i) =>
        addDays(now, dayOffset + i)
    );

    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const incompleteTasks = tasks.filter(t => !t.completed);

    const hours = Array.from({ length: MAX_HOUR - MIN_HOUR }, (_, i) => MIN_HOUR + i);
    const totalSlots = MAX_HOUR - MIN_HOUR;

    const nowFraction = (currentHour + currentMinutes / 60 - MIN_HOUR) / totalSlots;
    const showNowLine = dayOffset === 0 && nowFraction >= 0 && nowFraction <= 1;

    const colorMapRef = useRef(new Map<string, number>());
    colorMapRef.current.clear();
    const colorMap = colorMapRef.current;

    const tasksByDate = new Map<string, Task[]>();
    for (const task of incompleteTasks) {
        const key = task.date;
        if (!tasksByDate.has(key)) tasksByDate.set(key, []);
        tasksByDate.get(key)!.push(task);
    }

    // The task currently being repositioned (if any). Drawn as a translucent
    // ghost at the cursor position in addition to the faded "shadow" at origin.
    const movingTask = dragState?.mode === "move" && dragState.taskId
        ? incompleteTasks.find(t => t.id === dragState.taskId) ?? null
        : null;

    // ── Drag helpers ──────────────────────────────────────────────────────────
    // Convert mouse X within a row container to an hour value, snapped to 30-min
    const xToHour = useCallback((clientX: number, rowEl: HTMLElement): number => {
        const rect = rowEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const rawHour = MIN_HOUR + fraction * totalSlots;
        // Snap to nearest 0.5h
        return Math.round(rawHour * 2) / 2;
    }, [totalSlots]);

    // Begin a "create" drag on an empty area of a row.
    const handleRowMouseDown = useCallback((e: React.MouseEvent, dateStr: string) => {
        if (e.button !== 0) return;
        const row = e.currentTarget as HTMLElement;
        const hour = xToHour(e.clientX, row);
        setDragState({
            mode: "create",
            dateStr,
            startHour: hour,
            endHour: hour + 0.5,
        });
        setIsDragging(true);
        didMoveRef.current = false;
        e.preventDefault();
    }, [xToHour]);

    // Begin a "move" drag on an existing task block.
    const handleTaskMouseDown = useCallback((e: React.MouseEvent, task: Task) => {
        if (e.button !== 0) return;
        // Walk up to the row container so xToHour uses the row's bounding rect.
        const row = (e.currentTarget as HTMLElement).parentElement;
        if (!row) return;
        const cursorHour = xToHour(e.clientX, row);
        setDragState({
            mode: "move",
            dateStr: task.date,
            startHour: task.startHour,
            endHour: task.startHour + task.duration,
            taskId: task.id,
            duration: task.duration,
            grabOffsetHours: cursorHour - task.startHour,
        });
        setIsDragging(true);
        didMoveRef.current = false;
        e.preventDefault();
        e.stopPropagation();
    }, [xToHour]);

    const handleMouseMove = useCallback((e: React.MouseEvent, dateStr: string) => {
        if (!isDragging || !dragState) return;
        const row = e.currentTarget as HTMLElement;
        const hour = xToHour(e.clientX, row);
        didMoveRef.current = true;

        if (dragState.mode === "create") {
            if (dragState.dateStr !== dateStr) return;
            setDragState(prev => prev ? {
                ...prev,
                endHour: Math.max(prev.startHour + 0.5, hour),
            } : prev);
        } else {
            // "move": follow cursor; clamp so the block stays within MIN/MAX hours.
            const duration = dragState.duration ?? 1;
            const offset = dragState.grabOffsetHours ?? 0;
            const proposedStart = Math.max(
                MIN_HOUR,
                Math.min(MAX_HOUR - duration, hour - offset)
            );
            setDragState(prev => prev ? {
                ...prev,
                dateStr,
                startHour: proposedStart,
                endHour: proposedStart + duration,
            } : prev);
        }
    }, [isDragging, dragState, xToHour]);

    const handleMouseUp = useCallback(() => {
        if (!isDragging || !dragState) return;

        if (dragState.mode === "create") {
            const start = Math.min(dragState.startHour, dragState.endHour);
            const end = Math.max(dragState.startHour, dragState.endHour);
            const duration = Math.max(0.5, end - start);
            onOpenAddModal(dragState.dateStr, start, duration);
        } else if (dragState.mode === "move" && dragState.taskId && didMoveRef.current) {
            onMoveTask(dragState.taskId, dragState.dateStr, dragState.startHour);
        }

        setDragState(null);
        setIsDragging(false);
    }, [isDragging, dragState, onOpenAddModal, onMoveTask]);

    // Global mouseup to handle release outside the row
    useEffect(() => {
        if (!isDragging) return;
        const handler = () => handleMouseUp();
        window.addEventListener("mouseup", handler);
        return () => window.removeEventListener("mouseup", handler);
    }, [isDragging, handleMouseUp]);

    return (
        <div className="liquid-glass rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                    <h3 className="text-[18px] font-display font-bold text-foreground">
                        Learning Plan
                    </h3>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">Drag on a row to add a task — drag a block to move it</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setDayOffset(p => p - DAYS_VISIBLE)}
                        className="w-11 h-11 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground/70 hover:bg-foreground/5 transition-all"
                        aria-label="Previous days"
                    >
                        <ChevronLeft className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                    </button>
                    <button
                        onClick={() => setDayOffset(0)}
                        className="text-[12px] text-muted-foreground hover:text-foreground/70 px-4 py-2 sm:px-2 sm:py-1 min-h-[44px] sm:min-h-0 rounded-md hover:bg-foreground/5 transition-all"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setDayOffset(p => p + DAYS_VISIBLE)}
                        className="w-11 h-11 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground/70 hover:bg-foreground/5 transition-all"
                        aria-label="Next days"
                    >
                        <ChevronRight className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                    </button>
                </div>
            </div>

            {/* Schedule Grid */}
            <div className="p-5 overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Time Headers */}
                    <div className="grid gap-0 [grid-template-columns:60px_repeat(15,1fr)]">
                        <div /> {/* Spacer for day label column */}
                        {hours.map(h => (
                            <div key={h} className="text-[11px] text-muted-foreground/50 text-center pb-3 font-medium">
                                {h === 0 ? "12:00 am" : h < 12 ? `${h}:00 am` : h === 12 ? "12:00 pm" : `${h - 12}:00 pm`}
                            </div>
                        ))}
                    </div>

                    {/* Day Rows */}
                    {days.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const dayLabel = format(day, "EEE d");
                        const dayTasks = tasksByDate.get(dateStr) || [];
                        const isTodayRow = isToday(day);

                        // Drag preview for this row
                        const showDragPreview = isDragging && dragState?.dateStr === dateStr;
                        const dragLeft = showDragPreview
                            ? ((Math.min(dragState!.startHour, dragState!.endHour) - MIN_HOUR) / totalSlots) * 100
                            : 0;
                        const dragWidth = showDragPreview
                            ? (Math.abs(dragState!.endHour - dragState!.startHour) / totalSlots) * 100
                            : 0;

                        return (
                            <div
                                key={dateStr}
                                className="grid gap-0 border-t border-border min-h-[52px] [grid-template-columns:60px_repeat(15,1fr)]"
                            >
                                {/* Day Label */}
                                <div className={`flex items-center text-[13px] font-medium pr-3 ${isTodayRow ? "text-blue-400" : "text-muted-foreground"
                                    }`}>
                                    {dayLabel}
                                </div>

                                {/* Time Grid — relative container for task blocks */}
                                <div
                                    className={`relative [grid-column:2/-1] min-h-[52px] select-none ${isDragging ? (dragState?.mode === "move" ? "cursor-grabbing" : "cursor-col-resize") : "cursor-crosshair"
                                        }`}
                                    onMouseDown={(e) => handleRowMouseDown(e, dateStr)}
                                    onMouseMove={(e) => handleMouseMove(e, dateStr)}
                                    onMouseUp={handleMouseUp}
                                >
                                    {/* Grid lines */}
                                    <div className="absolute inset-0 grid pointer-events-none [grid-template-columns:repeat(15,1fr)]">
                                        {hours.map(h => (
                                            <div key={h} className="border-l border-border h-full" />
                                        ))}
                                    </div>

                                    {/* Current-time indicator line */}
                                    {showNowLine && isTodayRow && (
                                        <div
                                            className="absolute top-0 bottom-0 z-20 pointer-events-none"
                                            style={{ '--now-pos': `${nowFraction * 100}%`, left: 'var(--now-pos)' } as React.CSSProperties}
                                        >
                                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                                        </div>
                                    )}

                                    {/* Drag Preview Ghost (for "create" only) */}
                                    {showDragPreview && dragState?.mode === "create" && dragWidth > 0 && (
                                        <div
                                            className="absolute top-1.5 bottom-1.5 rounded-lg bg-blue-500/30 border border-blue-400/40 border-dashed z-10 pointer-events-none animate-pulse"
                                            style={{ '--drag-left': `${dragLeft}%`, '--drag-width': `${Math.max(dragWidth, 1)}%`, left: 'var(--drag-left)', width: 'var(--drag-width)' } as React.CSSProperties}
                                        />
                                    )}

                                    {/* Task Blocks — always rendered at their original position.
                                        While being moved, the origin block stays as a faded
                                        "shadow" so the user sees where the task came from. */}
                                    {dayTasks.map(task => {
                                        const isBeingMoved = movingTask?.id === task.id;

                                        const leftPercent = ((task.startHour - MIN_HOUR) / totalSlots) * 100;
                                        const widthPercent = (task.duration / totalSlots) * 100;
                                        const color = getBlockColor(task.title, colorMap);
                                        const endHour = task.startHour + task.duration;

                                        return (
                                            <div
                                                key={task.id}
                                                className={`absolute top-1.5 bottom-1.5 rounded-lg ${color.bg} ${color.border} ${color.glow} border flex items-center px-2 gap-1.5 overflow-hidden transition-shadow hover:brightness-110 ${task.completed ? 'opacity-50' : ''} ${isBeingMoved ? 'opacity-30 border-dashed pointer-events-none' : 'cursor-grab'}`}
                                                style={{ '--task-left': `${leftPercent}%`, '--task-width': `${widthPercent}%`, left: 'var(--task-left)', width: 'var(--task-width)' } as React.CSSProperties}
                                                title={`${task.title} — ${formatHour(task.startHour)} to ${formatHour(endHour)}`}
                                                onMouseDown={(e) => handleTaskMouseDown(e, task)}
                                            >
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onToggleTask(task.id); }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${task.completed
                                                            ? 'bg-white/90 border-white/90'
                                                            : 'border-border/200 hover:border-white/80 hover:bg-foreground/10'
                                                        }`}
                                                    aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    {task.completed && (
                                                        <Check className="w-2.5 h-2.5 text-black" />
                                                    )}
                                                </button>
                                                <div className="flex flex-col justify-center min-w-0">
                                                    <span className={`text-[12px] font-display font-semibold text-foreground truncate leading-tight ${task.completed ? 'line-through' : ''}`}>
                                                        {task.title}
                                                    </span>
                                                    {task.duration >= 1.5 && (
                                                        <span className="text-[10px] text-foreground/60 truncate">
                                                            {formatHour(task.startHour)}–{formatHour(endHour)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Drag Ghost Preview (for "move"): shows where the task will land.
                                        Rendered only in the destination row at the cursor's snap point. */}
                                    {movingTask && dragState?.mode === "move" && dragState.dateStr === dateStr && (
                                        <MoveGhostBlock task={movingTask} dragState={dragState} colorMap={colorMap} totalSlots={totalSlots} MIN_HOUR={MIN_HOUR} />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
