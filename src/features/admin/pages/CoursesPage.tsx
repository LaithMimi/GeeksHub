import { useState } from "react";
import {
    BookOpen, Plus, Pencil, Trash2, ChevronRight, ChevronDown, Loader2, Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ACADEMIC_YEARS, SEMESTER_LABELS } from "@/lib/catalog";
import { useCourses, useMajors } from "@/features/courses/hooks/useCatalog";
import { AssignmentManager } from "@/features/directory/components/AssignmentManager";
import {
    useCreateCourse, useUpdateCourse, useDeleteCourse, useCourseLecturers,
    useDirectoryLecturers, useAssignLecturerCourse, useUnassignLecturerCourse,
} from "@/features/directory/hooks/useDirectory";
import type { CourseInput, LecturerWithCount } from "@/features/directory/api/directoryService";
import type { Course, Lecturer } from "@/types/domain";

export default function CoursesPage() {
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Course | null>(null);
    const [deleting, setDeleting] = useState<Course | null>(null);

    const { data: courses = [], isLoading } = useCourses({});
    const { data: majors = [] } = useMajors();
    const deleteCourse = useDeleteCourse();

    const majorName = (id: string) => majors.find((m) => m.id === id)?.name ?? "—";

    const filtered = courses.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    const openCreate = () => { setEditing(null); setShowForm(true); };
    const openEdit = (course: Course) => { setEditing(course); setShowForm(true); };

    return (
        <div className="animate-fade-in pb-20">
            <div className="py-4 mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Courses
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    Create and maintain the course catalog. Expand a row to assign lecturers.
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex gap-3 mb-5">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                        placeholder="Search courses…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" /> New Course
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-[14px]">No courses found.</p>
            ) : (
                <div className="space-y-2">
                    {filtered.map((course) => (
                        <div key={course.id} className="liquid-glass-subtle rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-3.5">
                                <button
                                    onClick={() => setExpandedId(expandedId === course.id ? null : course.id)}
                                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    aria-label="Toggle lecturers"
                                >
                                    {expandedId === course.id
                                        ? <ChevronDown className="h-4 w-4" />
                                        : <ChevronRight className="h-4 w-4" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[14px] font-semibold text-foreground">{course.name}</span>
                                    <span className="ml-2 text-[12px] text-muted-foreground">{course.code}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground/60 shrink-0 hidden sm:inline">
                                    {majorName(course.majorId)} · Year {course.yearId} · {SEMESTER_LABELS[course.semester ?? 0] ?? "—"}
                                </span>
                                <button
                                    onClick={() => openEdit(course)}
                                    className="text-muted-foreground/50 hover:text-foreground transition-colors"
                                    aria-label={`Edit ${course.name}`}
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setDeleting(course)}
                                    className="text-muted-foreground/50 hover:text-red-400 transition-colors"
                                    aria-label={`Delete ${course.name}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            {expandedId === course.id && (
                                <div className="border-t border-border px-4 py-4">
                                    <CourseLecturers courseId={course.id} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <CourseFormDialog
                    key={editing?.id ?? "new"}
                    course={editing}
                    majors={majors}
                    onClose={() => setShowForm(false)}
                />
            )}

            {/* Delete dialog */}
            <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete course?</DialogTitle>
                        <DialogDescription>
                            This removes <strong>{deleting?.code} · {deleting?.name}</strong>.
                            Courses with materials or requests cannot be deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={deleteCourse.isPending}
                            onClick={() => {
                                if (!deleting) return;
                                deleteCourse.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Assigned lecturers (expandable row)
// ---------------------------------------------------------------------------

function CourseLecturers({ courseId }: { courseId: string }) {
    const { data: assigned = [], isLoading } = useCourseLecturers(courseId);
    const { data: allLecturers = [] } = useDirectoryLecturers();
    const assign = useAssignLecturerCourse();
    const unassign = useUnassignLecturerCourse();

    return (
        <AssignmentManager<Lecturer, LecturerWithCount>
            assignedHeading="Assigned lecturers"
            addHeading="Assign a lecturer"
            searchPlaceholder="Search lecturers…"
            assigned={assigned}
            pool={allLecturers}
            isLoading={isLoading}
            assigning={assign.isPending}
            assignedId={(l) => l.id}
            poolId={(l) => l.id}
            renderAssigned={(l) => l.name}
            renderPoolItem={(l) => l.name}
            poolSearchText={(l) => l.name}
            onAdd={(lecturerId) => assign.mutate({ lecturerId, courseId })}
            onRemove={(lecturerId) => unassign.mutate({ lecturerId, courseId })}
            emptyAssigned="No lecturers assigned yet."
            emptyPool="No lecturers exist yet — add them on the Lecturers page."
        />
    );
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------

function CourseFormDialog({
    course, majors, onClose,
}: {
    course: Course | null;
    majors: { id: string; name: string }[];
    onClose: () => void;
}) {
    // Mounted fresh per course (parent passes a key), so init directly from props.
    const [code, setCode] = useState(course?.code ?? "");
    const [name, setName] = useState(course?.name ?? "");
    const [majorId, setMajorId] = useState(course?.majorId ?? "");
    const [yearId, setYearId] = useState(course?.yearId ?? 1);
    const [semester, setSemester] = useState(course?.semester ?? 1);

    const createCourse = useCreateCourse();
    const updateCourse = useUpdateCourse();
    const saving = createCourse.isPending || updateCourse.isPending;

    const handleSave = () => {
        if (!code.trim() || !name.trim()) { toast.error("Code and name are required"); return; }
        if (!majorId) { toast.error("Select a major"); return; }
        const payload: CourseInput = { code: code.trim(), name: name.trim(), majorId, yearId, semester };
        if (course) {
            updateCourse.mutate({ id: course.id, data: payload }, { onSuccess: onClose });
        } else {
            createCourse.mutate(payload, { onSuccess: onClose });
        }
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{course ? "Edit course" : "New course"}</DialogTitle>
                    <DialogDescription>
                        {course ? "Update the course details." : "Add a course to the catalog."}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-[140px_1fr] gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="course-code">Code</Label>
                            <Input id="course-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS101" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="course-name">Name</Label>
                            <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Intro to Programming" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Major</Label>
                        <Select value={majorId} onValueChange={setMajorId}>
                            <SelectTrigger>
                                <SelectValue>
                                    <span className={`truncate ${majorId ? "" : "text-muted-foreground"}`}>
                                        {majorId
                                            ? majors.find((m) => m.id === majorId)?.name ?? "Select a major"
                                            : "Select a major"}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {majors.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Year</Label>
                            <Select value={String(yearId)} onValueChange={(v) => setYearId(Number(v))}>
                                <SelectTrigger><SelectValue>Year {yearId}</SelectValue></SelectTrigger>
                                <SelectContent>
                                    {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Semester</Label>
                            <Select value={String(semester)} onValueChange={(v) => setSemester(Number(v))}>
                                <SelectTrigger><SelectValue>{SEMESTER_LABELS[semester] ?? "—"}</SelectValue></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SEMESTER_LABELS).map(([val, lbl]) => (
                                        <SelectItem key={val} value={val}>{lbl}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {course ? "Save changes" : "Create course"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
