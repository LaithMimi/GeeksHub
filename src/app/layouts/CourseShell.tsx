import { Link, Outlet, useParams, useLocation } from "react-router-dom";
import { BookOpen, FileText, ClipboardList, GraduationCap, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCourse } from "@/features/courses/hooks/useCatalog";

const navItems = [
    { path: "materials", label: "Materials", icon: BookOpen },
    { path: "notes", label: "Notes", icon: FileText },
    { path: "exams", label: "Past Exams", icon: ClipboardList },
];

export default function CourseShell() {
    const { courseId } = useParams();
    const location = useLocation();

    // Fetch course details
    const safeCourseId = (courseId && courseId !== "undefined") ? courseId : "";
    const { data: course, isLoading } = useCourse(safeCourseId);

    const isActive = (path: string) => {
        return location.pathname.includes(`/${path}`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!course) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold">Course Not Found</h2>
                <p>The requested course "{courseId}" does not exist.</p>
                <div className="mt-4">
                    <Link to="/courses" className="text-primary hover:underline">Back to Courses</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            {/* Course Header — glass surface so it reads like the course cards in both light & dark */}
            <div className="relative overflow-hidden rounded-xl liquid-glass p-6 mb-6">
                {/* Colored accent bar — echoes the course-card accent (only when a course color is set) */}
                {course.color && (
                    <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${course.color} opacity-70`} />
                )}
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            <GraduationCap className="h-3 w-3 mr-1" />
                            {course.code}
                        </Badge>
                        {course.term && <span className="text-muted-foreground text-sm">{course.term}</span>}
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">{course.name}</h1>
                </div>

                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
            </div>

            {/* Course Navigation */}
            <nav className="flex gap-2 mb-6 border-b pb-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                active
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Course Content */}
            <Outlet />
        </div>
    );
}
