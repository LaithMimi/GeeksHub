import { useState } from "react";
import {
    FileText, Search, AlertCircle, CheckCircle, Clock,
    XCircle, ChevronLeft, Zap, Loader2, Plus, Trash2
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMyRequests, useWithdrawRequest } from "@/queries/useRequests";
import RequestFileModal from "@/components/features/RequestFileModal";
import { formatDistanceToNow } from "date-fns";
import type { FileRequest } from "@/types/domain";
import { toast } from "sonner";

export default function UserUploads() {
    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Backend extracts user identity from the JWT cookie — no userId param needed
    const { data: userRequests, isLoading, isError } = useMyRequests();
    const { mutate: withdrawRequest, isPending: isDeleting } = useWithdrawRequest();

    // Normalize status to lowercase to survive the backend UPPERCASE → lowercase migration
    const normalizeStatus = (status: string) => status.toLowerCase();

    const getStatusIcon = (status: string) => {
        switch (normalizeStatus(status)) {
            case "approved": return <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />;
            case "rejected": return <XCircle className="h-3.5 w-3.5 text-red-400" />;
            default: return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
        }
    };

    const getStatusBg = (status: string) => {
        switch (normalizeStatus(status)) {
            case "approved": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
            case "rejected": return "bg-red-500/15 text-red-400 border-red-500/20";
            default: return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
        }
    };

    const handleDelete = (request: FileRequest) => {
        // userId is NOT sent — backend validates ownership via JWT
        withdrawRequest(
            { requestId: request.id },
            {
                onSuccess: () => {
                    setDeleteConfirmId(null);
                    toast.success(`"${request.title}" removed`);
                },
                onError: () => {
                    toast.error("Failed to remove request. Try again.");
                },
            }
        );
    };

    if (isLoading) {
        return (
            <div className="h-[50vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
        );
    }

    if (isError || !userRequests) {
        return (
            <div className="h-[50vh] flex flex-col items-center justify-center">
                <div className="glass-card p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
                    <p className="text-white/60 mb-3">Failed to load your uploads.</p>
                    <Button variant="link" onClick={() => window.location.reload()} className="text-purple-400">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    // Search across title, course name (with UUID fallback), and lecturer name
    const filteredRequests = searchQuery.trim()
        ? userRequests.filter((r) => {
            const q = searchQuery.toLowerCase();
            return (
                r.title.toLowerCase().includes(q) ||
                (r.course_name ?? r.course_id ?? "").toLowerCase().includes(q) ||
                (r.lecturer_name ?? "").toLowerCase().includes(q)
            );
        })
        : userRequests;

    // Backend field name is points_awarded (snake_case) — standardized in the backend audit
    const totalPoints = userRequests.reduce(
        (acc, curr) => acc + (curr.points_awarded ?? 0),
        0
    );

    return (
        <div className="animate-fade-in space-y-8">

            {/* Header */}
            <div className="space-y-4">
                <Link
                    to="/"
                    className="text-white/40 hover:text-white/70 flex items-center gap-2 text-[13px] w-fit transition-colors"
                >
                    <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                    Back to Dashboard
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[32px] font-display font-bold text-white tracking-[-0.03em]">
                            Your Contributions
                        </h1>
                        <p className="text-white/40 mt-1 text-[14px]">
                            Track your impact and file request status.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsRequestOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-[13px] font-display font-semibold glow-purple-soft hover:opacity-90 transition-opacity"
                    >
                        <Plus className="h-4 w-4" />
                        Submit New File
                    </button>
                </div>
                <RequestFileModal open={isRequestOpen} onOpenChange={setIsRequestOpen} />
            </div>

            {/* Impact Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Points */}
                <div className="liquid-glass rounded-2xl p-5 border-purple-500/20 glow-purple-soft">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] text-purple-300 font-medium">Community Score</span>
                        <Zap className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="text-[28px] font-display font-bold text-white">{totalPoints}</div>
                    <p className="text-[11px] text-white/35 mt-0.5">Total impact points</p>
                </div>

                {/* Status breakdown — normalizeStatus guards against uppercase from backend */}
                {[
                    { label: "Approved", status: "approved", icon: CheckCircle },
                    { label: "Pending Review", status: "pending", icon: Clock },
                    { label: "Rejected", status: "rejected", icon: XCircle },
                ].map(({ label, status, icon: Icon }) => (
                    <div key={label} className="liquid-glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[12px] text-white/45 font-medium">{label}</span>
                            <Icon className="h-4 w-4 text-white/25" />
                        </div>
                        <div className="text-[28px] font-display font-bold text-white">
                            {userRequests.filter((r) => normalizeStatus(r.status) === status).length}
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                        placeholder="Search by title, course, or lecturer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-10 rounded-xl liquid-glass-subtle ps-10 pe-4 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-purple-500/40 transition-colors"
                    />
                </div>
            </div>

            {/* List */}
            <div className="liquid-glass rounded-2xl overflow-hidden">
                {filteredRequests.length === 0 ? (
                    <div className="text-center py-16 text-white/30">
                        <FileText className="mx-auto h-10 w-10 opacity-30 mb-3" />
                        <p className="text-[14px]">
                            {searchQuery.trim() ? "No uploads match your search." : "No uploads yet."}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.06]">
                        {filteredRequests.map((file) => {
                            const status = normalizeStatus(file.status);
                            return (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between px-6 py-5 hover:bg-white/[0.03] transition-colors gap-4"
                                >
                                    {/* Left: icon + info */}
                                    <div className="flex items-start gap-4">
                                        <div className="mt-0.5 w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                            <FileText className="h-4.5 w-4.5 text-purple-400" />
                                        </div>
                                        <div className="space-y-1.5 min-w-0">
                                            {/* Title + status badge + points badge */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-display font-semibold text-white text-[14px]">
                                                    {file.title}
                                                </span>
                                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${getStatusBg(status)}`}>
                                                    {getStatusIcon(status)}
                                                    <span className="capitalize">{status}</span>
                                                </span>
                                                {/* Points badge — only shown when approved and points exist */}
                                                {status === "approved" && file.points_awarded ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-purple-400 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                                                        <Zap className="h-3 w-3" />
                                                        +{file.points_awarded} pts
                                                    </span>
                                                ) : null}
                                            </div>

                                            {/* Subtitle: course name (falls back to ID if backend hasn't enriched yet) + timestamp */}
                                            <p className="text-[12px] text-white/35">
                                                {file.course_name
                                                    ? file.course_name
                                                    : file.course_id
                                                }
                                                {" • "}
                                                {formatDistanceToNow(
                                                    new Date(file.created_at ?? new Date()),
                                                    { addSuffix: true }
                                                )}
                                            </p>

                                            {/* Rejection reason — backend field is admin_note */}
                                            {status === "rejected" && file.admin_note && (
                                                <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/15 w-fit mt-1">
                                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                                    <span>{file.admin_note}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: action */}
                                    <div className="shrink-0">
                                        {status === "rejected" ? (
                                            deleteConfirmId === file.id ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleDelete(file)}
                                                        disabled={isDeleting}
                                                        className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                                                    >
                                                        {isDeleting
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <Trash2 className="h-3 w-3" />
                                                        }
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirmId(null)}
                                                        className="text-[12px] px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDeleteConfirmId(file.id)}
                                                    className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            )
                                        ) : status === "approved" && file.material_id ? (
                                            // material_id is the UUID of the approved Material row
                                            // backend must return this on the enriched FileRequest response
                                            <Link
                                                to={`/courses/${file.course_id}/files/${file.material_id}`}
                                                className="text-[12px] px-3 py-1.5 rounded-lg border border-white/[0.1] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
                                            >
                                                View
                                            </Link>
                                        ) : (
                                            <span className="text-[12px] px-3 py-1.5 rounded-lg border border-white/[0.06] text-white/20 cursor-not-allowed">
                                                {status === "pending" ? "Pending" : "View"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}