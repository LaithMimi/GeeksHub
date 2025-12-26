import { createBrowserRouter, Navigate, Link, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import CourseShell from "@/components/layout/CourseShell";
import FileShell from "@/components/layout/FileShell";
import FileViewer from "@/components/viewer/FileViewer";
import Dashboard from "@/components/pages/Dashboard";
import Courses from "@/components/pages/Courses";

// Materials View Component
function MaterialsView() {
    const { courseId } = useParams();
    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Materials</h2>
            <ul className="space-y-2">
                <li>
                    <Link
                        to={`/courses/${courseId}/files/123`}
                        className="block p-2 border rounded hover:bg-slate-50"
                    >
                        Introduction to Algorithms.pdf
                        <span className="block text-xs text-muted-foreground">Click to open Study View</span>
                    </Link>
                </li>
            </ul>
        </div>
    );
}

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppShell />,
        errorElement: <div className="p-8">Something went wrong (AppShell Error Boundary)</div>,
        children: [
            {
                index: true,
                element: <Dashboard />,
            },
            {
                path: "courses",
                children: [
                    {
                        index: true,
                        element: <Courses />
                    },
                    {
                        path: ":courseId",
                        element: <CourseShell />,
                        errorElement: <div className="p-8">Something went wrong (CourseShell Error Boundary)</div>,
                        children: [
                            {
                                index: true,
                                element: <Navigate to="materials" replace />,
                            },
                            {
                                path: "materials",
                                element: <MaterialsView />,
                            },
                            {
                                path: "notes",
                                element: <div>Notes View</div>,
                            },
                            {
                                path: "exams",
                                element: <div>Past Exams View</div>,
                            },
                            {
                                path: "files/:fileId",
                                element: <FileShell />,
                                children: [
                                    {
                                        index: true,
                                        element: <FileViewer />
                                    }
                                ]
                            }
                        ],
                    },
                ],
            },
        ],
    },
]);
