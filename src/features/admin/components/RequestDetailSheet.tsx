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
import { formatDate } from "@/lib/formatDate";
import { FileText, Calendar, User, BookOpen, Tag, AlertTriangle, CheckCircle2, XCircle, Maximize2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();
import { useRequestPreviewUrl } from "@/features/files/hooks/useRequests";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
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
    const { data: previewData, isLoading: isLoadingPreview } = useRequestPreviewUrl(open && request ? request.id : undefined);

    const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
    const [duplicateWarningOpen, setDuplicateWarningOpen] = React.useState(false);
    const [fullscreenOpen, setFullscreenOpen] = React.useState(false);

    // Fullscreen viewer state
    const [numPages, setNumPages] = React.useState<number | null>(null);
    const [pageNumber, setPageNumber] = React.useState(1);
    const [scale, setScale] = React.useState(1.0);
    const [rotation, setRotation] = React.useState(0);

    const handleFullscreenOpen = () => {
        setPageNumber(1);
        setScale(1.0);
        setRotation(0);
        setNumPages(null);
        setFullscreenOpen(true);
    };

    if (!request) return null;

    const isPending = request.status === "pending";

    const handleApprove = () => {
        onApprove(request.id);
    };

    const handleReject = (reason: RejectReason, note?: string) => {
        onReject(request.id, reason, note);
        setRejectDialogOpen(false);
    };

    const statusBadge = {
        pending: <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">Pending</Badge>,
        approved: <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Approved</Badge>,
        rejected: <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">Rejected</Badge>,
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
                                <div className="font-medium">{request.courseName ?? request.courseId}</div>

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
                                <div className="font-medium">{formatDate(request.createdAt, "PPp")}</div>
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

                        {/* File Preview */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">File Preview</h4>
                                {previewData?.url && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                        onClick={handleFullscreenOpen}
                                    >
                                        <Maximize2 className="h-3.5 w-3.5" />
                                        Full Screen
                                    </Button>
                                )}
                            </div>
                            {isLoadingPreview ? (
                                <div className="border-2 rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
                                    <p className="text-sm">Fetching secure preview link...</p>
                                </div>
                            ) : previewData?.url ? (
                                <div
                                    className="border-2 rounded-lg bg-black/20 flex flex-col items-center justify-center overflow-auto max-h-[400px] p-4 cursor-pointer hover:border-blue-500/40 transition-colors"
                                    onClick={handleFullscreenOpen}
                                    title="Click to view full screen"
                                >
                                    <Document
                                        file={previewData.url}
                                        loading={<p className="text-sm text-muted-foreground py-4">Loading PDF...</p>}
                                        error={<p className="text-sm text-red-400 py-4">Failed to load preview. Ensure the file stream is valid.</p>}
                                    >
                                        <Page
                                            pageNumber={1}
                                            width={400}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            loading={<p className="text-sm text-muted-foreground py-4">Rendering page...</p>}
                                            className="shadow-xl"
                                        />
                                    </Document>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
                                    <FileText className="h-12 w-12 mb-2" />
                                    <p className="text-sm">No preview available</p>
                                </div>
                            )}
                        </div>

                        {/* Duplicate Warning (Collapsible) */}
                        {isPending && (
                            <Collapsible open={duplicateWarningOpen} onOpenChange={setDuplicateWarningOpen}>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" className="w-full justify-start gap-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="text-sm">Possible Duplicate Check</span>
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2">
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-300">
                                        <p className="font-medium mb-1">Similar files detected:</p>
                                        <p className="text-amber-400">
                                            This feature will check for duplicates when connected to backend.
                                        </p>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* Rejection details (if rejected) */}
                        {request.status === "rejected" && request.rejectionReason && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
                                <p className="text-sm font-medium text-red-300">Rejection Reason</p>
                                <p className="text-sm text-red-400">{request.rejectionReason}</p>
                                {request.rejectionNote && (
                                    <p className="text-sm text-red-400/80 mt-2">{request.rejectionNote}</p>
                                )}
                            </div>
                        )}

                        {/* Approval details (if approved) */}
                        {request.status === "approved" && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1">
                                <p className="text-sm font-medium text-emerald-300">Approved</p>
                                {request.pointsAwarded && (
                                    <p className="text-sm text-emerald-400">+{request.pointsAwarded} points awarded</p>
                                )}
                                {request.reviewedAt && (
                                    <p className="text-sm text-emerald-400/80">on {formatDate(request.reviewedAt, "PPp")}</p>
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

            {/* Fullscreen PDF Preview */}
            {previewData?.url && (
                <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
                    <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 flex flex-col bg-[#1a1a2e] border-white/10">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
                            <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-white/40" />
                                <span className="text-sm font-medium text-white/80 truncate max-w-[300px]">
                                    {request.title}
                                </span>
                            </div>

                            <div className="flex items-center gap-1 pr-8">
                                {/* Page navigation */}
                                <button
                                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                                    disabled={pageNumber <= 1}
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-[13px] text-white/60 min-w-[80px] text-center tabular-nums">
                                    {pageNumber} / {numPages ?? '—'}
                                </span>
                                <button
                                    onClick={() => setPageNumber(p => Math.min(numPages ?? 1, p + 1))}
                                    disabled={pageNumber >= (numPages ?? 1)}
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>

                                <div className="w-px h-4 bg-white/[0.08] mx-1" />

                                {/* Zoom */}
                                <button
                                    onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))}
                                    disabled={scale <= 0.5}
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </button>
                                <span className="text-[13px] text-white/60 min-w-[44px] text-center tabular-nums">
                                    {Math.round(scale * 100)}%
                                </span>
                                <button
                                    onClick={() => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)))}
                                    disabled={scale >= 2.5}
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </button>

                                <div className="w-px h-4 bg-white/[0.08] mx-1" />

                                {/* Rotate */}
                                <button
                                    onClick={() => setRotation(r => (r + 90) % 360)}
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                                >
                                    <RotateCw className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* PDF canvas */}
                        <div className="flex-1 overflow-auto flex justify-center py-6 px-4">
                            <Document
                                file={previewData.url}
                                onLoadSuccess={({ numPages: n }) => { setNumPages(n); }}
                                loading={
                                    <div className="flex items-center gap-3 text-white/40 mt-20">
                                        <span className="text-[14px]">Loading PDF...</span>
                                    </div>
                                }
                                error={
                                    <div className="flex flex-col items-center gap-2 text-red-400 mt-20">
                                        <FileText className="h-8 w-8" />
                                        <p className="text-sm">Failed to load PDF</p>
                                    </div>
                                }
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    scale={scale}
                                    rotate={rotation}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    className="shadow-2xl shadow-black/50 rounded-sm"
                                    loading={
                                        <div className="flex items-center justify-center h-96 w-full">
                                            <span className="text-sm text-white/40">Rendering page...</span>
                                        </div>
                                    }
                                />
                            </Document>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            <RejectDialog
                open={rejectDialogOpen}
                onOpenChange={setRejectDialogOpen}
                onConfirm={handleReject}
                isPending={isRejecting}
            />
        </>
    );
}
