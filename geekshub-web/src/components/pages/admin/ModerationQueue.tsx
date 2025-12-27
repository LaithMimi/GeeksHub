/**
 * ModerationQueue Page
 * 
 * The primary work surface for admins to review file requests.
 * Features:
 * - Status tabs (Pending, Approved, Rejected)
 * - DataTable with row selection
 * - Filters (Major, Type, Search)
 * - Bulk action bar
 * - Request detail sheet on row click
 */

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal, Eye, CheckCircle2, XCircle, ArrowUpDown } from "lucide-react";
import { DataTable, createSelectColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkActionBar } from "@/components/features/BulkActionBar";
import { RejectDialog } from "@/components/features/RejectDialog";
import { RequestDetailSheet } from "@/components/features/RequestDetailSheet";
import { useAllRequests, useApproveRequest, useRejectRequest, useBulkApprove, useBulkReject, useRequestStats } from "@/queries/useRequests";
import type { FileRequest, FileStatus, RejectReason } from "@/types/domain";

export default function ModerationQueue() {
    // State
    const [statusFilter, setStatusFilter] = React.useState<FileStatus>("pending");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedRows, setSelectedRows] = React.useState<FileRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = React.useState<FileRequest | null>(null);
    const [detailSheetOpen, setDetailSheetOpen] = React.useState(false);
    const [bulkRejectOpen, setBulkRejectOpen] = React.useState(false);

    // Queries & Mutations
    const { data: requests, isLoading } = useAllRequests({ status: statusFilter });
    const { data: stats } = useRequestStats();
    const approveMutation = useApproveRequest();
    const rejectMutation = useRejectRequest();
    const bulkApproveMutation = useBulkApprove();
    const bulkRejectMutation = useBulkReject();

    // Filter data by search
    const filteredData = React.useMemo(() => {
        if (!requests) return [];
        if (!searchQuery) return requests;
        const query = searchQuery.toLowerCase();
        return requests.filter(r =>
            r.title.toLowerCase().includes(query) ||
            r.uploaderName?.toLowerCase().includes(query) ||
            r.courseId.toLowerCase().includes(query)
        );
    }, [requests, searchQuery]);

    // Handlers
    const handleRowClick = (request: FileRequest) => {
        setSelectedRequest(request);
        setDetailSheetOpen(true);
    };

    const handleApprove = (requestId: string) => {
        approveMutation.mutate({ requestId }, {
            onSuccess: () => {
                setDetailSheetOpen(false);
            }
        });
    };

    const handleReject = (requestId: string, reason: RejectReason, note?: string) => {
        rejectMutation.mutate({ requestId, reason, note }, {
            onSuccess: () => {
                setDetailSheetOpen(false);
            }
        });
    };

    const handleBulkApprove = () => {
        const ids = selectedRows.map(r => r.id);
        bulkApproveMutation.mutate(ids, {
            onSuccess: () => {
                setSelectedRows([]);
            }
        });
    };

    const handleBulkReject = (reason: RejectReason) => {
        const ids = selectedRows.map(r => r.id);
        bulkRejectMutation.mutate({ requestIds: ids, reason }, {
            onSuccess: () => {
                setSelectedRows([]);
                setBulkRejectOpen(false);
            }
        });
    };

    const handleQuickApprove = (e: React.MouseEvent, request: FileRequest) => {
        e.stopPropagation();
        approveMutation.mutate({ requestId: request.id });
    };

    // Format date helper
    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "MMM d, yyyy h:mm a");
        } catch {
            return dateStr;
        }
    };

    // Table columns
    const columns: ColumnDef<FileRequest>[] = [
        createSelectColumn<FileRequest>(),
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as FileStatus;
                const variants = {
                    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
                    approved: "bg-green-50 text-green-700 border-green-200",
                    rejected: "bg-red-50 text-red-700 border-red-200",
                };
                return (
                    <Badge variant="outline" className={variants[status]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "courseId",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="gap-1 -ml-3"
                >
                    Course
                    <ArrowUpDown className="h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium">{row.getValue("courseId")}</span>,
        },
        {
            accessorKey: "lecturerName",
            header: "Lecturer",
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => <Badge variant="secondary">{row.getValue("type")}</Badge>,
        },
        {
            accessorKey: "title",
            header: "Title",
            cell: ({ row }) => (
                <span className="max-w-[200px] truncate block" title={row.getValue("title")}>
                    {row.getValue("title")}
                </span>
            ),
        },
        {
            accessorKey: "uploaderName",
            header: "Submitted by",
            cell: ({ row }) => row.getValue("uploaderName") || row.original.userId,
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="gap-1 -ml-3"
                >
                    Submitted
                    <ArrowUpDown className="h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => formatDate(row.getValue("createdAt")),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const request = row.original;
                const isPending = request.status === "pending";

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRowClick(request); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                            </DropdownMenuItem>
                            {isPending && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={(e) => handleQuickApprove(e, request)}
                                        className="text-green-600"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); handleRowClick(request); }}
                                        className="text-red-600"
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Reject...
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Moderation Queue</h1>
                <p className="text-muted-foreground">
                    Review and approve file requests from students.
                </p>
            </div>

            {/* Status Tabs */}
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as FileStatus)}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <TabsList>
                        <TabsTrigger value="pending" className="gap-2">
                            Pending
                            {stats?.pending ? (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                    {stats.pending}
                                </Badge>
                            ) : null}
                        </TabsTrigger>
                        <TabsTrigger value="approved">Approved</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    </TabsList>

                    {/* Search */}
                    <Input
                        placeholder="Search by title, user, or course..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
            </Tabs>

            {/* Table */}
            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={filteredData}
                    onRowClick={handleRowClick}
                    onSelectionChange={setSelectedRows}
                />
            )}

            {/* Bulk Action Bar */}
            <BulkActionBar
                selectedCount={selectedRows.length}
                onApprove={handleBulkApprove}
                onReject={() => setBulkRejectOpen(true)}
                onClear={() => setSelectedRows([])}
                isApproving={bulkApproveMutation.isPending}
                isRejecting={bulkRejectMutation.isPending}
            />

            {/* Request Detail Sheet */}
            <RequestDetailSheet
                request={selectedRequest}
                open={detailSheetOpen}
                onOpenChange={setDetailSheetOpen}
                onApprove={handleApprove}
                onReject={handleReject}
                isApproving={approveMutation.isPending}
                isRejecting={rejectMutation.isPending}
            />

            {/* Bulk Reject Dialog */}
            <RejectDialog
                open={bulkRejectOpen}
                onOpenChange={setBulkRejectOpen}
                onConfirm={handleBulkReject}
                title="Bulk Reject"
                isBulk
                selectedCount={selectedRows.length}
                isPending={bulkRejectMutation.isPending}
            />
        </div>
    );
}
