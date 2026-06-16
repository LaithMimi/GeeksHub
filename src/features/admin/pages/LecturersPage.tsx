import { useMemo, useState } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useCourses } from "@/features/courses/hooks/useCatalog";
import { Avatar } from "@/features/directory/components/Avatar";
import { AssignmentManager } from "@/features/directory/components/AssignmentManager";
import {
    useDirectoryLecturers, useCreateLecturer, useUpdateLecturer, useDeleteLecturer,
    useLecturerCourses, useAssignLecturerCourse, useUnassignLecturerCourse,
} from "@/features/directory/hooks/useDirectory";
import type { LecturerWithCount } from "@/features/directory/api/directoryService";
import type { Course } from "@/types/domain";

export default function LecturersPage() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [renaming, setRenaming] = useState<LecturerWithCount | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [deleting, setDeleting] = useState<LecturerWithCount | null>(null);

    const { data: lecturers = [], isLoading } = useDirectoryLecturers();
    const createLecturer = useCreateLecturer();
    const updateLecturer = useUpdateLecturer();
    const deleteLecturer = useDeleteLecturer();

    const selected = lecturers.find((l) => l.id === selectedId) ?? null;

    const filtered = useMemo(
        () => lecturers.filter((l) => l.name.toLowerCase().includes(search.trim().toLowerCase())),
        [lecturers, search],
    );

    const handleCreate = () => {
        const name = newName.trim();
        if (!name) { toast.error("Name is required"); return; }
        createLecturer.mutate(name, {
            onSuccess: (created) => {
                setNewName("");
                setCreating(false);
                if (created?.id) setSelectedId(created.id);
            },
        });
    };

    const handleRename = () => {
        if (!renaming) return;
        const name = renameValue.trim();
        if (!name) { toast.error("Name is required"); return; }
        updateLecturer.mutate({ id: renaming.id, name }, { onSuccess: () => setRenaming(null) });
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="py-4 mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <GraduationCap className="h-5 w-5 text-blue-400" />
                        <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                            Lecturers
                        </h1>
                        {!isLoading && (
                            <span className="text-[12px] font-medium text-muted-foreground/70 bg-foreground/5 rounded-full px-2.5 py-0.5">
                                {lecturers.length}
                            </span>
                        )}
                    </div>
                    <p className="text-[13px] text-muted-foreground ms-8">
                        Add lecturers and assign the courses they teach.
                    </p>
                </div>
                <Button onClick={() => setCreating(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> New Lecturer
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
                {/* Left: searchable lecturer list */}
                <div className="liquid-glass-subtle rounded-2xl p-2.5 flex flex-col">
                    <div className="relative mb-2.5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input
                            placeholder="Search lecturers…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-10 bg-background/40"
                        />
                    </div>

                    <div className="space-y-1 overflow-auto pr-0.5 max-h-[calc(100vh-280px)] min-h-[200px]">
                        {isLoading ? (
                            Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
                                    <Skeleton className="h-10 w-10 rounded-lg" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-3.5 w-2/3" />
                                        <Skeleton className="h-2.5 w-1/3" />
                                    </div>
                                </div>
                            ))
                        ) : lecturers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                                <GraduationCap className="h-9 w-9 text-muted-foreground/30 mb-3" />
                                <p className="text-[13px] text-muted-foreground mb-3">No lecturers yet.</p>
                                <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
                                    <Plus className="h-3.5 w-3.5" /> Add the first one
                                </Button>
                            </div>
                        ) : filtered.length === 0 ? (
                            <p className="text-center text-muted-foreground/60 py-10 text-[13px]">
                                No lecturers match “{search}”.
                            </p>
                        ) : (
                            filtered.map((lec) => {
                                const active = selectedId === lec.id;
                                return (
                                    <div
                                        key={lec.id}
                                        onClick={() => setSelectedId(lec.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(lec.id); } }}
                                        className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                                            active
                                                ? "bg-blue-500/[0.10] border border-blue-500/25"
                                                : "border border-transparent hover:bg-foreground/5"
                                        }`}
                                    >
                                        <Avatar name={lec.name} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`truncate text-[14px] ${active ? "text-foreground font-semibold" : "text-foreground/90"}`}>
                                                {lec.name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground/60">
                                                {lec.courseCount} {lec.courseCount === 1 ? "course" : "courses"}
                                            </p>
                                        </div>
                                        <div className={`flex items-center gap-0.5 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setRenaming(lec); setRenameValue(lec.name); }}
                                                className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors"
                                                aria-label={`Rename ${lec.name}`}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleting(lec); }}
                                                className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                aria-label={`Delete ${lec.name}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right: assigned courses */}
                <div className="liquid-glass-subtle rounded-2xl p-5 lg:p-6 min-h-[420px]">
                    {selected ? (
                        <LecturerCoursePanel
                            lecturer={selected}
                            onRename={() => { setRenaming(selected); setRenameValue(selected.name); }}
                            onDelete={() => setDeleting(selected)}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-20">
                            <div className="h-14 w-14 rounded-2xl bg-foreground/5 flex items-center justify-center mb-4">
                                <Users className="h-7 w-7 text-muted-foreground/40" />
                            </div>
                            <p className="text-[15px] font-medium text-foreground/80 mb-1">No lecturer selected</p>
                            <p className="text-[13px] text-muted-foreground max-w-xs">
                                Pick a lecturer on the left to view and manage the courses they teach.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create dialog */}
            <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setNewName(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New lecturer</DialogTitle>
                        <DialogDescription>Add a lecturer to the directory.</DialogDescription>
                    </DialogHeader>
                    <Input
                        autoFocus
                        placeholder="Dr. Jane Smith"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setCreating(false); setNewName(""); }}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={createLecturer.isPending}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename dialog */}
            <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename lecturer</DialogTitle>
                    </DialogHeader>
                    <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
                        <Button onClick={handleRename} disabled={updateLecturer.isPending}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete dialog */}
            <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete lecturer?</DialogTitle>
                        <DialogDescription>
                            This removes <strong>{deleting?.name}</strong> and their course assignments.
                            Lecturers referenced by existing materials cannot be deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={deleteLecturer.isPending}
                            onClick={() => {
                                if (!deleting) return;
                                deleteLecturer.mutate(deleting.id, {
                                    onSuccess: () => {
                                        if (selectedId === deleting.id) setSelectedId(null);
                                        setDeleting(null);
                                    },
                                });
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
// Right panel: a lecturer's assigned courses
// ---------------------------------------------------------------------------

function LecturerCoursePanel({
    lecturer, onRename, onDelete,
}: {
    lecturer: LecturerWithCount;
    onRename: () => void;
    onDelete: () => void;
}) {
    const { data: assigned = [], isLoading } = useLecturerCourses(lecturer.id);
    const { data: allCourses = [] } = useCourses({});
    const assign = useAssignLecturerCourse();
    const unassign = useUnassignLecturerCourse();

    return (
        <div className="space-y-6">
            {/* Panel header */}
            <div className="flex items-start gap-3">
                <Avatar name={lecturer.name} />
                <div className="flex-1 min-w-0">
                    <h2 className="text-[17px] font-semibold text-foreground truncate">{lecturer.name}</h2>
                    <p className="text-[12px] text-muted-foreground">
                        {isLoading ? "Loading courses…" : `Teaching ${assigned.length} ${assigned.length === 1 ? "course" : "courses"}`}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onRename}>
                        <Pencil className="h-3.5 w-3.5" /> Rename
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={onDelete}
                        aria-label="Delete lecturer"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="h-px bg-border" />

            <AssignmentManager<Course, Course>
                assignedHeading="Assigned courses"
                addHeading="Assign a course"
                searchPlaceholder="Search courses to add…"
                assigned={assigned}
                pool={allCourses}
                isLoading={isLoading}
                assigning={assign.isPending}
                assignedId={(c) => c.id}
                poolId={(c) => c.id}
                renderAssigned={(c) => (
                    <span>
                        <span className="font-medium">{c.code}</span>
                        <span className="text-blue-300/70"> {c.name}</span>
                    </span>
                )}
                renderPoolItem={(c) => (
                    <span>
                        <span className="font-medium text-foreground/80">{c.code}</span> {c.name}
                    </span>
                )}
                poolSearchText={(c) => `${c.code} ${c.name}`}
                onAdd={(courseId) => assign.mutate({ lecturerId: lecturer.id, courseId })}
                onRemove={(courseId) => unassign.mutate({ lecturerId: lecturer.id, courseId })}
                emptyAssigned="No courses assigned yet."
                emptyPool="No courses exist yet."
            />
        </div>
    );
}
