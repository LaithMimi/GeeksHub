import { useEffect, useRef } from 'react';
import { Loader2 } from "lucide-react";
import { useParams } from 'react-router-dom';
import { useRecentFiles } from '@/hooks/useRecentFiles';
import { allFiles } from '@/lib/data';

declare global {
    interface Window {
        AdobeDC: any;
    }
}

export default function FileViewer() {
    const { courseId, fileId } = useParams();
    const { addRecentFile } = useRecentFiles();
    const viewerInitialized = useRef(false);

    useEffect(() => {
        // Track recent file access
        if (fileId && courseId) {
            const fileData = allFiles.find(f => f.id === fileId);
            if (fileData) {
                addRecentFile({
                    id: fileData.id,
                    title: fileData.title,
                    courseId: courseId,
                    type: fileData.type,
                });
            }
        }

        // Prevent double initialization
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

            const fileData = allFiles.find(f => f.id === fileId);
            const fileName = fileData ? fileData.title : "Document.pdf";

            adobeDCView.previewFile(
                {
                    content: { location: { url: "https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea Brochure.pdf" } },
                    metaData: { fileName: fileName }
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
    }, [fileId, courseId]);

    return (
        <div className="h-full flex flex-col bg-background relative group">
            {/* Adobe View Container - fills the parent */}
            <div id="adobe-dc-view" className="h-full w-full" />

            {/* Loading Skeleton (visible before PDF loads over it) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        </div>
    );
}
