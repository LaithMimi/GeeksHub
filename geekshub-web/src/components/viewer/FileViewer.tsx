import { useEffect, useRef } from 'react';
import { Loader2, AlertCircle } from "lucide-react";
import { useParams } from 'react-router-dom';
import { useFile, useAddRecentFile } from '@/queries/useFiles';
import { Button } from '@/components/ui/button';

declare global {
    interface Window {
        AdobeDC: any;
    }
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
                    content: { location: { url: "https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea Brochure.pdf" } },
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="sr-only">Loading file...</span>
            </div>
        );
    }

    if (isError || !file) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-xl font-semibold">File not found</h2>
                <p className="text-muted-foreground mt-2">The requested file could not be loaded.</p>
                <Button variant="link" onClick={() => window.history.back()}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background relative group">
            <div id="adobe-dc-view" className="h-full w-full" />
        </div>
    );
}
