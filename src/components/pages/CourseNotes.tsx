import { useParams, Link } from "react-router-dom";
import { FileText, AlertCircle, FolderOpen, RefreshCw } from "lucide-react";
import { useFiles } from "@/hooks/useFiles";

function FileListSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 rounded bg-white/[0.06] w-3/4" />
                        <div className="h-3 rounded bg-white/[0.04] w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function CourseNotes() {
    const { courseId } = useParams<{ courseId: string }>();
    const { data: files, isLoading, error, refetch } = useFiles({ courseId: courseId!, type: "Notes" });

    if (isLoading) {
        return <FileListSkeleton />;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <div className="space-y-1">
                    <p className="text-[15px] font-medium text-white">Failed to load notes</p>
                    <p className="text-[13px] text-white/40">Something went wrong. Please try again.</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] text-blue-400 hover:bg-blue-500/10 transition-all"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                </button>
            </div>
        );
    }

    if (!files || files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                    <FolderOpen className="h-6 w-6 text-white/20" />
                </div>
                <div className="space-y-1">
                    <p className="text-[15px] font-medium text-white">No notes uploaded yet</p>
                    <p className="text-[13px] text-white/40">Check back later or request notes be added.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in">
            {files.map((file) => (
                <Link
                    key={file.id}
                    to={`/courses/${courseId}/files/${file.id}`}
                    className="glass-card p-4 flex items-center gap-4 group hover:bg-white/[0.04] transition-all"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                        <FileText className="h-4.5 w-4.5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-white truncate group-hover:text-blue-300 transition-colors">
                            {file.title}
                        </p>
                        <p className="text-[12px] text-white/35 mt-0.5">
                            {file.lecturer} · {file.date}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
