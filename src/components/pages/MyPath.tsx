import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    ChevronLeft, BookOpen, 
    Star, Lock, CheckCircle, Trophy, Flame,
    Sparkles,
} from "lucide-react";
import { useMyLearningPath } from "@/queries/useLearningPath";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseStatus } from "@/types/domain";

// ─── Config maps ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<CourseStatus | "locked", { ring: string; bg: string; opacity: string }> = {
    completed: { ring: "ring-2 ring-emerald-400/60", bg: "bg-emerald-500/10", opacity: "opacity-100" },
    engaged: { ring: "ring-2 ring-violet-400/80 ring-offset-2 ring-offset-[#0e0c1a]", bg: "bg-violet-500/10", opacity: "opacity-100" },
    exploring: { ring: "ring-1 ring-blue-400/50", bg: "bg-blue-500/10", opacity: "opacity-80" },
    not_started: { ring: "ring-1 ring-white/10", bg: "bg-white/3", opacity: "opacity-60" },
    locked: { ring: "ring-1 ring-white/5", bg: "bg-white/2", opacity: "opacity-40" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function xpPercent(earned: number, total: number) {
    if (total === 0) return 0;
    return Math.min(100, Math.round((earned / total) * 100));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated XP bar */
function XpBar({ earned, total }: { earned: number; total: number }) {
    const pct = xpPercent(earned, total);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = barRef.current;
        if (!el) return;
        el.style.width = "0%";
        requestAnimationFrame(() => {
            setTimeout(() => { el.style.width = `${pct}%`; }, 80);
        });
    }, [pct]);

    return (
        <div className="w-full h-2.5 rounded-full bg-white/8 overflow-hidden">
            <div
                ref={barRef}
                style={{ transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)" }}
                className={`h-full rounded-full ${pct === 100
                    ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                    : "bg-gradient-to-r from-violet-500 to-fuchsia-400"
                    }`}
            />
        </div>
    );
}

/** Single roadmap node (representing a Course) */
function RoadmapNode({
    course,
    index,
    isLast,
    side,
}: {
    course: any;
    index: number;
    isLast: boolean;
    side: "left" | "center" | "right";
}) {
    const statusCfg = STATUS_CONFIG[course.status as CourseStatus] || STATUS_CONFIG.not_started;
    const isCurrent = course.status === "engaged";
    const isDone = course.status === "completed";
    const isLocked = course.status === "not_started" && !course.hasFiles;

    const alignClass =
        side === "left" ? "mr-auto ml-0" :
            side === "right" ? "ml-auto mr-0" :
                "mx-auto";

    const completionScore = course.totalFiles > 0 ? course.filesCompleted / course.totalFiles : 0;

    return (
        <div className="relative flex flex-col items-center" style={{ animationDelay: `${index * 60}ms` }}>
            {/* Connector line above (except first) */}
            {index > 0 && (
                <div className={`w-px h-10 ${isDone ? "bg-gradient-to-b from-emerald-500/60 to-emerald-500/20" : isCurrent ? "bg-gradient-to-b from-violet-500/50 to-violet-500/10" : "bg-white/8"}`} />
            )}

            {/* Node card */}
            <Link
                to={`/courses/${course.id}/materials`}
                className={`
                    relative group w-[300px] rounded-2xl border transition-all duration-300 cursor-pointer block
                    ${alignClass}
                    ${statusCfg.ring} ${statusCfg.bg} ${statusCfg.opacity}
                    ${isLocked ? "cursor-not-allowed pointer-events-none" : "hover:scale-[1.02] hover:brightness-110"}
                    ${isCurrent ? `shadow-lg shadow-violet-500/40` : ""}
                    border-white/8
                `}
            >
                {/* Pulse ring for current */}
                {isCurrent && (
                    <span className="absolute -inset-1 rounded-2xl ring-2 ring-violet-400/30 animate-ping pointer-events-none" style={{ animationDuration: "2.4s" }} />
                )}

                <div className="p-4 flex items-center gap-3.5">
                    {/* Icon bubble */}
                    <div className={`
                        relative flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
                        bg-violet-500/20 text-violet-300
                        ${isDone ? "shadow-sm shadow-emerald-500/40 bg-emerald-500/20 text-emerald-300" : ""}
                    `}>
                        {isLocked
                            ? <Lock className="w-4 h-4 text-white/30" />
                            : isDone
                                ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                                : <BookOpen className="w-5 h-5" />
                        }
                        {/* Star badge for completed */}
                        {isDone && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow">
                                <Star className="w-2.5 h-2.5 text-amber-900 fill-amber-900" />
                            </span>
                        )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-semibold tracking-widest uppercase text-violet-300 opacity-70`}>
                                {course.code}
                            </span>
                        </div>
                        <p className={`text-[13px] font-medium leading-snug truncate ${isLocked ? "text-white/25" : "text-white/90"}`}>
                            {course.name}
                        </p>

                        {/* Progress bar */}
                        {(isCurrent || course.status === "exploring") && completionScore > 0 && (
                            <div className="mt-2 w-full h-1 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                                    style={{ width: `${Math.round(completionScore * 100)}%`, transition: "width 0.8s ease" }}
                                />
                            </div>
                        )}
                        {(isCurrent || course.status === "exploring") && (
                            <p className="text-[10px] text-white/30 mt-1">
                                {course.filesCompleted} / {course.totalFiles} files read
                            </p>
                        )}
                    </div>
                </div>

                {/* "Continue" CTA for current node */}
                {isCurrent && (
                    <div className="px-4 pb-3.5">
                        <div className="flex items-center justify-between text-[11px] text-violet-400/80 font-medium">
                            <span>Continue studying →</span>
                        </div>
                    </div>
                )}
            </Link>

            {/* Bottom connector (except last) */}
            {!isLast && (
                <div className={`w-px h-10 ${isDone ? "bg-gradient-to-b from-emerald-500/20 to-emerald-500/5" : "bg-white/8"}`} />
            )}
        </div>
    );
}

/** Semester selector pill */
function SemesterTab({
    semesterStr,
    active,
    onClick,
    courses
}: {
    semesterStr: string;
    active: boolean;
    onClick: () => void;
    courses: any[];
}) {
    const total = courses.length;
    const done = courses.filter(c => c.status === "completed").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const allDone = done === total && total > 0;

    return (
        <button
            onClick={onClick}
            className={`
                flex-shrink-0 flex flex-col gap-1.5 px-4 py-3 rounded-xl border text-left transition-all duration-200
                ${active
                    ? "bg-violet-500/15 border-violet-500/40 shadow-lg shadow-violet-500/10"
                    : "bg-white/4 border-white/8 hover:bg-white/6 hover:border-white/14"
                }
            `}
        >
            <div className="flex items-center gap-2">
                {allDone && <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                <span className={`text-[12px] font-semibold ${active ? "text-white" : "text-white/60"}`}>
                    {semesterStr}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden w-20">
                    <div
                        className={`h-full rounded-full ${allDone ? "bg-emerald-400" : "bg-violet-500"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <span className="text-[10px] text-white/30 flex-shrink-0">{done}/{total}</span>
            </div>
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyPath() {
    const { data: learningPath, isLoading, error } = useMyLearningPath();
    const [activeSemiId, setActiveSemiId] = useState("");

    const semesters = useMemo(() => {
        if (!learningPath || !learningPath.years) return [];
        return learningPath.years.flatMap(y => 
            y.semesters.map(s => ({
                id: `${y.yearId}-${s.semester}`,
                label: `${y.label} - ${s.label}`,
                courses: s.courses
            }))
        );
    }, [learningPath]);

    useEffect(() => {
        if (semesters.length > 0 && !activeSemiId) {
            setActiveSemiId(semesters[0].id);
        }
    }, [semesters, activeSemiId]);

    if (isLoading) {
        return (
            <div className="animate-fade-in space-y-8 pb-20 p-8">
                <Skeleton className="h-12 w-64 bg-white/[0.05]" />
                <Skeleton className="h-32 w-full bg-white/[0.05]" />
                <Skeleton className="h-[400px] w-full bg-white/[0.05]" />
            </div>
        );
    }

    if (error || semesters.length === 0 || !learningPath) {
        return (
            <div className="animate-fade-in space-y-8 pb-20 flex flex-col items-center justify-center pt-20">
                <BookOpen className="w-12 h-12 text-white/20 mb-4" />
                <div className="text-white/40 text-[15px]">No learning path available yet. You might not be enrolled in any courses.</div>
            </div>
        );
    }

    const activeSemester = semesters.find(s => s.id === activeSemiId) || semesters[0];
    const courses = activeSemester.courses || [];
    
    const totalFiles = courses.reduce((sum: number, c: any) => sum + c.totalFiles, 0);
    const filesDone = courses.reduce((sum: number, c: any) => sum + c.filesCompleted, 0);
    const pct = totalFiles > 0 ? Math.round((filesDone/totalFiles)*100) : 0;
    const allDone = courses.every(c => c.status === "completed") && courses.length > 0;

    // Zigzag sides for nodes
    const sides: ("left" | "center" | "right")[] = ["center", "right", "center", "left", "center", "right", "center", "left", "center"];

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Back */}
            <Link
                to="/"
                className="text-white/40 hover:text-white/70 flex items-center gap-2 text-[13px] w-fit transition-colors"
            >
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                Back to Dashboard
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <h1 className="text-[26px] font-bold text-white tracking-tight leading-none">
                            My Learning Path
                        </h1>
                        {allDone && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/25 text-amber-300 text-[11px] font-semibold">
                                <Trophy className="w-3 h-3" /> Semester Completed!
                            </span>
                        )}
                    </div>
                    <p className="text-white/40 text-[13px]">
                        Track your progress through your courses for {learningPath.major.name}.
                    </p>
                </div>
            </div>

            {/* Course tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {semesters.map(s => (
                    <SemesterTab
                        key={s.id}
                        semesterStr={s.label}
                        courses={s.courses}
                        active={s.id === activeSemiId}
                        onClick={() => setActiveSemiId(s.id)}
                    />
                ))}
            </div>

            {/* Course header card */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <p className="text-[11px] text-white/30 font-mono mb-1 tracking-wider">{learningPath.major.id.toUpperCase()}</p>
                        <h2 className="text-[18px] font-bold text-white leading-snug">{activeSemester.label}</h2>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span className="text-[13px] font-semibold text-white/70">{filesDone} / {totalFiles} files</span>
                    </div>
                </div>

                {/* XP bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-white/30">
                        <span>Progress</span>
                        <span>{pct}%</span>
                    </div>
                    <XpBar earned={filesDone} total={totalFiles} />
                </div>
            </div>

            {/* ── Roadmap ─────────────────────────────────────────────────── */}
            <div className="relative pt-4">
                {/* Ambient glow behind the path */}
                <div className="absolute inset-x-0 top-0 h-full pointer-events-none">
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-gradient-to-b from-violet-500/20 via-violet-500/5 to-transparent" />
                </div>

                {/* Nodes */}
                <div className="flex flex-col items-center relative z-10">
                    {/* Start badge */}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[12px] font-semibold mb-6 shadow-lg shadow-violet-500/10">
                        <Sparkles className="w-3.5 h-3.5" />
                        Start of Semester
                    </div>

                    {courses.map((course: any, index: number) => (
                        <RoadmapNode
                            key={course.id}
                            course={course}
                            index={index}
                            isLast={index === courses.length - 1}
                            side={sides[index % sides.length]}
                        />
                    ))}

                    {courses.length === 0 && (
                        <div className="text-white/30 text-[13px] py-10">No courses in this semester</div>
                    )}

                    {/* Finish badge */}
                    {courses.length > 0 && (
                        <div className={`mt-6 flex items-center gap-2 px-4 py-2 rounded-full border text-[12px] font-semibold transition-all duration-500
                            ${allDone
                                ? "bg-amber-400/15 border-amber-400/30 text-amber-300 shadow-lg shadow-amber-400/15"
                                : "bg-white/4 border-white/10 text-white/25"
                            }
                        `}>
                            <Trophy className="w-3.5 h-3.5" />
                            {allDone ? "All Courses Conquered!" : "Finish all courses"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}