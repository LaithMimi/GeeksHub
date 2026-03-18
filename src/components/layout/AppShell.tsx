/**
 * ============================================================================
 * APP SHELL / LAYOUT – Static Implementation
 * ============================================================================
 *
 * Provides the sidebar navigation, breadcrumbs, and top bar.
 * Currently has NO backend interaction – all nav items are hardcoded
 * and user profile data is not displayed.
 *
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 *
 * 1. User Profile Display (sidebar avatar / name):
 *    Use the authenticated user context from the auth provider.
 *    ```ts
 *    const { user } = useAuth();  // provides user.name, user.avatar, user.role
 *    ```
 *    No new endpoint needed – user data comes from the auth session
 *    (GET /api/me/profile, already documented in authService.ts).
 *
 * 2. Notification Badge (Bell icon):
 *    Add an unread notification count to the top bar.
 *
 *    GET /api/me/notifications/unread-count
 *      → Response: { count: number }
 *      → Poll every 30s or use WebSocket for real-time updates.
 *
 *    GET /api/me/notifications
 *      → Response: Notification[]
 *
 *    PATCH /api/me/notifications/:id/read
 *      → Marks a notification as read.
 *
 *    ```ts
 *    export const useUnreadCount = () => useQuery({
 *        queryKey: ["unread-notifications"],
 *        queryFn: () => api<{ count: number }>("GET", "/api/me/notifications/unread-count"),
 *        refetchInterval: 30_000,  // poll every 30 seconds
 *    });
 *    ```
 *
 * 3. Conditional Nav Items:
 *    Admin-only routes (e.g. /admin/*) should be shown conditionally:
 *    ```ts
 *    const isAdmin = user?.role === "admin";
 *    const visibleNavItems = navItems.filter(item =>
 *        !item.adminOnly || isAdmin
 *    );
 *    ```
 *
 * 4. Language preference:
 *    The language code currently reads from localStorage.
 *    After Settings backend is connected, read from the auth session or
 *    GET /api/me/settings response instead.
 * ============================================================================
 */

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    Home,
    History,
    Settings,
    BookOpen,
    Upload,
    Map,
    Bell,
    Search,
    GraduationCap,
    Sparkles,
} from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "../ui/command-palette";
import { isMac } from "@/lib/utils";
import { useCourse } from "@/queries/useCatalog";
import { useFile } from "@/queries/useFiles";

// Language config
const languages = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "ar", name: "العربية", dir: "rtl" },
    { code: "he", name: "עברית", dir: "rtl" },
];

// Navigation items
const navItems = [
    { label: "Dashboard", icon: Home, href: "/" },
    { label: "Courses", icon: BookOpen, href: "/courses" },
    { label: "Recent", icon: History, href: "/recent" },
    { label: "Uploads", icon: Upload, href: "/uploads" },
    { label: "My Path", icon: Map, href: "/path" },
];

