import React, { Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import RouteError from "@/shared/components/errors/RouteError";
import ProtectedRoute from "@/shared/components/routing/ProtectedRoute";

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

const AppShell = Loadable(React.lazy(() => import("@/app/layouts/AppShell")));
const AdminShell = Loadable(React.lazy(() => import("@/app/layouts/AdminShell")));
const CourseShell = Loadable(React.lazy(() => import("@/app/layouts/CourseShell")));
const FileShell = Loadable(React.lazy(() => import("@/app/layouts/FileShell")));
const FilePage = Loadable(React.lazy(() => import("@/features/files/pages/FilePage")));
const Dashboard = Loadable(React.lazy(() => import("@/features/dashboard/pages/Dashboard")));
const UserUploads = Loadable(React.lazy(() => import("@/features/files/pages/UserUploads")));
const Recent = Loadable(React.lazy(() => import("@/features/files/pages/Recent")));
const Settings = Loadable(React.lazy(() => import("@/features/settings/pages/Settings")));
const UserProfile = Loadable(React.lazy(() => import("@/features/profile/pages/UserProfile")));
const Courses = Loadable(React.lazy(() => import("@/features/courses/pages/Courses")));
const AuthPage = Loadable(React.lazy(() => import("@/features/auth/pages/AuthPage")));
const ResetPasswordPage = Loadable(React.lazy(() => import("@/features/auth/pages/ResetPasswordPage")));
const NotFound = Loadable(React.lazy(() => import("@/shared/components/NotFound")));

// Course Pages
const CourseMaterials = Loadable(React.lazy(() => import("@/features/courses/pages/CourseMaterials")));
const CourseNotes = Loadable(React.lazy(() => import("@/features/courses/pages/CourseNotes")));
const CourseExams = Loadable(React.lazy(() => import("@/features/courses/pages/CourseExams")));

// Admin Pages
const AdminHome = Loadable(React.lazy(() => import("@/features/admin/pages/AdminHome")));
const ModerationQueue = Loadable(React.lazy(() => import("@/features/admin/pages/ModerationQueue")));
const AuditLog = Loadable(React.lazy(() => import("@/features/admin/pages/AuditLog")));
const LecturersPage = Loadable(React.lazy(() => import("@/features/admin/pages/LecturersPage")));
const CoursesPage = Loadable(React.lazy(() => import("@/features/admin/pages/CoursesPage")));
const MajorsPage = Loadable(React.lazy(() => import("@/features/admin/pages/MajorsPage")));

// Moderator Pages
const ModeratorShell = Loadable(React.lazy(() => import("@/app/layouts/ModeratorShell")));
const ModeratorHome = Loadable(React.lazy(() => import("@/features/moderator/pages/ModeratorHome")));
const UsersPage = Loadable(React.lazy(() => import("@/features/moderator/pages/UsersPage")));

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
        errorElement: <RouteError name="sign-in page" />,
        children: [
            {
                path: "/",
                element: <AppShell />,
                errorElement: <RouteError name="page" />,
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
                                errorElement: <RouteError name="course" />,
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
        element: <ProtectedRoute requiredRoles={["ADMIN", "MODERATOR"]} />,
        errorElement: <RouteError name="admin area" />,
        children: [
            {
                path: "",
                element: <AdminShell />,
                errorElement: <RouteError name="admin area" />,
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
                    {
                        path: "lecturers",
                        element: <LecturersPage />,
                    },
                    {
                        path: "courses",
                        element: <CoursesPage />,
                    },
                    {
                        path: "majors",
                        element: <MajorsPage />,
                    },
                ],
            },
        ],
    },
    // Protected moderator routes
    {
        path: "/moderator",
        element: <ProtectedRoute requiredRoles={["MODERATOR"]} />,
        errorElement: <RouteError name="moderator area" />,
        children: [
            {
                path: "",
                element: <ModeratorShell />,
                errorElement: <RouteError name="moderator area" />,
                children: [
                    {
                        index: true,
                        element: <ModeratorHome />,
                    },
                    {
                        path: "users",
                        element: <UsersPage />,
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
