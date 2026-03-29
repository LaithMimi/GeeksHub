import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    Clock,
    FileText,
    Zap,
    AlertCircle,
    ArrowRight,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Plus,
    PlayCircle,
    Calendar,
    Check,
    Trash2,
    TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRecentFiles } from "@/queries/useFiles";
import { useMyRequests } from "@/queries/useRequests";
import { usePinnedCourses } from "@/hooks/usePinnedCourses";
import { useTasks, type Task } from "@/hooks/useTasks";
import { useAuth } from "@/context/AuthContext";
import { useCourses, useMajors } from "@/queries/useCatalog";
import { useActivitySummary } from "@/queries/useLearningPath";
import {
    formatDistanceToNow, format, isToday, isTomorrow, isPast,
    startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    addMonths, subMonths, isSameMonth,
    startOfWeek, addDays, addWeeks, endOfWeek, isWithinInterval,
} from "date-fns";


// Time-based greeting generator
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

// Color palette for task blocks on the schedule
const BLOCK_COLORS = [
    { bg: "bg-rose-500/70", border: "border-rose-400/30", glow: "shadow-[0_0_10px_rgba(244,63,94,0.25)]" },
    { bg: "bg-blue-500/70", border: "border-blue-400/30", glow: "shadow-[0_0_10px_rgba(59,130,246,0.25)]" },
    { bg: "bg-amber-500/70", border: "border-amber-400/30", glow: "shadow-[0_0_10px_rgba(245,158,11,0.25)]" },
    { bg: "bg-purple-500/70", border: "border-purple-400/30", glow: "shadow-[0_0_10px_rgba(139,92,246,0.25)]" },
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

// ────────────────────────────────────────────
// Learning Plan Component
// ────────────────────────────────────────────
function LearningPlan({ tasks, onOpenAddModal, onToggleTask }: {
    tasks: Task[];
    onOpenAddModal: (date: string, startHour: number, duration: number) => void;
    onToggleTask: (id: string) => void;
}) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [view, setView] = useState<"week" | "day">("week");
    const [now, setNow] = useState(new Date());

    // ── Drag-to-create state ──
    const [dragState, setDragState] = useState<{
        dateStr: string;
        startHour: number;
        endHour: number;
    } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

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

    const currentWeekStart = startOfWeek(
        weekOffset === 0 ? now : addWeeks(startOfWeek(now, { weekStartsOn: 0 }), weekOffset),
        { weekStartsOn: 0 }
    );

    const weekDays = view === "week"
        ? [1, 2, 3, 4, 5].map(d => addDays(currentWeekStart, d))
        : [now];

    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const incompleteTasks = tasks.filter(t => !t.completed);

    const minHour = currentHour;
    const maxHour = currentHour + 8;

    const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
    const totalSlots = maxHour - minHour;

    const nowFraction = (currentHour + currentMinutes / 60 - minHour) / totalSlots;
    const showNowLine = weekOffset === 0 && nowFraction >= 0 && nowFraction <= 1;

    const colorMap = new Map<string, number>();

    const tasksByDate = new Map<string, Task[]>();
    for (const task of incompleteTasks) {
        const key = task.date;
        if (!tasksByDate.has(key)) tasksByDate.set(key, []);
        tasksByDate.get(key)!.push(task);
    }

    // ── Drag helpers ──
    // Convert mouse X within a row container to an hour value, snapped to 30-min
    const xToHour = useCallback((clientX: number, rowEl: HTMLElement): number => {
        const rect = rowEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const rawHour = minHour + fraction * totalSlots;
        // Snap to nearest 0.5h
        return Math.round(rawHour * 2) / 2;
    }, [minHour, totalSlots]);

    const handleMouseDown = useCallback((e: React.MouseEvent, dateStr: string) => {
        if (e.button !== 0) return; // left click only
        const row = e.currentTarget as HTMLElement;
        const hour = xToHour(e.clientX, row);
        setDragState({ dateStr, startHour: hour, endHour: hour + 0.5 });
        setIsDragging(true);
        e.preventDefault();
    }, [xToHour]);

    const handleMouseMove = useCallback((e: React.MouseEvent, dateStr: string) => {
        if (!isDragging || !dragState || dragState.dateStr !== dateStr) return;
        const row = e.currentTarget as HTMLElement;
        const hour = xToHour(e.clientX, row);
        setDragState(prev => prev ? {
            ...prev,
            endHour: Math.max(prev.startHour + 0.5, hour),
        } : prev);
    }, [isDragging, dragState, xToHour]);

    const handleMouseUp = useCallback(() => {
        if (!isDragging || !dragState) return;
        const start = Math.min(dragState.startHour, dragState.endHour);
        const end = Math.max(dragState.startHour, dragState.endHour);
        const duration = Math.max(0.5, end - start);
        onOpenAddModal(dragState.dateStr, start, duration);
        setDragState(null);
        setIsDragging(false);
    }, [isDragging, dragState, onOpenAddModal]);

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
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <div>
                    <h3 className="text-[18px] font-display font-bold text-white">
                        Learning Plan
                    </h3>
                    <p className="text-[11px] text-white/25 mt-0.5">Drag on a row to add a task</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Week Navigation */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setWeekOffset(p => p - 1)}
                            className="w-11 h-11 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                            aria-label="Previous week"
                        >
                            <ChevronLeft className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                        </button>
                        <button
                            onClick={() => setWeekOffset(0)}
                            className="text-[12px] text-white/40 hover:text-white/70 px-4 py-2 sm:px-2 sm:py-1 min-h-[44px] sm:min-h-0 rounded-md hover:bg-white/[0.06] transition-all"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setWeekOffset(p => p + 1)}
                            className="w-11 h-11 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                            aria-label="Next week"
                        >
                            <ChevronRight className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                        </button>
                    </div>
                    {/* View Toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                        <button
                            onClick={() => setView("day")}
                            className={`text-[12px] px-3 py-1.5 font-medium transition-all ${view === "day" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60"
                                }`}
                        >
                            Day
                        </button>
                        <button
                            onClick={() => setView("week")}
                            className={`text-[12px] px-3 py-1.5 font-medium transition-all border-l border-white/[0.08] ${view === "week" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60"
                                }`}
                        >
                            Week
                        </button>
                    </div>
                </div>
            </div>

            {/* Schedule Grid */}
            <div className="p-5 overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Time Headers */}
                    <div className="grid gap-0" style={{ gridTemplateColumns: `60px repeat(${hours.length}, 1fr)` }}>
                        <div /> {/* Spacer for day label column */}
                        {hours.map(h => (
                            <div key={h} className="text-[11px] text-white/30 text-center pb-3 font-medium">
                                {h === 0 ? "12:00 am" : h < 12 ? `${h}:00 am` : h === 12 ? "12:00 pm" : `${h - 12}:00 pm`}
                            </div>
                        ))}
                    </div>

                    {/* Day Rows */}
                    {weekDays.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const dayLabel = format(day, "EEE");
                        const dayTasks = tasksByDate.get(dateStr) || [];
                        const isTodayRow = isToday(day);

                        // Drag preview for this row
                        const showDragPreview = isDragging && dragState?.dateStr === dateStr;
                        const dragLeft = showDragPreview
                            ? ((Math.min(dragState!.startHour, dragState!.endHour) - minHour) / totalSlots) * 100
                            : 0;
                        const dragWidth = showDragPreview
                            ? (Math.abs(dragState!.endHour - dragState!.startHour) / totalSlots) * 100
                            : 0;



                        return (
                            <div
                                key={dateStr}
                                className="grid gap-0 border-t border-white/[0.04] min-h-[52px]"
                                style={{ gridTemplateColumns: `60px repeat(${hours.length}, 1fr)` }}
                            >
                                {/* Day Label */}
                                <div className={`flex items-center text-[13px] font-medium pr-3 ${isTodayRow ? "text-purple-400" : "text-white/40"
                                    }`}>
                                    {dayLabel}
                                </div>

                                {/* Time Grid — relative container for task blocks */}
                                <div
                                    className={`relative col-span-full ${isDragging ? "cursor-col-resize" : "cursor-crosshair"
                                        }`}
                                    style={{
                                        gridColumn: `2 / -1`,
                                        minHeight: "52px",
                                        userSelect: "none",
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, dateStr)}
                                    onMouseMove={(e) => handleMouseMove(e, dateStr)}
                                    onMouseUp={handleMouseUp}
                                >
                                    {/* Grid lines */}
                                    <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
                                        {hours.map(h => (
                                            <div key={h} className="border-l border-white/[0.04] h-full" />
                                        ))}
                                    </div>

                                    {/* Current-time indicator line */}
                                    {showNowLine && isTodayRow && (
                                        <div
                                            className="absolute top-0 bottom-0 z-20 pointer-events-none"
                                            style={{ left: `${nowFraction * 100}%` }}
                                        >
                                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                                        </div>
                                    )}

                                    {/* Drag Preview Ghost */}
                                    {showDragPreview && dragWidth > 0 && (
                                        <div
                                            className="absolute top-1.5 bottom-1.5 rounded-lg bg-purple-500/30 border border-purple-400/40 border-dashed z-10 pointer-events-none animate-pulse"
                                            style={{
                                                left: `${dragLeft}%`,
                                                width: `${Math.max(dragWidth, 1)}%`,
                                            }}
                                        />
                                    )}


                                    {/* Task Blocks */}
                                    {dayTasks.map(task => {
                                        const leftPercent = ((task.startHour - minHour) / totalSlots) * 100;
                                        const widthPercent = (task.duration / totalSlots) * 100;
                                        const color = getBlockColor(task.title, colorMap);

                                        return (
                                            <div
                                                key={task.id}
                                                className={`absolute top-1.5 bottom-1.5 rounded-lg ${color.bg} ${color.border} ${color.glow} border flex items-center px-2 gap-1.5 overflow-hidden cursor-default transition-all hover:brightness-110 ${task.completed ? 'opacity-50' : ''}`}
                                                style={{
                                                    left: `${leftPercent}%`,
                                                    width: `${widthPercent}%`,
                                                }}
                                                title={`${task.title} — ${task.startHour}:00 to ${task.startHour + task.duration}:00`}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={() => onToggleTask(task.id)}
                                                    className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                                        task.completed
                                                            ? 'bg-white/90 border-white/90'
                                                            : 'border-white/50 hover:border-white/80 hover:bg-white/10'
                                                    }`}
                                                    aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    {task.completed && (
                                                        <Check className="w-2.5 h-2.5 text-black" />
                                                    )}
                                                </button>
                                                <div className="flex flex-col justify-center min-w-0">
                                                    <span className={`text-[12px] font-display font-semibold text-white truncate leading-tight ${task.completed ? 'line-through' : ''}`}>
                                                        {task.title}
                                                    </span>
                                                    {task.duration >= 1.5 && (
                                                        <span className="text-[10px] text-white/60 truncate">
                                                            {task.startHour > 12 ? `${task.startHour - 12}` : task.startHour}–{(task.startHour + task.duration) > 12 ? `${(task.startHour + task.duration) - 12}` : (task.startHour + task.duration)} PM
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────
// Mini Calendar Component
// ────────────────────────────────────────────
function MiniCalendar({ taskDates, selectedDate, onSelectDate }: {
    taskDates: Set<string>;
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const startDay = getDay(monthStart);
    const paddedDays = Array(startDay).fill(null).concat(days);

    return (
        <div className="liquid-glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-display font-bold text-white">
                    {format(currentMonth, "MMMM yyyy")}
                </h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                        className="w-11 h-11 lg:w-7 lg:h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                        aria-label="Previous month"
                    >
                        <ChevronLeft className="h-5 w-5 lg:h-3.5 lg:w-3.5" />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                        className="w-11 h-11 lg:w-7 lg:h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                        aria-label="Next month"
                    >
                        <ChevronRight className="h-5 w-5 lg:h-3.5 lg:w-3.5" />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <div key={d} className="text-[10px] font-display font-semibold text-white/25 py-1">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {paddedDays.map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} />;
                    const dateStr = format(day, "yyyy-MM-dd");
                    const hasTask = taskDates.has(dateStr);
                    const isSelected = selectedDate === dateStr;
                    const isTodayDate = isToday(day);
                    const isThisMonth = isSameMonth(day, currentMonth);
                    return (
                        <button
                            key={dateStr}
                            onClick={() => onSelectDate(dateStr)}
                            className={`relative w-full aspect-square rounded-lg flex items-center justify-center text-[12px] transition-all ${isSelected
                                ? "bg-purple-500 text-white font-semibold shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                                : isTodayDate
                                    ? "bg-white/[0.08] text-white font-semibold"
                                    : isThisMonth
                                        ? "text-white/60 hover:bg-white/[0.06]"
                                        : "text-white/20"
                                }`}
                        >
                            {format(day, "d")}
                            {hasTask && !isSelected && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────
// Add Task Modal Constants
// ────────────────────────────────────────────
const START_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4];

// ────────────────────────────────────────────
// Add Task Modal
// ────────────────────────────────────────────
function AddTaskModal({ onClose, onAdd, initialDate, initialStartHour, initialDuration }: {
    onClose: () => void;
    onAdd: (title: string, date: string, priority: Task["priority"], startHour: number, duration: number) => void;
    initialDate?: string;
    initialStartHour?: number;
    initialDuration?: number;
}) {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(initialDate ?? format(new Date(), "yyyy-MM-dd"));
    const [priority, setPriority] = useState<Task["priority"]>("normal");
    const [startHour, setStartHour] = useState(initialStartHour ?? 14);
    const [duration, setDuration] = useState(initialDuration ?? 1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim(), date, priority, startHour, duration);
        onClose();
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-full max-w-md bg-background/80 backdrop-blur-xl border-white/[0.08] sm:rounded-[24px] p-8 shadow-[0_0_60px_-15px_rgba(76,201,216,0.15)] text-foreground sm:max-w-md">
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
                            className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 border border-white/[0.06] hover:border-white/[0.1] focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
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
                            className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground border border-white/[0.06] hover:border-white/[0.1] focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all [color-scheme:dark]"
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
                                className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground border border-white/[0.06] hover:border-white/[0.1] focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all [color-scheme:dark]"
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
                                className="w-full h-12 rounded-xl bg-card/60 px-4 text-sm text-foreground border border-white/[0.06] hover:border-white/[0.1] focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all [color-scheme:dark]"
                            >
                                {DURATIONS.map(d => (
                                    <option key={d} value={d} className="bg-background text-foreground">
                                        {d === 0.5 ? "30 min" : d === 1 ? "1 hour" : `${d} hours`}
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
                                        : "border-white/[0.08] text-white/40 hover:bg-white/[0.04]"
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

// ────────────────────────────────────────────
// Format deadline label
// ────────────────────────────────────────────
function formatDeadline(dateStr: string): { label: string; urgent: boolean } {
    const date = new Date(dateStr + "T00:00:00");
    if (isToday(date)) return { label: "Due Today", urgent: true };
    if (isTomorrow(date)) return { label: "Due Tomorrow", urgent: true };
    if (isPast(date)) return { label: `Overdue — ${format(date, "MMM d")}`, urgent: true };
    return { label: format(date, "MMM d, EEEE"), urgent: false };
}

// ────────────────────────────────────────────
// Recent Courses (derived from recent files)
// ────────────────────────────────────────────

const progressColors: Record<string, string> = {
    purple: "bg-purple-500",
    green: "bg-emerald-500",
    red: "bg-red-500",
};

const progressGlows: Record<string, string> = {
    purple: "shadow-[0_0_12px_rgba(139,92,246,0.4)]",
    green: "shadow-[0_0_12px_rgba(16,185,129,0.4)]",
    red: "shadow-[0_0_12px_rgba(239,68,68,0.4)]",
};

// ────────────────────────────────────────────
// Main Dashboard
// ────────────────────────────────────────────
export default function Dashboard() {
    const { user } = useAuth();
    const { data: recentFiles, isLoading: isLoadingRecent, isError: isErrorRecent } = useRecentFiles();
    const { data: _requests } = useMyRequests();
    const { data: allCourses } = useCourses({}); // Retrieve full course catalog for metadata mapping
    const { data: allMajors } = useMajors();
    const { data: activitySummary, isLoading: isLoadingSummary } = useActivitySummary();
    usePinnedCourses();

    const { tasks, taskDates, addTask, toggleTask, deleteTask } = useTasks();
    const [showAddTask, setShowAddTask] = useState(false);
    const [addTaskDefaults, setAddTaskDefaults] = useState<{ date?: string; startHour?: number; duration?: number }>({});
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);

    if (isErrorRecent) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="glass-card p-12 text-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-display font-bold text-white mb-2">Couldn't load dashboard</h2>
                    <p className="text-white/50 mb-6">Something went wrong. Let's try again.</p>
                    <Button onClick={() => window.location.reload()} className="gradient-bg border-0 glow-purple-soft">
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    const lastFile = recentFiles && recentFiles.length > 0 ? recentFiles[0] : null;
    const lastFileCourse = allCourses?.find(c => c.id === lastFile?.courseId);

    // Derive 3 most-recent unique courses from recent files
    const recentCourses: { id: string; name: string; meta: string; color: string; lastAccess: string; progress: number }[] = [];
    const seenCourseIds = new Set<string>();
    if (recentFiles) {
        for (const file of recentFiles) {
            if (seenCourseIds.has(file.courseId)) continue;
            seenCourseIds.add(file.courseId);

            const course = allCourses?.find(c => c.id === file.courseId);

            // Derive progress from how many approved requests exist for this course vs total requests
            const approvedForCourse = (_requests ?? []).filter(
                r => r.courseId === file.courseId && r.status === "approved"
            ).length;
            const totalForCourse = (_requests ?? []).filter(
                r => r.courseId === file.courseId
            ).length;
            const progress = totalForCourse > 0
                ? Math.round((approvedForCourse / totalForCourse) * 100)
                : 0;

            const majorName = allMajors?.find(m => m.id === course?.majorId)?.name ?? course?.majorId;
            recentCourses.push({
                id: file.courseId,
                name: course?.name ?? file.courseId,
                meta: course ? `${course.term || `Semester ${course.semester}`} • ${majorName}` : "Course",
                color: ["purple", "green", "red"][recentCourses.length % 3],
                lastAccess: file.viewedAt,
                progress
            });

            if (recentCourses.length >= 3) break;
        }
    }

    // Dynamic metrics - using live data where available

    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const taskCompletionValue = totalTasks > 0
        ? `${Math.round((completedTasks / totalTasks) * 100)}%`
        : "0%";

    const metrics = [
        {
            label: "Study Hours",
            value: "0h", // Backend endpoint needed: GET /api/me/study-hours
            change: "",
            positive: true,
            neutral: false,
            hero: true,
            icon: Clock,
            iconColor: "text-pink-400"
        },
        {
            label: "Courses Active",
            value: isLoadingSummary ? <Skeleton className="h-9 w-16 bg-white/[0.06]" /> : (activitySummary ? activitySummary.courseActivity.filter(c => c.status === "engaged").length.toString() : "0"),
            change: "",
            positive: true,
            neutral: false,
            hero: false,
            icon: BookOpen,
            iconColor: "text-blue-400"
        },
        {
            label: "Tasks Done",
            value: taskCompletionValue, // Needs backend COURSE PROGRESS endpoint
            change: totalTasks > 0 ? `${completedTasks}/${totalTasks}` : "0/0",
            positive: totalTasks > 0 && completedTasks === totalTasks,
            neutral: totalTasks === 0 || completedTasks < totalTasks,
            hero: false,
            icon: TrendingUp,
            iconColor: "text-purple-400"
        },
        {
            label: "XP Earned",
            value: isLoadingSummary ? <Skeleton className="h-9 w-16 bg-white/[0.06]" /> : (activitySummary ? `${activitySummary.totalPoints}` : "0"),
            change: "",
            positive: true,
            neutral: false,
            hero: false,
            icon: Zap,
            iconColor: "text-amber-400"
        },
    ];

    // Dynamic weekly activity - filtering to current week
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 });

    const weeklyActivity = DAY_LABELS.map((day, index) => {
        const count = (recentFiles ?? []).filter(f => {
            const d = new Date(f.viewedAt);
            return (
                d.getDay() === index &&
                isWithinInterval(d, { start: weekStart, end: weekEnd })
            );
        }).length;
        return { day, value: Math.min(count * 20, 100) }; // scale to percentage
    });

    const displayTasks = (selectedDate
        ? tasks.filter(t => t.date === selectedDate)
        : tasks
    ).filter(t => showCompleted || !t.completed);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── Continue Studying Hero ── */}
            {isLoadingRecent ? (
                <Skeleton className="h-[104px] w-full rounded-2xl bg-white/[0.02] border border-purple-500/10" />
            ) : lastFile && (
                <Link to={`/courses/${lastFile.courseId}/files/${lastFile.id}`} className="block group">
                    <div className="liquid-glass rounded-2xl p-6 flex items-center gap-5 border-purple-500/15 hover:border-purple-500/30 transition-all glow-purple-soft">
                        <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-lg">
                            <PlayCircle className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-display font-semibold text-purple-400 uppercase tracking-[0.15em] mb-1">
                                Continue Studying
                            </p>
                            <h2 className="text-[20px] font-display font-bold text-white leading-tight truncate group-hover:text-purple-200 transition-colors">
                                {lastFile.title}
                            </h2>
                            <p className="text-[12px] text-white/35 mt-1 flex items-center gap-2">
                                <span className="truncate max-w-[150px]">{lastFileCourse?.name ?? lastFile.courseId}</span>
                                <span>•</span>
                                <Clock className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(lastFile.viewedAt), { addSuffix: true })}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[13px] font-display font-semibold text-purple-400 group-hover:text-purple-300 transition-colors shrink-0">
                            Resume
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </Link>
            )}

            {/* ── Page Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[36px] font-display font-bold text-white tracking-[-0.04em] leading-none">
                        Dashboard
                    </h1>
                    <p className="text-[14px] text-white/45 mt-2">
                        {getGreeting()}, {user?.displayName || 'Student'}. Here's your learning overview.
                    </p>
                </div>
            </div>

            {/* ── Metric Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {metrics.map((metric, i) => (
                    <div
                        key={metric.label}
                        className={`rounded-2xl p-6 transition-all animate-fade-in-up opacity-0 ${metric.hero ? "liquid-glass border-purple-500/20 glow-purple-soft" : "liquid-glass"
                            } stagger-${i + 1}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <metric.icon className={`h-4 w-4 ${metric.iconColor}`} />
                                <span className="text-[12px] text-white/45 font-medium">{metric.label}</span>
                            </div>
                            <span className={`text-[12px] font-display font-semibold ${
                                metric.neutral ? "text-white/40" : metric.positive ? "text-emerald-400" : "text-red-400"
                                }`}>
                                {metric.change}
                            </span>
                        </div>
                        <div className="text-[36px] font-display font-bold tracking-[-0.04em] leading-none text-white">
                            {metric.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Main Content — Two Columns ── */}
            <div className="flex flex-col lg:flex-row gap-6 min-h-0">
                {/* Left Column */}
                <div className="flex-1 space-y-6 min-w-0">
                    {/* ── Learning Plan Schedule ── */}
                    <LearningPlan tasks={tasks} onToggleTask={toggleTask} onOpenAddModal={(date, startHour, duration) => {
                        setAddTaskDefaults({ date, startHour, duration });
                        setShowAddTask(true);
                    }} />

                    {/* ── Recent Courses ── */}
                    <div className="space-y-4">
                        <div className="flex items-end justify-between">
                            <h2 className="text-[22px] font-display font-bold text-white tracking-[-0.02em]">
                                Recent Courses
                            </h2>
                            <Link to="/courses" className="flex items-center gap-1.5 text-[13px] font-display font-medium text-white/50 hover:text-white/80 transition-colors">
                                View all
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {isLoadingRecent ? (
                                Array(3).fill(0).map((_, i) => (
                                    <Skeleton key={i} className="h-[190px] rounded-2xl bg-white/[0.02] border border-white/[0.05]" />
                                ))
                            ) : recentCourses.length === 0 ? (
                                <div className="col-span-1 md:col-span-3 liquid-glass rounded-2xl p-10 text-center">
                                    <BookOpen className="h-10 w-10 text-white/15 mx-auto mb-3" />
                                    <p className="text-[15px] font-display font-semibold text-white/50">
                                        No courses yet
                                    </p>
                                    <p className="text-[13px] text-white/30 mt-1 mb-4">
                                        Browse courses to get started
                                    </p>
                                    <Link to="/courses">
                                        <Button className="gradient-bg border-0 glow-purple-soft">Browse Courses</Button>
                                    </Link>
                                </div>
                            ) : (
                                recentCourses.map((course, i) => (
                                    <Link
                                        key={course.id}
                                        to={`/courses/${course.id}/materials`}
                                        className={`glass-card overflow-hidden group cursor-pointer animate-fade-in-up opacity-0 stagger-${i + 1}`}
                                    >
                                        <div className="h-[120px] bg-white/[0.03] flex items-center justify-center border-b border-white/[0.06]">
                                            <BookOpen className="h-8 w-8 text-blue-400/50 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                        <div className="p-5 space-y-3">
                                            <h3 className="text-[15px] font-display font-semibold text-white leading-tight group-hover:text-purple-300 transition-colors">
                                                {course.name}
                                            </h3>
                                            <p className="text-[12px] text-white/40">{course.meta}</p>
                                            {course.lastAccess && (
                                                <p className="text-[11px] text-white/25 flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3" />
                                                    Opened {formatDistanceToNow(new Date(course.lastAccess), { addSuffix: true })}
                                                </p>
                                            )}
                                            <div className="space-y-2">
                                                <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${progressColors[course.color]} ${progressGlows[course.color]} transition-all`}
                                                        style={{ width: `${course.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Recent Files ── */}
                    {(isLoadingRecent || (recentFiles && recentFiles.length > 0)) && (
                        <div className="space-y-4">
                            <div className="flex items-end justify-between">
                                <h2 className="text-[22px] font-display font-bold text-white tracking-[-0.02em]">
                                    Recent Files
                                </h2>
                                <Link to="/recent" className="flex items-center gap-1.5 text-[13px] font-display font-medium text-white/50 hover:text-white/80 transition-colors">
                                    View all
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {isLoadingRecent ? (
                                    Array(4).fill(0).map((_, i) => (
                                        <Skeleton key={i} className="h-[74px] rounded-2xl bg-white/[0.02] border border-white/[0.05]" />
                                    ))
                                ) : (
                                    recentFiles!.slice(0, 4).map((file) => {
                                        return (
                                            <Link key={file.id} to={`/courses/${file.courseId}/files/${file.id}`}>
                                                <div className="glass-card p-4 flex items-center gap-4 group">
                                                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                                                        <FileText className="h-4.5 w-4.5 text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[14px] font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                                                            {file.title}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right Column: Calendar + Tasks + Activity + Reputation ── */}
                <div className="w-full lg:w-[340px] shrink-0 space-y-5">
                    {/* Mini Calendar */}
                    <MiniCalendar
                        taskDates={taskDates}
                        selectedDate={selectedDate}
                        onSelectDate={(d) => setSelectedDate(prev => prev === d ? null : d)}
                    />

                    {/* Upcoming Tasks */}
                    <div className="liquid-glass rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                            <h3 className="text-[16px] font-display font-bold text-white">
                                {selectedDate
                                    ? `Tasks — ${format(new Date(selectedDate + "T00:00:00"), "MMM d")}`
                                    : "Upcoming Tasks"
                                }
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowCompleted(!showCompleted)}
                                    className={`text-[11px] px-2 py-1.5 rounded-md transition-all ${showCompleted ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
                                        }`}
                                >
                                    {showCompleted ? "Hide Done" : "Show Done"}
                                </button>
                                {selectedDate && (
                                    <button
                                        onClick={() => setSelectedDate(null)}
                                        className="text-[11px] text-white/40 hover:text-white/70 px-2 py-1 rounded-md hover:bg-white/[0.06] transition-all"
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowAddTask(true)}
                                    className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-purple-400 hover:bg-purple-500/15 transition-all"
                                    title="Add task"
                                >
                                    <Plus className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {displayTasks.length === 0 ? (
                            <div className="px-6 py-8 text-center">
                                <Calendar className="h-8 w-8 text-white/15 mx-auto mb-2" />
                                <p className="text-[13px] text-white/30">
                                    {selectedDate ? "No tasks on this date" : "No tasks yet"}
                                </p>
                                <button
                                    onClick={() => setShowAddTask(true)}
                                    className="text-[12px] text-purple-400 hover:text-purple-300 mt-2 transition-colors"
                                >
                                    Add a task
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/[0.06]">
                                {displayTasks.slice(0, 6).map((task) => {
                                    const deadline = formatDeadline(task.date);
                                    return (
                                        <div
                                            key={task.id}
                                            className={`flex items-center gap-3 px-6 py-3.5 hover:bg-white/[0.03] transition-colors group ${task.completed ? "opacity-50" : ""
                                                }`}
                                        >
                                            <button
                                                onClick={() => toggleTask(task.id)}
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${task.completed
                                                    ? "bg-emerald-500/30 border-emerald-500/40 text-emerald-400"
                                                    : "border-white/[0.15] hover:border-purple-500/40"
                                                    }`}
                                            >
                                                {task.completed && <Check className="h-3 w-3" />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[13px] font-medium truncate ${task.completed ? "line-through text-white/40" : "text-white"
                                                    }`}>
                                                    {task.title}
                                                </p>
                                                <p className={`text-[11px] mt-0.5 ${deadline.urgent && !task.completed ? "text-red-400" : "text-white/35"
                                                    }`}>
                                                    {deadline.label}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {!task.completed && task.priority === "urgent" && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/20">Urgent</span>
                                                )}
                                                {!task.completed && task.priority === "high" && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/20">High</span>
                                                )}
                                                {!task.completed && task.priority === "normal" && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-white/[0.08] text-white/30">Pending</span>
                                                )}
                                                <button
                                                    onClick={() => deleteTask(task.id)}
                                                    className="min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-white/0 group-hover:text-white/30 hover:!text-red-400 hover:bg-red-500/10 transition-all"
                                                    aria-label={`Delete task: ${task.title}`}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Weekly Activity Chart */}
                    <div className="liquid-glass rounded-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[16px] font-display font-bold text-white">
                                Weekly Activity
                            </h3>
                            <span className="text-[11px] text-white/35 px-3 py-1 rounded-lg border border-white/[0.08]">
                                This Week
                            </span>
                        </div>
                        {!isLoadingRecent && !weeklyActivity.some(d => d.value > 0) ? (
                            <div className="h-[120px] border-b border-white/[0.06] flex items-center justify-center">
                                <p className="text-[12px] text-white/25 text-center">
                                    No activity recorded this week
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-end gap-3 h-[120px] border-b border-white/[0.06] pb-1">
                                {isLoadingRecent ? (
                                    DAY_LABELS.map((day, i) => (
                                        <div key={day} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                                            <Skeleton className="w-full rounded-md bg-white/[0.04]" style={{ height: `${[40, 70, 30, 80, 50, 90, 60][i]}%` }} />
                                            <span className="text-[11px] text-white/35 opacity-50">{day}</span>
                                        </div>
                                    ))
                                ) : (
                                    weeklyActivity.map((day) => {
                                        const isToday = day.day === format(new Date(), 'EEE');
                                        return (
                                            <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                                                <div
                                                    className={`w-full rounded-md transition-all ${isToday
                                                        ? "bg-purple-500/80 shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                                                        : "bg-white/[0.08]"
                                                        }`}
                                                    style={{ height: `${Math.max(day.value, 4)}%` }}
                                                />
                                                <span className={`text-[11px] ${isToday ? "text-purple-400 font-semibold" : "text-white/35"}`}>{day.day}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reputation Card */}
                    {activitySummary && (
                        <div className="liquid-glass rounded-2xl p-6 border-purple-500/20 glow-purple-soft">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="h-4 w-4 text-purple-400" />
                                <span className="text-[13px] font-display font-semibold text-white/70">Your Reputation</span>
                            </div>
                            <div className="text-[32px] font-display font-bold text-white leading-none">
                                {activitySummary.totalPoints}
                            </div>
                            <p className="text-[12px] text-white/35 mt-1">Points earned</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Task Modal */}
            {showAddTask && (
                <AddTaskModal
                    onClose={() => { setShowAddTask(false); setAddTaskDefaults({}); }}
                    onAdd={addTask}
                    initialDate={addTaskDefaults.date}
                    initialStartHour={addTaskDefaults.startHour}
                    initialDuration={addTaskDefaults.duration}
                />
            )}
        </div>
    );
}
