import { Link } from "react-router-dom";
import { BookOpen, Brain, Clock, FileText, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { coursesList, recentFiles } from "@/lib/data";

export default function Dashboard() {
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome Header */}
            <div className="relative overflow-hidden rounded-2xl gradient-bg p-8 text-white">
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-5 w-5" />
                        <span className="text-sm font-medium opacity-90">AI-Powered Learning</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Welcome back, Student!</h1>
                    <p className="text-white/80 max-w-lg">
                        Continue where you left off or explore new materials. Your AI study assistant is ready to help.
                    </p>
                    <div className="mt-6 flex gap-3">
                        <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                            <Brain className="mr-2 h-4 w-4" />
                            Start AI Session
                        </Button>
                        <Button variant="ghost" className="text-white hover:bg-white/10">
                            View All Courses
                        </Button>
                    </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Recent Files */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Recent Files</h2>
                    <Button variant="ghost" size="sm">View All</Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        {recentFiles.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-b-0"
                            >
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <BookOpen className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{file.name}</p>
                                    <p className="text-sm text-muted-foreground">{file.course}</p>
                                </div>
                                <span className="text-sm text-muted-foreground whitespace-nowrap">{file.time}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
