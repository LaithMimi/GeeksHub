import { useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Download, FileText, ExternalLink } from "lucide-react";
import { useParams } from 'react-router-dom';
import { useFile, useAddRecentFile } from '@/queries/useFiles';
import { Button } from '@/components/ui/button';

declare global {
    interface Window {
        AdobeDC: any;
    }
}

/** Check if a file title indicates a PDF */
function isPdf(title: string): boolean {
    return title.toLowerCase().endsWith('.pdf');
}

export default function FileViewer() {
    const { courseId, fileId } = useParams();
    const { data: file, isLoading, isError } = useFile(fileId || "");
    const { mutate: addToRecent } = useAddRecentFile();
    const viewerInitialized = useRef(false);

    useEffect(() => {
        if (file && courseId) {
            addToRecent({
                id: file.id,
                title: file.title,
                courseId: courseId,
                type: file.type,
            });
        }
    }, [file, courseId, addToRecent]);

    useEffect(() => {
        if (!file) return;
        if (viewerInitialized.current) return;
        if (!file.downloadUrl) return;
        if (!isPdf(file.title)) return;

        const loadAdobeSDK = () => {
            if (window.AdobeDC) {
                initializeViewer();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://documentcloud.adobe.com/view-sdk/viewer.js';
            script.onload = () => initializeViewer();
            document.body.appendChild(script);
        };

        const initializeViewer = () => {
            if (!window.AdobeDC) return;

            viewerInitialized.current = true;
            const adobeDCView = new window.AdobeDC.View({
                clientId: "ac28f5026b0a4f018085d5432e729481",
                divId: "adobe-dc-view",
            });

            adobeDCView.previewFile(
                {
                    content: { location: { url: file.downloadUrl! } },
                    metaData: { fileName: file.title }
                },
                {
                    embedMode: "SIZED_CONTAINER",
                    showDownloadPDF: true,
                    showPrintPDF: true,
                    showLeftHandPanel: false,
                    showAnnotationTools: true
                }
            );
        };

        loadAdobeSDK();
    }, [file]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                <span className="sr-only">Loading file...</span>
            </div>
        );
    }

    if (isError || !file) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
                <h2 className="text-xl font-display font-bold text-white">File not found</h2>
                <p className="text-white/40 mt-2 text-[14px]">The requested file could not be loaded.</p>
                <Button
                    variant="link"
                    onClick={() => window.history.back()}
                    className="mt-4 text-purple-400 hover:text-purple-300"
                >
                    Go Back
                </Button>
            </div>
        );
    }

    // Non-PDF file — show download-only UI
    if (!isPdf(file.title)) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <FileText className="h-7 w-7 text-white/30" />
                </div>
                <h2 className="text-lg font-display font-bold text-white">Preview not available for this file type</h2>
                <p className="text-white/40 mt-2 text-[14px] max-w-sm">
                    This file ({file.type}) cannot be previewed in the browser. You can download it to view locally.
                </p>
                {file.downloadUrl ? (
                    <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
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

    // PDF file but no downloadUrl
    if (!file.downloadUrl) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-amber-400" />
                </div>
                <h2 className="text-lg font-display font-bold text-white">This file is not available for preview</h2>
                <p className="text-white/40 mt-2 text-[14px] max-w-sm">
                    The download URL is not yet available. Please try again later.
                </p>
                <Button
                    variant="link"
                    onClick={() => window.history.back()}
                    className="mt-4 text-purple-400 hover:text-purple-300"
                >
                    Go Back
                </Button>
            </div>
        );
    }

    // PDF with valid downloadUrl — render Adobe viewer
    return (
        <div className="h-full flex flex-col bg-background relative group">
            <div id="adobe-dc-view" className="h-full w-full" />
        </div>
    );
}
