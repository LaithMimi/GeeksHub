/**
 * RequestDetailSheet Component
 * 
 * A side panel for viewing file request details with:
 * - File metadata display
 * - Notes from uploader
 * - Possible duplicate warning (collapsible)
 * - Sticky approve/reject buttons
 */

import * as React from "react";
import { format } from "date-fns";
import { FileText, Calendar, User, BookOpen, Tag, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RejectDialog } from "./RejectDialog";
import type { FileRequest, RejectReason } from "@/types/domain";

interface RequestDetailSheetProps {
    request: FileRequest | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApprove: (requestId: string) => void;
    onReject: (requestId: string, reason: RejectReason, note?: string) => void;
    isApproving?: boolean;
    isRejecting?: boolean;
}

export function RequestDetailSheet({
    request,
    open,
    onOpenChange,
    onApprove,
    onReject,
    isApproving = false,
    isRejecting = false,
}: RequestDetailSheetProps) {
    const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
    const [duplicateWarningOpen, setDuplicateWarningOpen] = React.useState(false);

    if (!request) return null;

    const isPending = request.status === "pending";
    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "PPp");
        } catch {
            return dateStr;
        }
    };

    const handleApprove = () => {
        onApprove(request.id);
    };

    const handleReject = (reason: RejectReason, note?: string) => {
        onReject(request.id, reason, note);
        setRejectDialogOpen(false);
    };

    const statusBadge = {
        pending: <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>,
        approved: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>,
        rejected: <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>,
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-lg flex flex-col">
                    <SheetHeader>
                        <div className="flex items-center gap-2">
                            {statusBadge[request.status]}
                        </div>
                        <SheetTitle className="text-lg">{request.title}</SheetTitle>
                        <SheetDescription>
                            Request ID: {request.id}
                        </SheetDescription>
                    </SheetHeader>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-6">
                        {/* Metadata */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Tag className="h-4 w-4" />
                                    <span>Type</span>
                                </div>
                                <div className="font-medium">{request.type}</div>

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <BookOpen className="h-4 w-4" />
                                    <span>Course</span>
                                </div>
                                <div className="font-medium">{request.courseId}</div>

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-4 w-4" />
                                    <span>Lecturer</span>
                                </div>
                                <div className="font-medium">{request.lecturerName}</div>

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-4 w-4" />
                                    <span>Submitted by</span>
                                </div>
                                <div className="font-medium">{request.uploaderName || request.userId}</div>

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>Submitted</span>
                                </div>
                                <div className="font-medium">{formatDate(request.createdAt)}</div>
                            </div>
                        </div>

                        <Separator />

                        {/* Notes */}
                        {request.notes && (
                            <>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Notes from Uploader</h4>
                                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                        {request.notes}
                                    </p>
                                </div>
                                <Separator />
                            </>
                        )}

                        {/* File Preview Placeholder */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">File Preview</h4>
                            <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
                                <FileText className="h-12 w-12 mb-2" />
                                <p className="text-sm">Preview not available</p>
                                <p className="text-xs">File preview will be implemented with backend</p>
                            </div>
                        </div>

                        {/* Duplicate Warning (Collapsible) */}
                        {isPending && (
                            <Collapsible open={duplicateWarningOpen} onOpenChange={setDuplicateWarningOpen}>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" className="w-full justify-start gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="text-sm">Possible Duplicate Check</span>
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2">
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                        <p className="font-medium mb-1">Similar files detected:</p>
                                        <p className="text-amber-700">
                                            This feature will check for duplicates when connected to backend.
                                        </p>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* Rejection details (if rejected) */}
                        {request.status === "rejected" && request.rejectionReason && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                                <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                                <p className="text-sm text-red-700">{request.rejectionReason}</p>
                                {request.rejectionNote && (
                                    <p className="text-sm text-red-600 mt-2">{request.rejectionNote}</p>
                                )}
                            </div>
                        )}

                        {/* Approval details (if approved) */}
                        {request.status === "approved" && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                                <p className="text-sm font-medium text-green-800">Approved</p>
                                {request.pointsAwarded && (
                                    <p className="text-sm text-green-700">+{request.pointsAwarded} points awarded</p>
                                )}
                                {request.reviewedAt && (
                                    <p className="text-sm text-green-600">on {formatDate(request.reviewedAt)}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sticky action buttons */}
                    {isPending && (
                        <div className="border-t pt-4 flex gap-2">
                            <Button
                                className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700"
                                onClick={handleApprove}
                                disabled={isApproving || isRejecting}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                {isApproving ? "Approving..." : "Approve"}
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1 gap-1.5"
                                onClick={() => setRejectDialogOpen(true)}
                                disabled={isApproving || isRejecting}
                            >
                                <XCircle className="h-4 w-4" />
                                Reject
                            </Button>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <RejectDialog
                open={rejectDialogOpen}
                onOpenChange={setRejectDialogOpen}
                onConfirm={handleReject}
                isPending={isRejecting}
            />
        </>
    );
}
