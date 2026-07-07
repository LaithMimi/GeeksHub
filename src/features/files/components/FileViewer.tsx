import { useState, useCallback, useRef, useEffect } from 'react';
import type { WheelEvent as ReactWheelEvent } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    Loader2, AlertCircle, Download, FileText,
    ExternalLink, ChevronLeft, ChevronRight,
    ZoomIn, ZoomOut, RotateCw,
} from "lucide-react";
import { SelectionPopup } from "@/components/ui/selection-popup";
import { useParams } from 'react-router-dom';
import { useFile, useAddRecentFile } from '@/features/files/hooks/useFiles';
import { Button } from '@/components/ui/button';
import { useViewerSession } from '@/features/files/hooks/useViewerSession';
import { toast } from 'sonner';
import CourseCompletionCelebration from '@/features/gamification/components/CourseCompletionCelebration';
import { apiFetch } from '@/lib/apiClient';
import { Skeleton } from "@/components/ui/skeleton";

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs', // path to the worker file inside node_modules
    import.meta.url, // resolved relative to THIS file's URL
).toString();

// Malformed-but-recoverable PDFs (e.g. scanner output with broken xref tables or
// binary bytes in hex strings) spam the console with non-actionable warnings like
// "getHexString - ignoring invalid character". pdf.js still renders them fine, so
// drop its log level to errors only. Module-level constant keeps the reference
// stable — react-pdf reloads the document if `options` changes identity each render.
const PDF_OPTIONS = { verbosity: pdfjs.VerbosityLevel.ERRORS } as const;

