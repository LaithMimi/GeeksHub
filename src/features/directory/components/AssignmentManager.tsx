import { useState, type ReactNode } from "react";
import { Plus, X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AssignmentManagerProps<A, P> {
    /** Heading above the assigned chips, e.g. "Assigned courses". */
    assignedHeading: string;
    /** Heading above the add picker, e.g. "Assign a course". */
    addHeading: string;
    searchPlaceholder: string;
    assigned: A[];
    /** Full candidate pool; the component removes already-assigned items and applies search. */
    pool: P[];
    isLoading: boolean;
    assigning: boolean;
    assignedId: (item: A) => string;
    poolId: (item: P) => string;
    renderAssigned: (item: A) => ReactNode;
    renderPoolItem: (item: P) => ReactNode;
    /** Text searched against for an item in the pool. */
    poolSearchText: (item: P) => string;
    onAdd: (id: string) => void;
    onRemove: (id: string) => void;
    emptyAssigned: string;
    /** Shown when the pool is entirely empty (nothing exists to assign). */
    emptyPool: string;
}

/**
 * Two-section assignment editor: removable chips for currently-assigned items
 * plus a searchable picker of the remaining pool. Shared by the Lecturers and
 * Courses pages (assignment is bidirectional). The search narrows the pool, so
 * there is no arbitrary truncation — a count is shown instead.
 */
export function AssignmentManager<A, P>({
    assignedHeading, addHeading, searchPlaceholder,
    assigned, pool, isLoading, assigning,
    assignedId, poolId, renderAssigned, renderPoolItem, poolSearchText,
    onAdd, onRemove, emptyAssigned, emptyPool,
}: AssignmentManagerProps<A, P>) {
    const [search, setSearch] = useState("");

    const assignedIds = new Set(assigned.map(assignedId));
    const query = search.trim().toLowerCase();
    const available = pool
        .filter((p) => !assignedIds.has(poolId(p)))
        .filter((p) => poolSearchText(p).toLowerCase().includes(query));

    return (
        <div className="space-y-6">
            {/* Assigned */}
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    {assignedHeading}
                    {!isLoading && assigned.length > 0 && (
                        <span className="ml-1.5 text-muted-foreground/50">({assigned.length})</span>
                    )}
                </p>
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : assigned.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-center">
                        <p className="text-[13px] text-muted-foreground/70">{emptyAssigned}</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {assigned.map((item) => (
                            <span
                                key={assignedId(item)}
                                className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[13px] text-blue-300"
                            >
                                {renderAssigned(item)}
                                <button
                                    onClick={() => onRemove(assignedId(item))}
                                    className="p-0.5 rounded-md text-blue-300/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    aria-label="Remove"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Add */}
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    {addHeading}
                </p>
                <div className="relative mb-3 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-9"
                    />
                </div>
                <div className="flex flex-wrap gap-2 max-h-[240px] overflow-auto pr-0.5">
                    {pool.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground/50">{emptyPool}</p>
                    ) : available.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground/50">
                            {query ? "No matches." : "Everything is already assigned."}
                        </p>
                    ) : (
                        available.map((item) => (
                            <button
                                key={poolId(item)}
                                onClick={() => onAdd(poolId(item))}
                                disabled={assigning}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 text-[13px] text-muted-foreground hover:text-foreground hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors disabled:opacity-50"
                            >
                                <Plus className="h-3 w-3 shrink-0" />
                                {renderPoolItem(item)}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
