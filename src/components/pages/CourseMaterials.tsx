import { useParams, Link } from "react-router-dom";
import { FileText, AlertCircle, FolderOpen, RefreshCw } from "lucide-react";
import { useFiles } from "@/queries/useFiles";
import type { File as CourseFile } from "@/types/domain";

const typeBadgeColors: Record<string, string> = {
    Slides: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    Notes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    Homeworks: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    "Past Papers": "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

function FileCard({ file, courseId }: { file: CourseFile; courseId: string }) {
    return (
        <Link
            to={`/courses/${courseId}/files/${file.id}`}
            className="glass-card p-4 flex items-center gap-4 group hover:bg-white/[0.04] transition-all"
        >
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-purple-500/15 transition-colors">
                <FileText className="h-4.5 w-4.5 text-white/40 group-hover:text-purple-400 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                    {file.title}
                </p>
                <p className="text-[12px] text-white/35 mt-0.5">
                    {file.lecturer} · {file.date}
                </p>
            </div>
            <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border shrink-0 ${typeBadgeColors[file.type] ?? "bg-white/[0.06] text-white/40 border-white/[0.08]"}`}
            >
                {file.type}
            </span>
        </Link>
    );
}

function FileListSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 rounded bg-white/[0.06] w-3/4" />
                        <div className="h-3 rounded bg-white/[0.04] w-1/2" />
                    </div>
                    <div className="h-6 w-16 rounded-lg bg-white/[0.06]" />
                </div>
            ))}
        </div>
    );
}

export default function CourseMaterials() {
    const { courseId } = useParams<{ courseId: string }>();
    const { data: files, isLoading, error, refetch } = useFiles({ courseId: courseId! });

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
                    <p className="text-[15px] font-medium text-white">Failed to load materials</p>
                    <p className="text-[13px] text-white/40">Something went wrong. Please try again.</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] text-purple-400 hover:bg-purple-500/10 transition-all"
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
                    <p className="text-[15px] font-medium text-white">No materials uploaded yet</p>
                    <p className="text-[13px] text-white/40">Check back later or request a file be added.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in">
            {files.map((file) => (
                <FileCard key={file.id} file={file} courseId={courseId!} />
            ))}
        </div>
    );
}