function isPdf(title: string, downloadUrl?: string): boolean {
    if (title.toLowerCase().endsWith('.pdf')) return true;
    if (downloadUrl) {
        try {
            const url = new URL(downloadUrl);
            return url.pathname.toLowerCase().endsWith('.pdf');
        } catch {
            return downloadUrl.toLowerCase().includes('.pdf');
        }
    }
    return true; // We only allow PDF uploads via the backend
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileViewerProps {
    onTextSelect?: (text: string) => void;
    onPinToNotes?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileViewerSkeleton() {
    return (
        <div className="h-full flex flex-col bg-background">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-foreground/5 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-lg bg-foreground/5" />
                    <Skeleton className="h-4 w-16 bg-foreground/5" />
                    <Skeleton className="h-7 w-7 rounded-lg bg-foreground/5" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-lg bg-foreground/5" />
                    <Skeleton className="h-4 w-8 bg-foreground/5" />
                    <Skeleton className="h-7 w-7 rounded-lg bg-foreground/5" />
                    <div className="w-px h-4 bg-foreground/10 mx-1" />
                    <Skeleton className="h-7 w-7 rounded-lg bg-foreground/5" />
                    <div className="w-px h-4 bg-foreground/10 mx-1" />
                    <Skeleton className="h-7 w-7 rounded-lg bg-foreground/5" />
                </div>
            </div>
            <div className="flex-1 flex justify-center py-6 px-4 overflow-hidden">
                <Skeleton className="h-full w-full max-w-3xl rounded-sm bg-foreground/5 shadow-2xl" />
            </div>
        </div>
    );
}

export default function FileViewer({ onTextSelect, onPinToNotes }: FileViewerProps) {
    const { courseId, fileId } = useParams();
    const { data: file, isLoading, isError } = useFile(fileId || "");
    const { mutate: addToRecent } = useAddRecentFile();

    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [pdfError, setPdfError] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

    const fileTitle = file?.title;
    const fileDownloadUrl = file?.downloadUrl;
    // Clear the previous file's blob URL/error as soon as the route changes, before
    // the new file's metadata resolves — otherwise <Document> renders the old,
    // already-revoked object URL and flashes a spurious "Could not render PDF".
    useEffect(() => {
        setPdfBlobUrl(null);
        setPdfError(false);
    }, [fileId]);

    useEffect(() => {
        if (!fileId || !fileTitle || !isPdf(fileTitle, fileDownloadUrl)) return;
        let objectUrl: string;
        apiFetch(`/files/${encodeURIComponent(fileId)}/stream`)
            .then(res => res.blob())
            .then(blob => {
                objectUrl = URL.createObjectURL(blob);
                setPdfBlobUrl(objectUrl);
            })
            .catch(() => setPdfError(true));
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [fileId, fileTitle, fileDownloadUrl]);

    const containerRef = useRef<HTMLDivElement>(null);

    // ── Recent files ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (file && courseId) {
            addToRecent({ id: file.id });
        }
    }, [file, courseId, addToRecent]);

    // ── Gamification Viewer Session ───────────────────────────────────────────
    const {
        completed,
        pointsAwarded,
        courseCompleted,
        motivationalQuote,
    } = useViewerSession(fileId || "", pageNumber);

    const [showCelebration, setShowCelebration] = useState(false);

    // Toast for individual file completion
    useEffect(() => {
        if (completed && pointsAwarded > 0 && !courseCompleted) {
            toast.success("File Completed!", {
                description: `Great job reading this material. +${pointsAwarded} Points!`,
            });
        }
    }, [completed, pointsAwarded, courseCompleted]);

    // Celebration modal for course completion
    useEffect(() => {
        if (courseCompleted) {
            setShowCelebration(true);
        }
    }, [courseCompleted]);


    // ── PDF controls ──────────────────────────────────────────────────────────
    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
        setPdfError(false);
    }, []);

    const onDocumentLoadError = useCallback(() => setPdfError(true), []);

    const goToPrevPage = () => setPageNumber(p => Math.max(1, p - 1));
    const goToNextPage = () => setPageNumber(p => Math.min(numPages ?? 1, p + 1));
    const zoomIn = () => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)));
    const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)));
    const rotate = () => setRotation(r => (r + 90) % 360);

    // Scroll-to-turn-page: when the page fits the viewport, any wheel scroll turns
    // it immediately; when zoomed in and the content overflows, normal scrolling
    // happens first and only crossing the top/bottom edge flips the page. The
    // cooldown ref (not state) stops one scroll gesture from skipping several pages.
    const wheelCooldownRef = useRef(false);
    const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
        const el = containerRef.current;
        if (!el || Math.abs(e.deltaY) < 2 || wheelCooldownRef.current) return;

        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 2;
        const atTop = el.scrollTop <= 2;

        if (e.deltaY > 0 && atBottom && pageNumber < (numPages ?? 1)) {
            e.preventDefault();
            wheelCooldownRef.current = true;
            setPageNumber(p => Math.min(numPages ?? 1, p + 1));
            el.scrollTop = 0;
            setTimeout(() => { wheelCooldownRef.current = false; }, 500);
        } else if (e.deltaY < 0 && atTop && pageNumber > 1) {
            e.preventDefault();
            wheelCooldownRef.current = true;
            setPageNumber(p => Math.max(1, p - 1));
            el.scrollTop = 0;
            setTimeout(() => { wheelCooldownRef.current = false; }, 500);
        }
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return <FileViewerSkeleton />;
    }

    // ── Query error ───────────────────────────────────────────────────────────
    if (isError || !file) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
                <h2 className="text-xl font-display font-bold text-foreground">File not found</h2>
                <p className="text-muted-foreground mt-2 text-[14px]">The requested file could not be loaded.</p>
                <Button variant="link" onClick={() => window.history.back()} className="mt-4 text-blue-400 hover:text-blue-300">
                    Go Back
                </Button>
            </div>
        );
    }

    // ── Non-PDF ───────────────────────────────────────────────────────────────
    if (!isPdf(file.title, file.downloadUrl)) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mb-4">
                    <FileText className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h2 className="text-lg font-display font-bold text-foreground">Preview not available for this file type</h2>
                <p className="text-muted-foreground mt-2 text-[14px] max-w-sm">
                    This file cannot be previewed. You can download it to view locally.
                </p>
                {file.downloadUrl ? (
                    <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-foreground text-[14px] font-medium hover:opacity-90 transition-opacity"
                    >
                        <Download className="h-4 w-4" />
                        Download File
                        <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                ) : (
                    <p className="mt-4 text-[13px] text-muted-foreground/50">Download link not available.</p>
                )}
            </div>
        );
    }

    // ── Waiting for blob URL (PDF is being fetched via proxy) ─────────────────
    if (!pdfBlobUrl) {
        return <FileViewerSkeleton />;
    }

    // ── PDF render error ──────────────────────────────────────────────────────
    if (pdfError) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
                <h2 className="text-lg font-display font-bold text-foreground">Could not render PDF</h2>
                <p className="text-muted-foreground mt-2 text-[14px] max-w-sm">
                    The file may be corrupted or inaccessible. Try downloading it directly.
                </p>
                <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-foreground text-[14px] font-medium hover:opacity-90 transition-opacity"
                >
                    <Download className="h-4 w-4" />
                    Download Instead
                </a>
            </div>
        );
    }

    // ── PDF viewer ────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-background">
            <CourseCompletionCelebration
                open={showCelebration}
                onClose={() => setShowCelebration(false)}
                pointsAwarded={pointsAwarded}
                quote={motivationalQuote}
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-foreground/5 backdrop-blur-sm shrink-0">

                {/* Page navigation */}
                <div className="flex items-center gap-1">
                    <button onClick={goToPrevPage} disabled={pageNumber <= 1}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-[13px] text-foreground/60 min-w-[80px] text-center tabular-nums">
                        {pageNumber} / {numPages ?? '—'}
                    </span>
                    <button onClick={goToNextPage} disabled={pageNumber >= (numPages ?? 1)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Zoom + rotate + download */}
                <div className="flex items-center gap-1">
                    <button onClick={zoomOut} disabled={scale <= 0.5}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-[13px] text-foreground/60 min-w-[44px] text-center tabular-nums">
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={zoomIn} disabled={scale >= 2.5}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </button>
                    <div className="w-px h-4 bg-foreground/10 mx-1" />
                    <button onClick={rotate}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
                    >
                        <RotateCw className="h-4 w-4" />
                    </button>
                    <div className="w-px h-4 bg-foreground/10 mx-1" />
                    <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
                        title="Download PDF"
                    >
                        <Download className="h-4 w-4" />
                    </a>
                </div>
            </div>

            {/* PDF canvas */}
            <div ref={containerRef} onWheel={handleWheel} className="flex-1 overflow-auto flex justify-center py-6 px-4 relative">

                <SelectionPopup
                    containerRef={containerRef}
                    onPinToNotes={(text) => onPinToNotes?.(text)}
                    onAskAI={(text) => onTextSelect?.(text)}
                />

                <Document
                    file={pdfBlobUrl}
                    options={PDF_OPTIONS}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                        <div className="flex items-center gap-3 text-muted-foreground mt-20">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                            <span className="text-[14px]">Loading PDF…</span>
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
                                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                            </div>
                        }
                    />
                </Document>
            </div>
        </div>
    );
}