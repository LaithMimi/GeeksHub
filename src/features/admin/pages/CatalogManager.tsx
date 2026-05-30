import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ChevronDown, ChevronRight, Plus, X, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
    listAllCourses, listAllLecturers,
    getCourseLecturers, assignLecturer, unassignLecturer,
} from "../api/catalogAdminService";
import type { Course, Lecturer } from "@/types/domain";

// ---------------------------------------------------------------------------
// Course row — expands to show assigned lecturers + add/remove UI
// ---------------------------------------------------------------------------

function CourseRow({ course, allLecturers }: { course: Course; allLecturers: Lecturer[] }) {
    const [open, setOpen] = useState(false);
    const [lecturerSearch, setLecturerSearch] = useState("");
    const qc = useQueryClient();
    const key = ["course-lecturers", course.id];

    const { data: assigned = [], isLoading } = useQuery({
        queryKey: key,
        queryFn: () => getCourseLecturers(course.id),
        enabled: open,
    });

    const { mutate: assign, isPending: assigning } = useMutation({
        mutationFn: (lecturerId: string) => assignLecturer(course.id, lecturerId),
        onSuccess: () => qc.invalidateQueries({ queryKey: key }),
        onError: () => toast.error("Failed to assign lecturer"),
    });

    const { mutate: unassign } = useMutation({
        mutationFn: (lecturerId: string) => unassignLecturer(course.id, lecturerId),
        onSuccess: () => qc.invalidateQueries({ queryKey: key }),
        onError: () => toast.error("Failed to remove lecturer"),
    });

    const assignedIds = new Set(assigned.map((l) => l.id));
    const available = allLecturers.filter((l) => !assignedIds.has(l.id));
    const filteredAvailable = available.filter((l) =>
        l.name.toLowerCase().includes(lecturerSearch.toLowerCase())
    );

    const handleToggle = () => {
        if (open) setLecturerSearch("");
        setOpen((v) => !v);
    };

    return (
        <div className="liquid-glass-subtle rounded-xl overflow-hidden">
            <button
                onClick={handleToggle}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-foreground/5 transition-colors"
            >
                {open
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <div className="flex-1 min-w-0">
                    <span className="text-[14px] font-semibold text-foreground">{course.name}</span>
                    <span className="ml-2 text-[12px] text-muted-foreground">{course.code}</span>
                </div>
                <span className="text-[11px] text-muted-foreground/60 shrink-0">
                    Year {course.yearId} · Sem {course.semester}
                </span>
            </button>

            {open && (
                <div className="border-t border-border px-4 py-4 space-y-4">
                    {/* Assigned lecturers */}
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Assigned
                        </p>
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : assigned.length === 0 ? (
                            <p className="text-[13px] text-muted-foreground/60">No lecturers assigned yet.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {assigned.map((l) => (
                                    <span
                                        key={l.id}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[13px] text-blue-300"
                                    >
                                        {l.name}
                                        <button
                                            onClick={() => unassign(l.id)}
                                            className="hover:text-red-400 transition-colors"
                                            aria-label={`Remove ${l.name}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add lecturer */}
                    {available.length > 0 && (
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                Add Lecturer
                            </p>
                            <div className="relative mb-3">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                                <input
                                    type="search"
                                    placeholder="Search lecturers…"
                                    value={lecturerSearch}
                                    onChange={(e) => setLecturerSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg liquid-glass-subtle border border-border text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {filteredAvailable.length === 0 ? (
                                    <p className="text-[13px] text-muted-foreground/50">No lecturers match your search.</p>
                                ) : (
                                    filteredAvailable.map((l) => (
                                        <button
                                            key={l.id}
                                            onClick={() => assign(l.id)}
                                            disabled={assigning}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/60 text-[13px] text-muted-foreground hover:text-foreground hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors disabled:opacity-50"
                                        >
                                            <Plus className="h-3 w-3" />
                                            {l.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CatalogManager() {
    const [search, setSearch] = useState("");

    const { data: courses = [], isLoading: loadingCourses } = useQuery({
        queryKey: ["admin-all-courses"],
        queryFn: listAllCourses,
    });

    const { data: allLecturers = [], isLoading: loadingLecturers } = useQuery({
        queryKey: ["admin-all-lecturers"],
        queryFn: listAllLecturers,
    });

    const filtered = courses.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="animate-fade-in max-w-3xl mx-auto pb-20">
            <div className="py-4 mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Catalog Manager
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    Assign lecturers to courses so students see only relevant options when uploading.
                </p>
            </div>

            {/* Search */}
            <input
                type="search"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full mb-6 px-4 py-2.5 rounded-xl liquid-glass-subtle border border-border text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />

            {loadingCourses || loadingLecturers ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12 text-[14px]">No courses found.</p>
                    ) : (
                        filtered.map((course) => (
                            <CourseRow key={course.id} course={course} allLecturers={allLecturers} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
