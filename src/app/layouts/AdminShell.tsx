/**
 * ============================================================================
 * ADMIN SHELL / LAYOUT
 * ============================================================================
 *
 * Mirrors AppShell's Liquid Glass design system with admin-specific navigation.
 * Provides: glass sidebar, breadcrumbs, top bar, search, notifications,
 * user profile dropdown, command palette, and mobile hamburger menu.
 *
 * Uses a separate localStorage key ("admin_sidebar_collapsed") so the admin
 * sidebar can have its own collapse state independent of the main app sidebar.
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
    Home, ClipboardList, FileSearch, BookOpen, Layers,
    Bell, Search, GraduationCap,
    PanelLeftClose, PanelLeftOpen, Menu, Settings, ArrowLeft,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommandPalette } from "@/shared/components/CommandPalette";
import { isMac } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// -- Static config -------------------------------------------------------------

const languages = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "ar", name: "???????", dir: "rtl" },
    { code: "he", name: "?????", dir: "rtl" },
];

const adminNavItems = [
    { label: "Overview", icon: Home, href: "/admin" },
    { label: "Queue", icon: ClipboardList, href: "/admin/requests" },
    { label: "Audit Log", icon: FileSearch, href: "/admin/audit" },
];

const directoryNavItems = [
    { label: "Majors", icon: Layers, href: "/admin/majors" },
    { label: "Lecturers", icon: GraduationCap, href: "/admin/lecturers" },
    { label: "Courses", icon: BookOpen, href: "/admin/courses" },
];

const adminLabelMap: Record<string, string> = {
    admin: "Admin",
    requests: "Queue",
    audit: "Audit Log",
    majors: "Majors",
    lecturers: "Lecturers",
    courses: "Courses",
};

// -- Admin Breadcrumbs ---------------------------------------------------------

const AdminBreadcrumbs = () => {
    const location = useLocation();
    const pathnames = location.pathname.split("/").filter((x) => x);

    return (
        <Breadcrumb>
            <BreadcrumbList className="gap-1.5 sm:gap-2">
                <BreadcrumbItem>
                    <BreadcrumbLink
                        href="/"
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all text-xs sm:text-sm font-medium"
                    >
                        <Home className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Home</span>
                    </BreadcrumbLink>
                </BreadcrumbItem>

                {pathnames.length > 0 && (
                    <BreadcrumbSeparator className="text-muted-foreground/30 rtl:rotate-180" />
                )}

                {pathnames.map((value, index) => {
                    const to = `/${pathnames.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathnames.length - 1;
                    const label =
                        adminLabelMap[value] ||
                        value.charAt(0).toUpperCase() + value.slice(1);

                    return (
                        <div
                            key={to}
                            className="flex items-center gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
                        >
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage className="px-2 py-1 rounded-md text-xs sm:text-sm text-foreground font-semibold bg-foreground/10">
                                        {label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink
                                        href={to}
                                        className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all text-xs sm:text-sm font-medium"
                                    >
                                        {label}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && (
                                <BreadcrumbSeparator className="text-muted-foreground/30 rtl:rotate-180" />
                            )}
                        </div>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
};

// -- Admin Glass Sidebar -------------------------------------------------------

function AdminGlassSidebar({
    collapsed,
    onToggle,
}: {
    collapsed: boolean;
    onToggle: () => void;
}) {
    const location = useLocation();
    const { user, signOut } = useAuth();

    const isActive = (path: string) =>
        path === "/admin"
            ? location.pathname === "/admin"
            : location.pathname.startsWith(path);

    const initials = user?.displayName
        ? user.displayName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
        : "?";

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={`
                    min-h-screen liquid-glass-heavy flex flex-col border-r border-border
                    relative z-20 transition-[width,background-color] duration-300 ease-in-out
                    ${collapsed ? "w-[68px]" : "w-[260px]"}
                `}
            >
                <div className="flex flex-col flex-1 px-3 py-6">
                    {/* Logo + collapse toggle */}
                    <div
                        className={`flex items-center mb-8 ${
                            collapsed ? "justify-center" : "justify-between px-1"
                        }`}
                    >
                        {!collapsed && (
                            <Link to="/" className="flex items-center gap-3 group">
                                <div className="w-8 h-8 rounded-xl gradient-bg flex items-center justify-center shadow-lg glow-blue-soft group-hover:scale-105 transition-transform shrink-0">
                                    <GraduationCap className="h-4 w-4 text-foreground" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-display text-[14px] font-bold text-foreground tracking-[0.15em] uppercase">
                                        GeeksHub
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="text-[9px] px-1.5 py-0 border-rose-500/30 text-rose-400 font-semibold uppercase tracking-wider"
                                    >
                                        Admin
                                    </Badge>
                                </div>
                            </Link>
                        )}

                        {collapsed && (
                            <Link
                                to="/"
                                className="w-8 h-8 rounded-xl gradient-bg flex items-center justify-center shadow-lg glow-blue-soft hover:scale-105 transition-transform relative"
                            >
                                <GraduationCap className="h-4 w-4 text-foreground" />
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 border border-[hsl(225,30%,5%)]" />
                            </Link>
                        )}

                        {!collapsed && (
                            <button
                                onClick={onToggle}
                                className="w-11 h-11 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/5 transition-colors -mr-2"
                                aria-label="Close sidebar"
                            >
                                <PanelLeftClose className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    {collapsed && (
                        <button
                            onClick={onToggle}
                            className="w-11 h-11 mx-auto rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-foreground/60 hover:bg-foreground/5 transition-all mb-4"
                            aria-label="Open sidebar"
                        >
                            <PanelLeftOpen className="h-5 w-5" />
                        </button>
                    )}

                    {/* Back to App link */}
                    {(() => {
                        const backLink = (
                            <Link
                                to="/"
                                className={`
                                    flex items-center rounded-xl text-[14px] transition-all group relative mb-4
                                    ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-4 px-3 py-2.5"}
                                    text-muted-foreground hover:text-foreground/75 hover:bg-foreground/5
                                `}
                            >
                                <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
                                {!collapsed && (
                                    <span className="font-medium">Back to App</span>
                                )}
                            </Link>
                        );
                        if (collapsed) {
                            return (
                                <Tooltip>
                                    <TooltipTrigger asChild>{backLink}</TooltipTrigger>
                                    <TooltipContent side="right" className="text-xs">
                                        Back to App
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }
                        return backLink;
                    })()}

                    {/* Moderation section label */}
                    {!collapsed && (
                        <div className="px-3 mb-2">
                            <span className="text-[11px] font-display font-semibold text-muted-foreground/50 uppercase tracking-[0.15em]">
                                Moderation
                            </span>
                        </div>
                    )}

                    {/* Navigation */}
                    <nav className="flex-1 space-y-0.5">
                        {adminNavItems.map((item) => {
                            const active = isActive(item.href);
                            const Icon = item.icon;

                            const linkContent = (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={`
                                        flex items-center rounded-xl text-[14px] transition-all group relative
                                        ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-4 px-3 py-2.5"}
                                        ${
                                            active
                                                ? "text-blue-300 bg-blue-500/[0.08] border border-blue-500/[0.12]"
                                                : "text-muted-foreground hover:text-foreground/75 hover:bg-foreground/5"
                                        }
                                    `}
                                >
                                    {active && (
                                        <div className="absolute inset-0 rounded-xl bg-blue-500/10 pointer-events-none" />
                                    )}
                                    <Icon
                                        className={`h-[18px] w-[18px] shrink-0 ${
                                            active ? "text-blue-300" : ""
                                        }`}
                                    />
                                    {!collapsed && (
                                        <span
                                            className={`font-medium ${
                                                active ? "font-semibold" : ""
                                            }`}
                                        >
                                            {item.label}
                                        </span>
                                    )}
                                </Link>
                            );

                            if (collapsed) {
                                return (
                                    <Tooltip key={item.href}>
                                        <TooltipTrigger asChild>
                                            {linkContent}
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="text-xs">
                                            {item.label}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }
                            return linkContent;
                        })}

                        {/* Directory section */}
                        {!collapsed && (
                            <div className="px-3 mt-6 mb-2">
                                <span className="text-[11px] font-display font-semibold text-muted-foreground/50 uppercase tracking-[0.15em]">
                                    Directory
                                </span>
                            </div>
                        )}
                        {collapsed && <div className="h-4" />}

                        {directoryNavItems.map((item) => {
                            const active = isActive(item.href);
                            const Icon = item.icon;

                            const linkContent = (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={`
                                        flex items-center rounded-xl text-[14px] transition-all group relative
                                        ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-4 px-3 py-2.5"}
                                        ${
                                            active
                                                ? "text-blue-300 bg-blue-500/[0.08] border border-blue-500/[0.12]"
                                                : "text-muted-foreground hover:text-foreground/75 hover:bg-foreground/5"
                                        }
                                    `}
                                >
                                    {active && (
                                        <div className="absolute inset-0 rounded-xl bg-blue-500/10 pointer-events-none" />
                                    )}
                                    <Icon
                                        className={`h-[18px] w-[18px] shrink-0 ${active ? "text-blue-300" : ""}`}
                                    />
                                    {!collapsed && (
                                        <span className={`font-medium ${active ? "font-semibold" : ""}`}>
                                            {item.label}
                                        </span>
                                    )}
                                </Link>
                            );

                            if (collapsed) {
                                return (
                                    <Tooltip key={item.href}>
                                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                                        <TooltipContent side="right" className="text-xs">
                                            {item.label}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }
                            return linkContent;
                        })}
                    </nav>

                    {/* Bottom section � user profile */}
                    <div className="mt-auto pt-5 space-y-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className={`
                                        flex items-center hover:bg-foreground/5 rounded-xl transition-colors outline-none w-full
                                        ${collapsed ? "justify-center p-1" : "gap-3 px-2 py-2"}
                                    `}
                                >
                                    <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-foreground text-[12px] font-display font-semibold shrink-0">
                                        {initials}
                                    </div>
                                    {!collapsed && (
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-[13px] font-medium text-foreground truncate">
                                                {user?.displayName ?? "Admin"}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground/70 truncate">
                                                {user?.email ?? ""}
                                            </p>
                                        </div>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-56 mb-2"
                                align={collapsed ? "center" : "start"}
                                side="right"
                            >
                                <DropdownMenuLabel>
                                    <p className="font-medium">
                                        {user?.displayName ?? "Admin"}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-normal">
                                        {user?.email}
                                    </p>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link
                                        to="/settings"
                                        className="cursor-pointer w-full"
                                    >
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Settings</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-500 focus:text-red-500 cursor-pointer"
                                    onClick={signOut}
                                >
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    );
}

// -- Admin Shell ---------------------------------------------------------------

export default function AdminShell() {
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        return localStorage.getItem("admin_sidebar_collapsed") === "true";
    });

    const handleToggle = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("admin_sidebar_collapsed", String(next));
            return next;
        });
    };

    // Keyboard shortcut: Cmd+B / Ctrl+B toggles sidebar
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleToggle();
            }
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, []);

    // Language / RTL � same logic as AppShell
    useEffect(() => {
        const savedLang = localStorage.getItem("language") || "en";
        const lang = languages.find((l) => l.code === savedLang);
        if (lang) {
            document.documentElement.lang = lang.code;
            document.documentElement.dir = lang.dir;
        }
    }, []);

    return (
        <div className="flex h-screen overflow-hidden relative">
            <a
                href="#admin-main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-foreground focus:rounded-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
            >
                Skip to main content
            </a>

            {/* Sidebar � hidden on mobile */}
            <div className="hidden lg:block relative z-20">
                <AdminGlassSidebar
                    collapsed={collapsed}
                    onToggle={handleToggle}
                />
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden w-full relative z-10">
                {/* Glass header */}
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 px-4 lg:px-8 liquid-glass border-b border-border border-t-0 border-x-0">
                    <div className="lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <button
                                    className="w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all -ml-2"
                                    aria-label="Open admin menu"
                                >
                                    <Menu className="h-5 w-5" />
                                </button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="w-[260px] p-0 border-r border-border liquid-glass-heavy text-foreground"
                            >
                                <SheetTitle className="sr-only">
                                    Admin Navigation
                                </SheetTitle>
                                <AdminGlassSidebar
                                    collapsed={false}
                                    onToggle={() => {}}
                                />
                            </SheetContent>
                        </Sheet>
                    </div>

                    <AdminBreadcrumbs />

                    <div className="ms-auto flex items-center gap-2">
                        <button
                            className="flex flex-1 items-center gap-2 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground/70 hover:bg-foreground/5 transition-all text-[13px] min-h-[44px] sm:min-h-0"
                            onClick={() =>
                                document.dispatchEvent(
                                    new KeyboardEvent("keydown", {
                                        key: "k",
                                        metaKey: true,
                                    }),
                                )
                            }
                            aria-label="Search"
                        >
                            <Search
                                className="h-4 w-4 sm:h-3.5 sm:w-3.5"
                                aria-hidden="true"
                            />
                            <span className="hidden sm:inline">Search</span>
                            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border/50 bg-foreground/5 px-1.5 font-mono text-[10px] text-muted-foreground/50">
                                {isMac ? "?K" : "Ctrl+K"}
                            </kbd>
                        </button>
                        <button
                            className="relative w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground/70 hover:bg-foreground/5 transition-colors"
                            aria-label="Notifications"
                        >
                            <Bell
                                className="h-5 w-5 sm:h-4 sm:w-4"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main
                    id="admin-main-content"
                    className="flex-1 overflow-auto"
                    tabIndex={-1}
                >
                    <div className="max-w-[1400px] mx-auto py-6 px-4 lg:py-8 lg:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>

            <CommandPalette />
        </div>
    );
}
