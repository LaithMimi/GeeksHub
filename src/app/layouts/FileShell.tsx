import { Outlet, useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useFile } from "@/features/files/hooks/useFiles";
import { FileViewerSkeleton } from "@/features/files/components/FileViewer";

export default function FileShell() {
    const { fileId } = useParams();
    const { isLoading, isError } = useFile(fileId || "");

    const Content = () => {
        if (isLoading) return <FileViewerSkeleton />;
        if (isError) return (
            <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-red-500">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>Error loading file.</p>
            </div>
        )
        return <Outlet />;
    }

    return (
        <div className="h-[calc(100vh-4rem)] w-full">
            <Content />
        </div>
    );
}