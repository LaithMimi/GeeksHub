import { useEffect, useMemo, useState } from "react";

import type { ColumnDef } from "@tanstack/react-table";
import { Users, Pencil, Trash2, Search } from "lucide-react";
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

const ALL = "__all__";

export default function UsersPage() {
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>(ALL);
    const [majorFilter, setMajorFilter] = useState<string>(ALL);
    const debouncedSearch = useDebounce(search, 300);

    const [editing, setEditing] = useState<DirectoryUser | null>(null);
    const [deleting, setDeleting] = useState<DirectoryUser | null>(null);

    const { data: majors = [] } = useMajors();
    const { data: users = [], isLoading } = useDirectoryUsers({
        search: debouncedSearch || undefined,
        role: roleFilter === ALL ? undefined : roleFilter,
        majorId: majorFilter === ALL ? undefined : majorFilter,
    });

    const updateUser = useUpdateUser();
    const deleteUser = useDeleteUser();

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
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All roles</SelectItem>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={majorFilter} onValueChange={setMajorFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Major" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All majors</SelectItem>
                        {majors.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <p className="text-center text-muted-foreground py-12 text-[14px]">Loading users…</p>
            ) : (
                <DataTable columns={columns} data={users} pageSize={15} />
            )}

            <EditUserDialog
                user={editing}
                majors={majors}
                onClose={() => setEditing(null)}
                onSave={(data) => {
                    if (!editing) return;
                    updateUser.mutate(
                        { id: editing.id, data },
                        { onSuccess: () => setEditing(null) },
                    );
                }}
                saving={updateUser.isPending}
            />

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
    user: DirectoryUser | null;
    majors: { id: string; name: string }[];
    onClose: () => void;
    onSave: (data: { name: string; majorId?: string | null; role: Role }) => void;
    saving: boolean;
}) {
    const [name, setName] = useState("");
    const [role, setRole] = useState<Role>("STUDENT");
    const [majorId, setMajorId] = useState<string>(ALL);

    // Re-seed local form state whenever a different user opens the dialog.
    useEffect(() => {
        if (user) {
            setName(user.name);
            setRole(user.role);
            setMajorId(user.majorId ?? ALL);
        }
    }, [user]);

    const handleSave = () => {
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }
        onSave({
            name: name.trim(),
            role,
            // Send explicit null (not undefined) so "None" actually clears the major.
            majorId: majorId === ALL ? null : majorId,
        });
    };

    return (
        <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit user</DialogTitle>
                    <DialogDescription>{user?.email}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="user-name">Name</Label>
                        <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Major</Label>
                        <Select value={majorId} onValueChange={setMajorId}>
                            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
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
