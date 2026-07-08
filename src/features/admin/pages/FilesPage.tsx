import { useState } from "react";
import {
    FileText, Pencil, Trash2, Loader2, Search,
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
import { useAdminFiles, useAdminDeleteFile, useAdminUpdateFile } from "@/features/admin/hooks/useAdminFiles";
import { useCourses, useTypes } from "@/features/courses/hooks/useCatalog";
import { useDirectoryLecturers } from "@/features/directory/hooks/useDirectory";
import type { File } from "@/types/domain";
import { Badge } from "@/components/ui/badge";

export default function FilesPage() {
    const [search, setSearch] = useState("");
    const [editing, setEditing] = useState<File | null>(null);
    const [deleting, setDeleting] = useState<File | null>(null);

    const { data: files = [], isLoading } = useAdminFiles();
    const { data: courses = [] } = useCourses({});
    const { data: lecturers = [] } = useDirectoryLecturers();
    const { data: types = [] } = useTypes();
    const deleteFile = useAdminDeleteFile();

    const getCourseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "Unknown Course";
    const getLecturerName = (id: string) => lecturers.find((l) => l.id === id)?.name ?? "Unknown Lecturer";
    const getTypeName = (id: string) => types.find((t) => t.id === id)?.displayName ?? id;

    const filtered = files.filter((f) =>
        f.title.toLowerCase().includes(search.toLowerCase()) ||
        getCourseName(f.courseId).toLowerCase().includes(search.toLowerCase()) ||
        getLecturerName(f.lecturerId).toLowerCase().includes(search.toLowerCase())
    );

    const openEdit = (file: File) => setEditing(file);

    return (
        <div className="animate-fade-in pb-20">
            <div className="py-4 mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <FileText className="h-5 w-5 text-blue-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Files
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    Manage all approved files across the platform. Edit metadata or delete files.
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex gap-3 mb-5">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                        placeholder="Search files by title, course, or lecturer…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-[14px]">No files found.</p>
            ) : (
                <div className="space-y-2">
                    {filtered.map((file) => (
                        <div key={file.id} className="liquid-glass-subtle rounded-xl overflow-hidden">
                            <div className="flex items-center gap-4 px-4 py-3.5">
                                <div className="flex-1 min-w-0">
                                    <span className="text-[14px] font-semibold text-foreground truncate block">{file.title}</span>
                                    <span className="text-[12px] text-muted-foreground truncate block mt-0.5">
                                        {getCourseName(file.courseId)} · {getLecturerName(file.lecturerId)}
                                    </span>
                                </div>
                                <div className="shrink-0 hidden sm:flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px]">
                                        {getTypeName(file.typeId)}
                                    </Badge>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <button
                                        onClick={() => openEdit(file)}
                                        className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                                        aria-label={`Edit ${file.title}`}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleting(file)}
                                        className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                        aria-label={`Delete ${file.title}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <EditFileModal
                    file={editing}
                    onClose={() => setEditing(null)}
                    courses={courses}
                    lecturers={lecturers}
                    types={types}
                />
            )}

            {/* Delete dialog */}
            <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete file?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deleting?.title}</strong>?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={deleteFile.isPending}
                            onClick={() => {
                                if (!deleting) return;
                                deleteFile.mutate(deleting.id, { 
                                    onSuccess: () => {
                                        toast.success("File deleted successfully");
                                        setDeleting(null);
                                    },
                                    onError: () => toast.error("Failed to delete file")
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
// Edit File Modal
// ---------------------------------------------------------------------------

function EditFileModal({
    file, onClose, courses, lecturers, types
}: {
    file: File;
    onClose: () => void;
    courses: { id: string; name: string; code: string }[];
    lecturers: { id: string; name: string }[];
    types: { id: string; displayName: string }[];
}) {
    const [title, setTitle] = useState(file.title);
    const [courseId, setCourseId] = useState(file.courseId);
    const [lecturerId, setLecturerId] = useState(file.lecturerId);
    const [typeId, setTypeId] = useState(file.typeId);

    const updateFile = useAdminUpdateFile();
    const saving = updateFile.isPending;

    const handleSave = () => {
        if (!title.trim()) { toast.error("Title is required"); return; }
        if (!courseId) { toast.error("Course is required"); return; }
        if (!lecturerId) { toast.error("Lecturer is required"); return; }
        if (!typeId) { toast.error("Type is required"); return; }
        
        updateFile.mutate({ 
            id: file.id, 
            data: { title: title.trim(), courseId, lecturerId, typeId } 
        }, { 
            onSuccess: () => {
                toast.success("File updated successfully");
                onClose();
            },
            onError: () => toast.error("Failed to update file")
        });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit file</DialogTitle>
                    <DialogDescription>
                        Update the file's metadata.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                    className="space-y-4 py-2"
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="file-title">Title <span className="text-destructive">*</span></Label>
                        <Input id="file-title" value={title} onChange={(e) => setTitle(e.target.value)} required aria-required="true" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Course <span className="text-destructive">*</span></Label>
                        <Select value={courseId} onValueChange={setCourseId} aria-required="true">
                            <SelectTrigger>
                                <SelectValue placeholder="Select a course" />
                            </SelectTrigger>
                            <SelectContent>
                                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Lecturer <span className="text-destructive">*</span></Label>
                        <Select value={lecturerId} onValueChange={setLecturerId} aria-required="true">
                            <SelectTrigger>
                                <SelectValue placeholder="Select a lecturer" />
                            </SelectTrigger>
                            <SelectContent>
                                {lecturers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Material Type <span className="text-destructive">*</span></Label>
                        <Select value={typeId} onValueChange={setTypeId} aria-required="true">
                            <SelectTrigger>
                                <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                            <SelectContent>
                                {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.displayName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
