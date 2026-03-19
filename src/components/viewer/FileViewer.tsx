import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    Loader2, AlertCircle, Download, FileText,
    ExternalLink, ChevronLeft, ChevronRight,
    ZoomIn, ZoomOut, RotateCw, Sparkles,
} from "lucide-react";
import { useParams } from 'react-router-dom';
import { useFile, useAddRecentFile } from '@/queries/useFiles';
import { Button } from '@/components/ui/button';
import { useViewerSession } from '@/hooks/useViewerSession';
import { toast } from 'sonner';
import CourseCompletionCelebration from '@/components/ui/CourseCompletionCelebration';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function isPdf(title: string): boolean {
    return title.toLowerCase().endsWith('.pdf');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TooltipPos {
    x: number;
    y: number;
}

interface FileViewerProps {
    /**
     * Called when the user selects text in the PDF and clicks "Ask AI".
     * The parent should forward this to AssistantPanel's selectedText prop.
     */
    onTextSelect?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FileViewer({ onTextSelect }: FileViewerProps) {
    const { courseId, fileId } = useParams();
    const { data: file, isLoading, isError } = useFile(fileId || "");
    const { mutate: addToRecent } = useAddRecentFile();

    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [pdfError, setPdfError] = useState(false);

    // Text-selection tooltip state
    const [tooltip, setTooltip] = useState<{ pos: TooltipPos; text: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // ── Recent files ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (file && courseId) {
            addToRecent({
                id: file.id,
                title: file.title,
                courseId,
                type: file.type,
            });
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

    // ── Text selection — show "Ask AI" tooltip ────────────────────────────────
    useEffect(() => {
        if (!onTextSelect) return;

        function handleMouseUp(e: MouseEvent) {
            // Small delay so the browser has time to finalise the selection
            setTimeout(() => {
                const selection = window.getSelection();
                const text = selection?.toString().trim() ?? "";

                if (!text || !containerRef.current) {
                    setTooltip(null);
                    return;
                }

                // Only show tooltip for selections inside the PDF container
                const anchorNode = selection?.anchorNode;
                if (!anchorNode || !containerRef.current.contains(anchorNode as Node)) {
                    setTooltip(null);
                    return;
                }

                // Position tooltip just above the selection end point
                const rect = selection?.getRangeAt(0).getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();

                if (rect) {
                    setTooltip({
                        text,
                        pos: {
                            x: rect.left - containerRect.left + rect.width / 2,
                            y: rect.top - containerRect.top - 8,
                        },
                    });
                }
            }, 10);
        }

        function handleMouseDown(e: MouseEvent) {
            // Dismiss tooltip if user clicks outside it
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
                setTooltip(null);
            }
        }

        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [onTextSelect]);

    function handleAskAI() {
        if (!tooltip) return;
        onTextSelect?.(tooltip.text);
        window.getSelection()?.removeAllRanges();
        setTooltip(null);
    }

    // ── PDF controls ──────────────────────────────────────────────────────────
    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
        setPdfError(false);
    }, []);

    const onDocumentLoadError = useCallback(() => setPdfError(true), []);

    const goToPrevPage = () => setPageNumber(p => Math.max(1, p - 1));
    const goToNextPage = () => setPageNumber(p => Math.min(numPages ?? 1, p + 1));
    const zoomIn  = () => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)));
    const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)));
    const rotate  = () => setRotation(r => (r + 90) % 360);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                <span className="sr-only">Loading file...</span>
            </div>
        );
    }

    // ── Query error ───────────────────────────────────────────────────────────
    if (isError || !file) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
                <h2 className="text-xl font-display font-bold text-white">File not found</h2>
                <p className="text-white/40 mt-2 text-[14px]">The requested file could not be loaded.</p>
                <Button variant="link" onClick={() => window.history.back()} className="mt-4 text-purple-400 hover:text-purple-300">
                    Go Back
                </Button>
            </div>
        );
    }

    // ── Non-PDF ───────────────────────────────────────────────────────────────
    if (!isPdf(file.title)) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <FileText className="h-7 w-7 text-white/30" />
                </div>
                <h2 className="text-lg font-display font-bold text-white">Preview not available for this file type</h2>
                <p className="text-white/40 mt-2 text-[14px] max-w-sm">
                    This file ({file.type}) cannot be previewed. You can download it to view locally.
                </p>
                {file.downloadUrl ? (
                    <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
                    >
                        <Download className="h-4 w-4" />
                        Download File
                        <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                ) : (
                    <p className="mt-4 text-[13px] text-white/30">Download link not available.</p>
                )}
            </div>
        );
    }

    // ── PDF but no URL ────────────────────────────────────────────────────────
    if (!file.downloadUrl) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-amber-400" />
                </div>
                <h2 className="text-lg font-display font-bold text-white">File not available for preview</h2>
                <p className="text-white/40 mt-2 text-[14px] max-w-sm">
                    The download URL is not yet available. Please try again later.
                </p>
                <Button variant="link" onClick={() => window.history.back()} className="mt-4 text-purple-400 hover:text-purple-300">
                    Go Back
                </Button>
            </div>
        );
    }

    // ── PDF render error ──────────────────────────────────────────────────────
    if (pdfError) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
                <h2 className="text-lg font-display font-bold text-white">Could not render PDF</h2>
                <p className="text-white/40 mt-2 text-[14px] max-w-sm">
                    The file may be corrupted or inaccessible. Try downloading it directly.
                </p>
                <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
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
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm shrink-0">

                {/* Page navigation */}
                <div className="flex items-center gap-1">
                    <button onClick={goToPrevPage} disabled={pageNumber <= 1}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-[13px] text-white/60 min-w-[80px] text-center tabular-nums">
                        {pageNumber} / {numPages ?? '—'}
                    </span>
                    <button onClick={goToNextPage} disabled={pageNumber >= (numPages ?? 1)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Zoom + rotate + download */}
                <div className="flex items-center gap-1">
                    <button onClick={zoomOut} disabled={scale <= 0.5}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-[13px] text-white/60 min-w-[44px] text-center tabular-nums">
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={zoomIn} disabled={scale >= 2.5}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </button>
                    <div className="w-px h-4 bg-white/[0.08] mx-1" />
                    <button onClick={rotate}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                    >
                        <RotateCw className="h-4 w-4" />
                    </button>
                    <div className="w-px h-4 bg-white/[0.08] mx-1" />
                    <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                        title="Download PDF"
                    >
                        <Download className="h-4 w-4" />
                    </a>
                </div>
            </div>

            {/* PDF canvas — position:relative so tooltip is anchored to it */}
            <div ref={containerRef} className="flex-1 overflow-auto flex justify-center py-6 px-4 relative">

                {/* "Ask AI" tooltip — appears above any text selection */}
                {tooltip && onTextSelect && (
                    <div
                        ref={tooltipRef}
                        className="absolute z-50 -translate-x-1/2 -translate-y-full pointer-events-auto"
                        style={{ left: tooltip.pos.x, top: tooltip.pos.y }}
                    >
                        <button
                            onClick={handleAskAI}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                       gradient-bg text-white text-[12px] font-medium
                                       shadow-lg shadow-black/40 hover:opacity-90 transition-opacity
                                       whitespace-nowrap"
                        >
                            <Sparkles className="h-3 w-3" />
                            Ask AI
                        </button>
                        {/* Arrow */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full
                                        w-0 h-0 border-l-4 border-r-4 border-t-4
                                        border-l-transparent border-r-transparent border-t-purple-600" />
                    </div>
                )}

                <Document
                    file={file.downloadUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                        <div className="flex items-center gap-3 text-white/40 mt-20">
                            <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
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
                                <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                            </div>
                        }
                    />
                </Document>
            </div>
        </div>
    );
}