// Dynamic Breadcrumbs
const Breadcrumbs = () => {
    const location = useLocation();
    const pathnames = location.pathname.split("/").filter((x) => x);

    // Assuming paths like /courses/:courseId/files/:fileId
    const potentialCourseId = pathnames[0] === "courses" ? pathnames[1] : undefined;
    const potentialFileId = pathnames[2] === "files" ? pathnames[3] : undefined;

    const { data: course } = useCourse(potentialCourseId || "");
    const { data: file } = useFile(potentialFileId || "");

    const formatLabel = (value: string, index: number) => {
        if (index === 1 && potentialCourseId === value && course) {
            return course.code || course.name; 
        }
        if (index === 3 && potentialFileId === value && file) {
            // Trim extension if it's a file
            return file.title.replace(/\.[^/.]+$/, "");
        }

        if (value.startsWith("cs") || value.startsWith("math") || value.startsWith("phys")) {
            return value.toUpperCase();
        }
        
        // Return ID truncated if it's a UUID and nothing matched
        if (value.length > 20 && value.includes("-")) {
            return "Details";
        }

        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const nonClickablePaths = ["files"];

    return (
        <Breadcrumb>
            <BreadcrumbList className="gap-1.5 sm:gap-2">
                <BreadcrumbItem>
                    <BreadcrumbLink href="/" className="flex items-center gap-1.5 px-2 py-1 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-all text-xs sm:text-sm font-medium">
                        <Home className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Home</span>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {pathnames.length > 0 && <BreadcrumbSeparator className="text-white/20 rtl:rotate-180" />}
                {pathnames.map((value, index) => {
                    const to = `/${pathnames.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathnames.length - 1;
                    const isNonClickable = nonClickablePaths.includes(value);
                    const label = formatLabel(value, index);

                    return (
                        <div key={to} className="flex items-center gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                            <BreadcrumbItem>
                                {isLast || isNonClickable ? (
                                    <BreadcrumbPage className={`px-2 py-1 rounded-md text-xs sm:text-sm ${isNonClickable ? "text-white/40" : "text-white font-semibold bg-white/10 shadow-sm"}`}>
                                        {label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={to} className="px-2 py-1 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-all text-xs sm:text-sm font-medium">
                                        {label}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator className="text-white/20 rtl:rotate-180" />}
                        </div>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
};

// Glass Sidebar
function GlassSidebar() {
    const location = useLocation();
    const { user, signOut } = useAuth();

    const isActive = (path: string) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    return (
        <aside className="w-[260px] min-h-screen liquid-glass-heavy flex flex-col border-r border-white/[0.06] relative z-20">
            <div className="flex flex-col flex-1 px-6 py-8">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3.5 mb-10 group">
                    <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lg glow-purple-soft group-hover:scale-105 transition-transform">
                        <GraduationCap className="h-4.5 w-4.5 text-white" />
                    </div>
                    <span className="font-display text-[15px] font-bold text-white tracking-[0.15em] uppercase">
                        GeeksHub
                    </span>
                </Link>

                {/* Navigation */}
                <nav className="flex-1 space-y-0.5">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`flex items-center gap-4 px-3 py-3 rounded-xl text-[14px] transition-all group relative ${active
                                    ? "text-white bg-white/[0.1] border border-white/[0.1]"
                                    : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
                                    }`}
                            >
                                {active && (
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none" />
                                )}
                                <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : ""}`} />
                                <span className={`font-medium ${active ? "font-semibold" : ""}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Upgrade Card */}
                <div className="mt-auto pt-6 space-y-5">
                    <div className="liquid-glass-subtle rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                            <span className="text-[11px] font-display font-bold text-purple-400 uppercase tracking-[0.15em]">
                                Pro
                            </span>
                        </div>
                        <p className="text-[15px] font-display font-semibold text-white leading-tight">
                            Unlock AI Learning
                        </p>
                        <p className="text-[12px] text-white/40 leading-relaxed">
                            Get personalized paths, unlimited files & AI assistant.
                        </p>
                        <button className="w-full h-9 rounded-lg gradient-bg text-white text-[12px] font-display font-semibold hover:opacity-90 transition-opacity glow-purple-soft">
                            Activate Pro
                        </button>
                    </div>

                    {/* User */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-3 px-1 hover:bg-white/[0.04] p-2 rounded-xl transition-colors text-left w-full outline-none">
                                <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-white text-[13px] font-display font-semibold shrink-0">
                                    {user?.avatarInitials ?? "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-white truncate">{user?.displayName ?? "Guest"}</p>
                                    <p className="text-[11px] text-white/35 truncate">{user?.email ?? ""}</p>
                                </div>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 mb-2" align="start" side="right">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link to="/settings" className="cursor-pointer w-full">
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Settings</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500 focus:text-red-500 cursor-pointer" onClick={signOut}>
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </aside>
    );
}

export default function AppShell() {
    useEffect(() => {
        const savedLang = localStorage.getItem("language") || "en";
        const selectedLang = languages.find((l) => l.code === savedLang);
        if (selectedLang) {
            document.documentElement.lang = selectedLang.code;
            document.documentElement.dir = selectedLang.dir;
        }
    }, []);

    return (
        <div className="flex h-screen overflow-hidden relative">
            {/* Animated Mesh Background */}
            <div className="mesh-background">
                <div className="mesh-orb mesh-orb-1" />
                <div className="mesh-orb mesh-orb-2" />
            </div>

            {/* Sidebar */}
            <GlassSidebar />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Glass Header */}
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 px-8 liquid-glass border-b border-white/[0.06] border-t-0 border-x-0">
                    <Breadcrumbs />
                    <div className="ms-auto flex items-center gap-2">
                        <button
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all text-[13px]"
                            onClick={() =>
                                document.dispatchEvent(
                                    new KeyboardEvent("keydown", { key: "k", metaKey: true })
                                )
                            }
                        >
                            <Search className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Search</span>
                            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] text-white/30">
                                {isMac ? "⌘K" : "Ctrl+K"}
                            </kbd>
                        </button>
                        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all">
                            <Bell className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                {/* Content 
                This is the most important part. It's a React Router placeholder — it says "render whatever the current route's page component is, right here."
                So when you navigate to /dashboard, React Router puts <Dashboard /> in place of <Outlet />.
                When you navigate to /courses, it puts <CourseBrowser /> there instead.
                The sidebar and header never re-render — only this slot swaps out.
                */}
                <main className="flex-1 overflow-auto">
                    <div className="max-w-[1400px] mx-auto py-8 px-8">
                        <Outlet />
                    </div>
                </main>
            </div>

            <CommandPalette />
        </div>
    );
}
