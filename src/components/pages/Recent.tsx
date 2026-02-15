import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, Clock, FileText, Trash2, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecentFiles, useClearRecentFiles } from "@/queries/useFiles";

export default function Recent() {
    const { data: recentFiles, isLoading } = useRecentFiles();
    const { mutate: clearHistory } = useClearRecentFiles();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
        );
    }

    if (!recentFiles || recentFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl liquid-glass flex items-center justify-center">
                    <History className="h-7 w-7 text-white/30" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-display font-bold text-white">No Recent History</h2>
                    <p className="text-white/40 max-w-sm mx-auto text-[14px]">
                        Files you view will appear here so you can easily find them again.
                    </p>
                </div>
                <Button asChild className="gradient-bg border-0 glow-purple-soft">
                    <Link to="/courses">Browse Courses</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[32px] font-display font-bold text-white tracking-[-0.03em]">Recent Files</h1>
                    <p className="text-white/40 mt-1 text-[14px]">Pick up where you left off</p>
                </div>
                <button
                    onClick={() => clearHistory()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear History
                </button>
            </div>

            <div className="liquid-glass rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06]">
                    <h3 className="text-[15px] font-display font-semibold text-white/70">Viewing History</h3>
                </div>
                <div className="divide-y divide-white/[0.06]">
                    {recentFiles.map((file) => (
                        <Link
                            key={file.id}
                            to={`/courses/${file.courseId}/files/${file.id}`}
                            className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.03] transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20 transition-colors">
                                <FileText className="h-4.5 w-4.5 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="font-medium text-white truncate text-[14px] group-hover:text-purple-300 transition-colors">
                                        {file.title}
                                    </p>
                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/40 shrink-0">
                                        {file.type}
                                    </span>
                                </div>
                                <p className="text-[12px] text-white/35 flex items-center gap-2">
                                    <BookOpen className="h-3 w-3" />
                                    <span className="uppercase">{file.courseId}</span>
                                </p>
                            </div>
                            <div className="text-[12px] text-white/30 flex items-center gap-1.5 whitespace-nowrap">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(file.viewedAt), { addSuffix: true })}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
