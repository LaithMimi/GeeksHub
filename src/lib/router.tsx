import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import AdminShell from "@/components/layout/AdminShell";
import CourseShell from "@/components/layout/CourseShell";
import FileShell from "@/components/layout/FileShell";
import FilePage from "@/components/pages/FilePage";
import Dashboard from "@/components/pages/Dashboard";
import UserUploads from "@/components/pages/UserUploads";
import Recent from "@/components/pages/Recent";
import Settings from "@/components/pages/Settings";
import Courses from "@/components/pages/Courses";
import AuthPage from "@/pages/Auth/AuthPage";
import ResetPasswordPage from "@/pages/Auth/ResetPasswordPage";
import RouteError from "@/components/errors/RouteError";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import MyPath from "@/components/pages/MyPath";
import NotFound from "@/components/pages/NotFound";

// Course Pages
import CourseMaterials from "@/components/pages/CourseMaterials";
import CourseNotes from "@/components/pages/CourseNotes";
import CourseExams from "@/components/pages/CourseExams";

// Admin Pages
import AdminHome from "@/components/pages/admin/AdminHome";
import ModerationQueue from "@/components/pages/admin/ModerationQueue";
import AuditLog from "@/components/pages/admin/AuditLog";

export const router = createBrowserRouter([
    // Public auth routes
    {
        path: "/auth",
        element: <AuthPage />,
    },
    {
        path: "/auth/reset-password",
        element: <ResetPasswordPage />,
    },
    // Protected app routes
    {
        element: <ProtectedRoute />,
        errorElement: <RouteError name="Auth" />,
        children: [
            {
                path: "/",
                element: <AppShell />,
                errorElement: <RouteError name="AppShell" />,
                children: [
                    {
                        index: true,
                        element: <Dashboard />,
                    },
                    {
                        path: "uploads",
                        element: <UserUploads />
                    },
                    {
                        path: "recent",
                        element: <Recent />
                    },
                    {
                        path: "settings",
                        element: <Settings />
                    },
                    {
                        path: "path",
                        element: <MyPath />
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
                                errorElement: <RouteError name="CourseShell" />,
                                children: [
                                    {
                                        index: true,
                                        element: <Navigate to="materials" replace />,
                                    },
                                    {
                                        path: "materials",
                                        element: <CourseMaterials />,
                                    },
                                    {
                                        path: "notes",
                                        element: <CourseNotes />,
                                    },
                                    {
                                        path: "exams",
                                        element: <CourseExams />,
                                    },
                                    {
                                        path: "files/:fileId",
                                        element: <FileShell />,
                                        children: [
                                            {
                                                index: true,
                                                element: <FilePage />
                                            }
                                        ]
                                    }
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
    // Protected admin routes
    {
        path: "/admin",
        element: <ProtectedRoute requiredRole="ADMIN" />,
        errorElement: <RouteError name="Admin Auth" />,
        children: [
            {
                path: "",
                element: <AdminShell />,
                errorElement: <RouteError name="Admin" />,
                children: [
                    {
                        index: true,
                        element: <AdminHome />,
                    },
                    {
                        path: "requests",
                        element: <ModerationQueue />,
                    },
                    {
                        path: "audit",
                        element: <AuditLog />,
                    },
                ],
            },
        ],
    },
    // 404 catch-all
    {
        path: "*",
        element: <NotFound />,
    },
]);
