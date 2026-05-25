import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, Clock, FileText, Trash2, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecentFiles, useClearRecentFiles } from "@/features/files/hooks/useFiles";
import { useCourses } from "@/features/courses/hooks/useCatalog";

export default function Recent() {
    const { data: recentFiles, isLoading } = useRecentFiles();
    const { mutate: clearHistory } = useClearRecentFiles();
    const { data: courses } = useCourses({});

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
        );
    }

    if (!recentFiles || recentFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl liquid-glass flex items-center justify-center">
                    <History className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-display font-bold text-foreground">No Recent History</h2>
                    <p className="text-muted-foreground max-w-sm mx-auto text-[14px]">
                        Files you view will appear here so you can easily find them again.
                    </p>
                </div>
                <Button asChild className="gradient-bg border-0 glow-blue-soft">
                    <Link to="/courses">Browse Courses</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[32px] font-display font-bold text-foreground tracking-[-0.03em]">Recent Files</h1>
                    <p className="text-muted-foreground mt-1 text-[14px]">Pick up where you left off</p>
                </div>
                <button
                    onClick={() => clearHistory()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear History
                </button>
            </div>

            <div className="liquid-glass rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-[15px] font-display font-semibold text-foreground/70">Viewing History</h3>
                </div>
                <div className="divide-y divide-border">
                    {recentFiles.map((file) => (
                        <Link
                            key={file.id}
                            to={`/courses/${file.courseId}/files/${file.id}`}
                            className="flex items-center gap-4 px-6 py-4 hover:bg-foreground/5 transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                                <FileText className="h-4.5 w-4.5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="font-medium text-foreground truncate text-[14px] group-hover:text-blue-300 transition-colors">
                                        {file.title}
                                    </p>
                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-foreground/5 text-muted-foreground shrink-0">
                                        {file.type}
                                    </span>
                                </div>
                                <p className="text-[12px] text-muted-foreground/70 flex items-center gap-2">
                                    <BookOpen className="h-3 w-3" />
                                    <span className="truncate">{courses?.find(c => c.id === file.courseId)?.name ?? file.courseId}</span>
                                </p>
                            </div>
                            <div className="text-[12px] text-muted-foreground/50 flex items-center gap-1.5 whitespace-nowrap">
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
