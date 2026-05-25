import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Clock,
    FileText,
    Zap,
    AlertCircle,
    ArrowRight,
    BookOpen,
    Plus,
    PlayCircle,
    Calendar,
    Check,
    Trash2,
    TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LearningPlan from "@/components/dashboard/LearningPlan";
import MiniCalendar from "@/components/dashboard/MiniCalendar";
import AddTaskModal from "@/components/dashboard/AddTaskModal";
import { useRecentFiles } from "@/hooks/useFiles";
import { useMyRequests } from "@/hooks/useRequests";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/context/AuthContext";
import { useCourses, useMajors } from "@/hooks/useCatalog";
import { useActivitySummary } from "@/hooks/useLearningPath";
import { useDashboardData, DAY_LABELS } from "@/hooks/useDashboardData";
import { getGreeting, formatDeadline } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";


// ────────────────────────────────────────────
// Recent Courses (derived from recent files)
// ────────────────────────────────────────────

const progressColors: Record<string, string> = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    red: "bg-red-500",
};

const progressGlows: Record<string, string> = {
    blue: "shadow-[0_0_12px_rgba(37,99,235,0.4)]",
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

    const { tasks, taskDates, addTask, toggleTask, moveTask, deleteTask } = useTasks();
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
                    <Button onClick={() => window.location.reload()} className="gradient-bg border-0 glow-blue-soft">
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    const lastFile = recentFiles && recentFiles.length > 0 ? recentFiles[0] : null;
    const lastFileCourse = allCourses?.find(c => c.id === lastFile?.courseId);

    const { recentCourses, weeklyActivity } = useDashboardData(
        recentFiles,
        _requests,
        allCourses,
        allMajors,
    );

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
            iconColor: "text-blue-400"
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

    const displayTasks = (selectedDate
        ? tasks.filter(t => t.date === selectedDate)
        : tasks
    ).filter(t => showCompleted || !t.completed);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── Continue Studying Hero ── */}
            {isLoadingRecent ? (
                <Skeleton className="h-[104px] w-full rounded-2xl bg-white/[0.02] border border-blue-500/10" />
            ) : lastFile && (
                <Link to={`/courses/${lastFile.courseId}/files/${lastFile.id}`} className="block group">
                    <div className="liquid-glass rounded-2xl p-6 flex items-center gap-5 border-blue-500/15 hover:border-blue-500/30 transition-colors">
                        <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-lg">
                            <PlayCircle className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-display font-semibold text-blue-400 uppercase tracking-[0.15em] mb-1">
                                Continue Studying
                            </p>
                            <h2 className="text-[20px] font-display font-bold text-white leading-tight truncate group-hover:text-blue-200 transition-colors">
                                {lastFile.title}
                            </h2>
                            <p className="text-[12px] text-white/35 mt-1 flex items-center gap-2">
                                <span className="truncate max-w-[150px]">{lastFileCourse?.name ?? lastFile.courseId}</span>
                                <span>•</span>
                                <Clock className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(lastFile.viewedAt), { addSuffix: true })}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[13px] font-display font-semibold text-blue-400 group-hover:text-blue-300 transition-colors shrink-0">
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
                        className={`rounded-2xl p-6 transition-all animate-fade-in-up opacity-0 ${metric.hero ? "liquid-glass border-blue-500/20 shadow-lg shadow-blue-500/5" : "liquid-glass"
                            } stagger-${i + 1}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <metric.icon className={`h-4 w-4 ${metric.iconColor}`} />
                                <span className="text-[12px] text-white/45 font-medium">{metric.label}</span>
                            </div>
                            <span className={`text-[12px] font-display font-semibold ${metric.neutral ? "text-white/40" : metric.positive ? "text-emerald-400" : "text-red-400"
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
                    <LearningPlan tasks={tasks} onToggleTask={toggleTask} onMoveTask={moveTask} onOpenAddModal={(date, startHour, duration) => {
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
                                        <Button className="gradient-bg border-0 glow-blue-soft">Browse Courses</Button>
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
                                            <h3 className="text-[15px] font-display font-semibold text-white leading-tight group-hover:text-blue-300 transition-colors">
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
                                                        <p className="text-[14px] font-medium text-white truncate group-hover:text-blue-300 transition-colors">
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
                                    className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/15 transition-all"
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
                                    className="text-[12px] text-blue-400 hover:text-blue-300 mt-2 transition-colors"
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
                                                    : "border-white/[0.15] hover:border-blue-500/40"
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
                                                        ? "bg-blue-500/80 shadow-[0_0_8px_rgba(37, 99, 235,0.3)]"
                                                        : "bg-white/[0.08]"
                                                        }`}
                                                    style={{ height: `${Math.max(day.value, 4)}%` }}
                                                />
                                                <span className={`text-[11px] ${isToday ? "text-blue-400 font-semibold" : "text-white/35"}`}>{day.day}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reputation Card */}
                    {activitySummary && (
                        <div className="liquid-glass rounded-2xl p-6 border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="h-4 w-4 text-blue-400" />
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
