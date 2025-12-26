import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, Clock, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentFiles } from "@/hooks/useRecentFiles";
import { Badge } from "@/components/ui/badge";

export default function Recent() {
    const { recentFiles, clearHistory } = useRecentFiles();

    if (recentFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
                <div className="p-4 bg-muted/50 rounded-full">
                    <History className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">No Recent History</h2>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                        Files you view will appear here so you can easily find them again.
                    </p>
                </div>
                <Button asChild>
                    <Link to="/courses">Browse Courses</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recent Files</h1>
                    <p className="text-muted-foreground mt-1">
                        Pick up where you left off
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4 me-2" />
                    Clear History
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-medium">Viewing History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {recentFiles.map((file) => (
                            <Link
                                key={file.id}
                                to={`/courses/${file.courseId}/files/${file.id}`}
                                className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group"
                            >
                                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium truncate">{file.title}</p>
                                        <Badge variant="secondary" className="text-xs font-normal">
                                            {file.type}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <BookOpen className="h-3 w-3" />
                                        <span className="uppercase">{file.courseId}</span>
                                    </p>
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatDistanceToNow(new Date(file.viewedAt), { addSuffix: true })}
                                </div>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function History({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
            <path d="M3 3v9h9" />
            <path d="M12 7v5l4 2" />
        </svg>
    )
}
