import { Link, Outlet, useParams, useLocation } from "react-router-dom";
import { BookOpen, FileText, ClipboardList, ChevronRight, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { courseDetails } from "@/lib/data";

const navItems = [
    { path: "materials", label: "Materials", icon: BookOpen },
    { path: "notes", label: "Notes", icon: FileText },
    { path: "exams", label: "Past Exams", icon: ClipboardList },
];

export default function CourseShell() {
    const { courseId } = useParams();
    const location = useLocation();
    const course = courseDetails[courseId || ""] || { id: "unknown", name: "Unknown Course", term: "", color: "from-gray-500 to-gray-600" };

    const isActive = (path: string) => {
        return location.pathname.includes(`/${path}`);
    };

    return (
        <div className="animate-fade-in">
            {/* Course Header */}
            <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${course.color} p-6 mb-6 text-white`}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="bg-white/20 text-white border-0">
                            <GraduationCap className="h-3 w-3 mr-1" />
                            {courseId?.toUpperCase()}
                        </Badge>
                        <span className="text-white/80 text-sm">{course.term}</span>
                    </div>
                    <h1 className="text-2xl font-bold">{course.name}</h1>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
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
