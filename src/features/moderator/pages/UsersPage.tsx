import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Users, Pencil, Trash2, Search, GraduationCap, X } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
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
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useMajors } from "@/features/courses/hooks/useCatalog";
import {
    useDirectoryUsers, useUpdateUser, useDeleteUser,
} from "@/features/directory/hooks/useDirectory";
import type { DirectoryUser } from "@/features/directory/api/directoryService";
import type { Role } from "@/types/domain";

const ROLES: Role[] = ["STUDENT", "MODERATOR", "ADMIN"];

const roleBadgeClass: Record<Role, string> = {
    STUDENT: "border-blue-500/30 text-blue-300",
    MODERATOR: "border-amber-500/30 text-amber-300",
    ADMIN: "border-emerald-500/30 text-emerald-300",
};

// Human-friendly labels + accent dots so the filters read cleanly
// instead of raw uppercase enum values.
const roleLabel: Record<Role, string> = {
    STUDENT: "Student",
    MODERATOR: "Moderator",
    ADMIN: "Admin",
};

const roleDot: Record<Role, string> = {
    STUDENT: "bg-blue-400",
    MODERATOR: "bg-amber-400",
    ADMIN: "bg-emerald-400",
};

const ALL = "__all__";

export default function UsersPage() {
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>(ALL);
    const [majorFilter, setMajorFilter] = useState<string>(ALL);
    const debouncedSearch = useDebounce(search, 300);

    const [editing, setEditing] = useState<DirectoryUser | null>(null);
    const [deleting, setDeleting] = useState<DirectoryUser | null>(null);

    const { data: majors = [] } = useMajors();
    const { data: users = [], isLoading, error } = useDirectoryUsers({
        search: debouncedSearch || undefined,
        role: roleFilter === ALL ? undefined : roleFilter,
        majorId: majorFilter === ALL ? undefined : majorFilter,
    });

    const updateUser = useUpdateUser();
    const deleteUser = useDeleteUser();

    const hasActiveFilters = !!search || roleFilter !== ALL || majorFilter !== ALL;
    const clearFilters = () => {
        setSearch("");
        setRoleFilter(ALL);
        setMajorFilter(ALL);
    };

    const columns = useMemo<ColumnDef<DirectoryUser>[]>(() => [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "email", header: "Email" },
        {
            accessorKey: "role",
            header: "Role",
            cell: ({ row }) => {
                const role = row.original.role;
                return (
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${roleBadgeClass[role]}`}>
                        {role}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "majorName",
            header: "Major",
            cell: ({ row }) => row.original.majorName ?? <span className="text-muted-foreground/50">—</span>,
        },
        { accessorKey: "totalPoints", header: "XP" },
        {
            accessorKey: "createdAt",
            header: "Joined",
            cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setEditing(row.original); }}
                        aria-label="Edit user"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={(e) => { e.stopPropagation(); setDeleting(row.original); }}
                        aria-label="Delete user"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ], []);

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="py-4 mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <Users className="h-5 w-5 text-amber-400" />
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">
                        Users
                    </h1>
                </div>
                <p className="text-[13px] text-muted-foreground ms-8">
                    Search, filter, edit roles, and remove accounts.
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] h-10">
                        <SelectValue>
                            <span className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${roleFilter === ALL ? "bg-muted-foreground/40" : roleDot[roleFilter as Role]}`} />
                                {roleFilter === ALL ? "All roles" : roleLabel[roleFilter as Role]}
                            </span>
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                                All roles
                            </span>
                        </SelectItem>
                        {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                                <span className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${roleDot[r]}`} />
                                    {roleLabel[r]}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={majorFilter} onValueChange={setMajorFilter}>
                    <SelectTrigger className="w-full sm:w-[220px] h-10">
                        <SelectValue>
                            <span className="flex items-center gap-2 min-w-0">
                                <GraduationCap className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                <span className="truncate">
                                    {majorFilter === ALL
                                        ? "All majors"
                                        : majors.find((m) => m.id === majorFilter)?.name ?? "All majors"}
                                </span>
                            </span>
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All majors</SelectItem>
                        {majors.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Result count + active-filter reset */}
            <div className="flex items-center justify-between gap-2 mb-4 px-0.5 min-h-[28px]">
                <p className="text-[12px] text-muted-foreground">
                    {isLoading
                        ? "Loading…"
                        : `${users.length} ${users.length === 1 ? "user" : "users"}${hasActiveFilters ? " matched" : ""}`}
                </p>
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-7 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear filters
                    </Button>
                )}
            </div>

            {isLoading ? (
                <p className="text-center text-muted-foreground py-12 text-[14px]">Loading users…</p>
            ) : error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-6 text-center">
                    <p className="text-[14px] font-medium text-red-300">Couldn’t load users</p>
                    <p className="text-[12px] text-muted-foreground mt-1">
                        {error instanceof Error ? error.message : "Request failed"} — is the backend running with the moderator routes?
                    </p>
                </div>
            ) : (
                <DataTable columns={columns} data={users} pageSize={15} />
            )}

            {editing && (
                <EditUserDialog
                    key={editing.id}
                    user={editing}
                    majors={majors}
                    onClose={() => setEditing(null)}
                    onSave={(data) =>
                        updateUser.mutate(
                            { id: editing.id, data },
                            { onSuccess: () => setEditing(null) },
                        )
                    }
                    saving={updateUser.isPending}
                />
            )}

            <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete user?</DialogTitle>
                        <DialogDescription>
                            This permanently removes <strong>{deleting?.name}</strong> ({deleting?.email}).
                            Accounts with uploads or activity cannot be deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={deleteUser.isPending}
                            onClick={() => {
                                if (!deleting) return;
                                deleteUser.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
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
// Edit dialog
// ---------------------------------------------------------------------------

function EditUserDialog({
    user, majors, onClose, onSave, saving,
}: {
    user: DirectoryUser;
    majors: { id: string; name: string }[];
    onClose: () => void;
    onSave: (data: { name: string; majorId?: string; role: Role }) => void;
    saving: boolean;
}) {
    // Mounted fresh per user (parent passes key={user.id}), so init directly from props.
    const [name, setName] = useState(user.name);
    const [role, setRole] = useState<Role>(user.role);
    const [majorId, setMajorId] = useState<string>(user.majorId ?? ALL);

    const handleSave = () => {
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }
        onSave({
            name: name.trim(),
            role,
            majorId: majorId === ALL ? undefined : majorId,
        });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit user</DialogTitle>
                    <DialogDescription>{user.email}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="user-name">Name</Label>
                        <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                            <SelectTrigger>
                                <SelectValue>
                                    <span className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${roleDot[role]}`} />
                                        {roleLabel[role]}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        <span className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${roleDot[r]}`} />
                                            {roleLabel[r]}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Major</Label>
                        <Select value={majorId} onValueChange={setMajorId}>
                            <SelectTrigger>
                                <SelectValue>
                                    <span className="truncate">
                                        {majorId === ALL
                                            ? "None"
                                            : majors.find((m) => m.id === majorId)?.name ?? "None"}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>None</SelectItem>
                                {majors.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
