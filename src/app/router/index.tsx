import React, { Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import RouteError from "@/components/errors/RouteError";
import ProtectedRoute from "@/components/routing/ProtectedRoute";

const PageLoader = () => (
    <div className="flex bg-background text-foreground h-full w-full items-center justify-center p-8 min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
    </div>
);

const Loadable = <T extends object>(Component: React.ComponentType<T>) =>
    (props: T) => (
        <Suspense fallback={<PageLoader />}>
            <Component {...props} />
        </Suspense>
    );

const AppShell = Loadable(React.lazy(() => import("@/components/layout/AppShell")));
const AdminShell = Loadable(React.lazy(() => import("@/components/layout/AdminShell")));
const CourseShell = Loadable(React.lazy(() => import("@/components/layout/CourseShell")));
const FileShell = Loadable(React.lazy(() => import("@/components/layout/FileShell")));
const FilePage = Loadable(React.lazy(() => import("@/components/pages/FilePage")));
const Dashboard = Loadable(React.lazy(() => import("@/components/pages/Dashboard")));
const UserUploads = Loadable(React.lazy(() => import("@/components/pages/UserUploads")));
const Recent = Loadable(React.lazy(() => import("@/components/pages/Recent")));
const Settings = Loadable(React.lazy(() => import("@/components/pages/Settings")));
const UserProfile = Loadable(React.lazy(() => import("@/components/pages/UserProfile")));
const Courses = Loadable(React.lazy(() => import("@/components/pages/Courses")));
const AuthPage = Loadable(React.lazy(() => import("@/components/pages/Auth/AuthPage")));
const ResetPasswordPage = Loadable(React.lazy(() => import("@/components/pages/Auth/ResetPasswordPage")));
const NotFound = Loadable(React.lazy(() => import("@/components/pages/NotFound")));

// Course Pages
const CourseMaterials = Loadable(React.lazy(() => import("@/components/pages/CourseMaterials")));
const CourseNotes = Loadable(React.lazy(() => import("@/components/pages/CourseNotes")));
const CourseExams = Loadable(React.lazy(() => import("@/components/pages/CourseExams")));

// Admin Pages
const AdminHome = Loadable(React.lazy(() => import("@/components/pages/admin/AdminHome")));
const ModerationQueue = Loadable(React.lazy(() => import("@/components/pages/admin/ModerationQueue")));
const AuditLog = Loadable(React.lazy(() => import("@/components/pages/admin/AuditLog")));

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
                        path: "profile",
                        element: <UserProfile />
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
