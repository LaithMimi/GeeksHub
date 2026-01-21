import { Link } from "react-router-dom";
import { Brain, Clock, FileText, Sparkles, TrendingUp, Zap, AlertCircle, Star, Bookmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentFiles } from "@/queries/useFiles";
import { useReputation } from "@/queries/useReputation";
import { useMyRequests } from "@/queries/useRequests";
import { usePinnedCourses } from "@/hooks/usePinnedCourses";
import { formatDistanceToNow } from "date-fns";

const DEMO_USER_ID = "u1"; // Mock Logged-in User

export default function Dashboard() {
    const { data: recentFiles, isLoading: isLoadingRecent, isError: isErrorRecent } = useRecentFiles();
    const { data: reputation, isLoading: isLoadingRep } = useReputation(DEMO_USER_ID);
    const { data: requests, isLoading: isLoadingRequests } = useMyRequests(DEMO_USER_ID);
    const { pinnedIds, togglePin } = usePinnedCourses();

    const isLoading = isLoadingRecent || isLoadingRep || isLoadingRequests;

    // Derived state
    const totalPoints = reputation ? reputation.totalPoints : 0;

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    if (isErrorRecent) {
        return (
            <div className="p-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Failed to load dashboard</h2>
                <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome / Resume Header */}
            <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 text-foreground transition-all duration-500 ease-in-out">
                {recentFiles && recentFiles.length > 0 ? (
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
                            <Button size="lg" className="shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 font-semibold text-lg px-4 py-2 h-auto group/btn" asChild>
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
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Study Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12.5 hrs</div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-green-500">+2.5 hrs</span> from last week
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Files</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{recentFiles?.length || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Recently viewed</p>
                    </CardContent>
                </Card>
                <Card className="hover-lift border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Reputation</CardTitle>
                        <Zap className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{totalPoints}</div>
                        <p className="text-xs text-muted-foreground mt-1">Points earned</p>
                    </CardContent>
                </Card>
            </div>

            {/* Dashboard Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Recent Files & Pinned */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Pinned Courses (New) */}
                    {pinnedIds.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                                    Pinned Courses
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {pinnedIds.map(id => (
                                    <Link key={id} to={`/courses/${id}`}>
                                        <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                                            <CardHeader className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                                            <Bookmark className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                                                                {id.toUpperCase()}
                                                                {/* Ideally we'd look up the name, but ID suffices for now */}
                                                            </CardTitle>
                                                            <CardDescription className="text-xs">
                                                                Quick Access
                                                            </CardDescription>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-500" onClick={(e) => {
                                                        e.preventDefault();
                                                        togglePin(id);
                                                    }}>
                                                        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Opened Files */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Recent Opened Files</h2>
                            <Button variant="ghost" size="sm" asChild><Link to="/recent">View All</Link></Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recentFiles && recentFiles.length > 0 ? (
                                recentFiles.slice(0, 4).map((file) => (
                                    <Link key={file.id} to={`/courses/${file.courseId}/files/${file.id}`}>
                                        <Card className="hover-lift cursor-pointer group overflow-hidden h-full">
                                            <div className="h-2 bg-gradient-to-r from-primary to-primary/50" />
                                            <CardHeader className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                                                            {file.title}
                                                        </CardTitle>
                                                        <CardDescription className="flex items-center gap-2 mt-1">
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {file.type}
                                                            </Badge>
                                                            <span className="text-[10px] uppercase">{file.courseId}</span>
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDistanceToNow(new Date(file.viewedAt), { addSuffix: true })}
                                                </p>
                                            </CardHeader>
                                        </Card>
                                    </Link>
                                ))
                            ) : (
                                <div className="col-span-full">
                                    <Card className="p-8 text-center bg-muted/20 border-dashed">
                                        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                                        <p className="text-sm text-muted-foreground">No recent files</p>
                                        <Button variant="link" size="sm" asChild className="mt-2">
                                            <Link to="/courses">Browse</Link>
                                        </Button>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Requests & Sidebar items */}
                <div className="space-y-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Your Requests</h2>
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/uploads">View All</Link>
                        </Button>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            {requests && requests.length > 0 ? (
                                requests.slice(0, 5).map(req => (
                                    <div key={req.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b last:border-b-0">
                                        <div className="p-2 bg-muted rounded-lg">
                                            {req.status === 'pending' && <Clock className="h-5 w-5 text-amber-500" />}
                                            {req.status === 'approved' && <Sparkles className="h-5 w-5 text-green-500" />}
                                            {req.status === 'rejected' && <AlertCircle className="h-5 w-5 text-red-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="font-medium truncate">{req.title}</p>
                                                <Badge variant="outline" className={
                                                    req.status === 'pending' ? 'text-amber-600 bg-amber-50' :
                                                        req.status === 'approved' ? 'text-green-600 bg-green-50' :
                                                            'text-red-600 bg-red-50'
                                                }>{req.status}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{req.courseId} • {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    <p>No active requests</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            <Skeleton className="h-[300px] w-full rounded-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
        </div>
    )
}
