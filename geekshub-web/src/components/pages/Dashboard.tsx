import { Link } from "react-router-dom";
import { Brain, Clock, FileText, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { coursesList, userRequests } from "@/lib/data";
import { useRecentFiles } from "@/hooks/useRecentFiles";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
    const { recentFiles } = useRecentFiles();
    const totalPoints = userRequests.reduce((acc, curr) => acc + (curr.points || 0), 0);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ... (Welcome Header remains unchanged) ... */}
            <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 text-foreground transition-all duration-500 ease-in-out">
                {recentFiles.length > 0 ? (
                    // Q1/Q2: Continue Studying State
                    <div className="relative z-10 max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6 border border-primary/20">
                            <Clock className="h-4 w-4" />
                            <span>Continue Learning</span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
                            Pick up where you left off in <span className="text-primary block md:inline">{recentFiles[0].title}</span>
                        </h1>

                        <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
                            You were studying <span className="font-semibold text-foreground">{recentFiles[0].type}</span> for <span className="font-semibold text-foreground uppercase">{recentFiles[0].courseId}</span>. <br className="hidden md:block" />
                            Ready to jump back in?
                        </p>

                        <div className="flex flex-wrap items-center gap-4">
                            <Button size="lg" className="shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 font-semibold text-lg px-6 py-4 h-auto group/btn" asChild>
                                <Link to={`/courses/${recentFiles[0].courseId}/files/${recentFiles[0].id}`}>
                                    <Brain className="me-3 h-6 w-6 group-hover/btn:rotate-12 transition-transform" />
                                    Continue Studying
                                </Link>
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Last seen {formatDistanceToNow(new Date(recentFiles[0].viewedAt), { addSuffix: true })}
                            </span>
                        </div>
                    </div>
                ) : (
                    // Default Welcome State
                    <div className="relative z-10 max-w-2xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-sm font-medium text-muted-foreground border border-border mb-6">
                            <Sparkles className="h-4 w-4 text-primary fill-primary/20" />
                            <span>AI-Powered Learning</span>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
                            Welcome back, <span className="text-primary">Student!</span>
                        </h1>

                        <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
                            Continue where you left off or explore new materials. Your AI study assistant is ready to help you master <span className="font-semibold text-foreground border-b border-primary/30">new concepts</span>.
                        </p>

                        <div className="flex flex-wrap items-center gap-4">
                            <Button size="lg" className="shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 font-semibold group/btn">
                                <Brain className="me-2 h-5 w-5 group-hover/btn:rotate-12 transition-transform" />
                                Start AI Session
                            </Button>
                            <Button variant="outline" size="lg" className="transition-all hover:bg-muted" asChild>
                                <Link to="/courses">View All Courses</Link>
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="hover-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Study Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12.5 hrs</div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-500">+2.5 hrs</span> from last week
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Files Studied</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">24</div>
                        <p className="text-xs text-muted-foreground mt-1">Across 3 courses</p>
                    </CardContent>
                </Card>
                <Card className="hover-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">AI Questions</CardTitle>
                        <Brain className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">156</div>
                        <p className="text-xs text-muted-foreground mt-1">This semester</p>
                    </CardContent>
                </Card>
                <Card className="hover-lift border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Community Impact</CardTitle>
                        <Zap className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{totalPoints}</div>
                        <p className="text-xs text-muted-foreground mt-1">Points earned</p>
                    </CardContent>
                </Card>
            </div>

            {/* Courses Grid */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Your Courses</h2>
                    <Button variant="ghost" size="sm">View All</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {coursesList.map((course) => (
                        <Link key={course.id} to={`/courses/${course.id}`}>
                            <Card className="hover-lift cursor-pointer group overflow-hidden">
                                <div className={`h-2 bg-gradient-to-r ${course.color}`} />
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                                {course.name}
                                            </CardTitle>
                                            <CardDescription>{course.term}</CardDescription>
                                        </div>
                                        <Badge variant="secondary">{course.progress}%</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="w-full bg-secondary rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full bg-gradient-to-r ${course.color}`}
                                            style={{ width: `${course.progress}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Recent Files & Requests Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Recent Files */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Recent Files</h2>
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/recent">View All</Link>
                        </Button>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            {recentFiles.length > 0 ? (
                                recentFiles.slice(0, 5).map((file) => (
                                    <Link
                                        key={file.id}
                                        to={`/courses/${file.courseId}/files/${file.id}`}
                                        className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-b-0 group"
                                    >
                                        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{file.title}</p>
                                            <p className="text-sm text-muted-foreground uppercase">{file.courseId}</p>
                                        </div>
                                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDistanceToNow(new Date(file.viewedAt), { addSuffix: true })}
                                        </span>
                                    </Link>
                                ))
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No recently viewed files</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* File Requests */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Your Requests</h2>
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/uploads">View All</Link>
                        </Button>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <div className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-b-0">
                                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="font-medium truncate">Midterm Review.pdf</p>
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">CS101 • Requested 2 days ago</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-b-0">
                                <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="font-medium truncate">Old Syllabus.docx</p>
                                        <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Rejected</Badge>
                                    </div>
                                    <p className="text-xs text-red-500 mt-1">Reason: Outdated content</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
