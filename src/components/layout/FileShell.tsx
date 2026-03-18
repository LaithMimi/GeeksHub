import { Outlet, useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useFile } from "@/queries/useFiles";

export default function FileShell() {
    const { fileId } = useParams();
    const { isLoading, isError } = useFile(fileId || "");

    const Content = () => {
        if (isLoading) return (
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
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