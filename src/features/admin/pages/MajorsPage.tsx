import { useMemo, useState, useEffect } from "react";
import { Layers, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/directory/components/Avatar";
import {
    useDirectoryMajors, useCreateMajor, useUpdateMajor, useDeleteMajor,
} from "@/features/directory/hooks/useDirectory";
import type { MajorWithCount } from "@/features/directory/api/directoryService";

const SKELETON_COUNT = 7;

export default function MajorsPage() {
    const [search, setSearch] = useState("");

    // Dialog states
    const [creating, setCreating] = useState(false);
    const [renaming, setRenaming] = useState<MajorWithCount | null>(null);
    const [deleting, setDeleting] = useState<MajorWithCount | null>(null);

    const { data: majors = [], isLoading, isError, error } = useDirectoryMajors();

    useEffect(() => {
        if (isError && error) {
            toast.error("Failed to fetch majors: " + (error as Error).message);
        }
    }, [isError, error]);

    const filtered = useMemo(
        () => majors.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase())),
        [majors, search],
    );

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="py-4 mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Layers className="h-5 w-5 text-blue-400" />
                        <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                            Majors
                        </h1>
                        {!isLoading && (
                            <span className="text-[12px] font-medium text-muted-foreground/70 bg-foreground/5 rounded-full px-2.5 py-0.5">
                                {majors.length}
                            </span>
                        )}
                    </div>
                    <p className="text-[13px] text-muted-foreground ms-8">
                        Add the academic majors that courses and students belong to.
                    </p>
                </div>
                <Button onClick={() => setCreating(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> New Major
                </Button>
            </div>

            <div className="max-w-2xl liquid-glass-subtle rounded-2xl p-2.5 flex flex-col">
                <div className="relative mb-2.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                        placeholder="Search majors…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-10 bg-background/40"
                    />
                </div>

                <div className="space-y-1 overflow-auto pr-0.5 max-h-[calc(100vh-260px)] min-h-[200px]">
                    {isLoading ? (
                        Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-3.5 w-2/3" />
                                    <Skeleton className="h-2.5 w-1/3" />
                                </div>
                            </div>
                        ))
                    ) : majors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                            <Layers className="h-9 w-9 text-muted-foreground/30 mb-3" />
                            <p className="text-[13px] text-muted-foreground mb-3">No majors yet.</p>
                            <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> Add the first one
                            </Button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-muted-foreground/60 py-10 text-[13px]">
                            No majors match “{search}”.
                        </p>
                    ) : (
                        filtered.map((major) => (
                            <div
                                key={major.id}
                                className="group flex items-center gap-3 px-2.5 py-2 rounded-xl border border-transparent hover:bg-foreground/5 transition-all"
                            >
                                <Avatar name={major.name} />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-[14px] text-foreground/90">{major.name}</p>
                                    <p className="text-[11px] text-muted-foreground/60">
                                        {major.courseCount} {major.courseCount === 1 ? "course" : "courses"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setRenaming(major)}
                                        className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors"
                                        aria-label={`Rename ${major.name}`}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeleting(major)}
                                        className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        aria-label={`Delete ${major.name}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <CreateMajorDialog open={creating} onOpenChange={setCreating} />
            <RenameMajorDialog major={renaming} onClose={() => setRenaming(null)} />
            <DeleteMajorDialog major={deleting} onClose={() => setDeleting(null)} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Dialog Components
// ---------------------------------------------------------------------------

function CreateMajorDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [newName, setNewName] = useState("");
    const createMajor = useCreateMajor();

    useEffect(() => {
        if (open) setNewName("");
    }, [open]);

    const handleCreate = () => {
        const name = newName.trim();
        if (!name) { toast.error("Name is required"); return; }
        createMajor.mutate(name, { onSuccess: () => onOpenChange(false) });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New major</DialogTitle>
                    <DialogDescription>Add a major to the directory. A URL slug is generated automatically.</DialogDescription>
                </DialogHeader>
                <Input
                    autoFocus
                    placeholder="Computer Science"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={createMajor.isPending}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RenameMajorDialog({
    major,
    onClose,
}: {
    major: MajorWithCount | null;
    onClose: () => void;
}) {
    const [renameValue, setRenameValue] = useState("");
    const updateMajor = useUpdateMajor();

    useEffect(() => {
        if (major) setRenameValue(major.name);
    }, [major]);

    const handleRename = () => {
        if (!major) return;
        const name = renameValue.trim();
        if (!name) { toast.error("Name is required"); return; }
        updateMajor.mutate({ id: major.id, name }, { onSuccess: onClose });
    };

    return (
        <Dialog open={!!major} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename major</DialogTitle>
                    <DialogDescription className="sr-only">Rename the major</DialogDescription>
                </DialogHeader>
                <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleRename} disabled={updateMajor.isPending}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteMajorDialog({
    major,
    onClose,
}: {
    major: MajorWithCount | null;
    onClose: () => void;
}) {
    const deleteMajor = useDeleteMajor();

    return (
        <Dialog open={!!major} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete major?</DialogTitle>
                    <DialogDescription>
                        This removes <strong>{major?.name}</strong>. Majors that still have courses
                        or students assigned cannot be deleted.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="destructive"
                        disabled={deleteMajor.isPending}
                        onClick={() => {
                            if (!major) return;
                            deleteMajor.mutate(major.id, { onSuccess: onClose });
                        }}
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
