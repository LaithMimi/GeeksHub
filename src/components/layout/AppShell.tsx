/**
 * ============================================================================
 * APP SHELL / LAYOUT
 * ============================================================================
 *
 * Provides the collapsible glass sidebar, breadcrumbs, and top bar.
 *
 * Sidebar state (expanded / collapsed) is persisted to localStorage under
 * the key "sidebar_collapsed" so the user's preference survives refreshes.
 *
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 *
 * 1. User Profile Display:
 *    user.name and user.email come from AuthContext (GET /api/v1/me).
 *    Initials are derived from user.name — no avatarInitials field exists.
 *
 * 2. Notification Badge:
 *    GET /api/v1/me/notifications/unread-count → { count: number }
 *    Poll every 30s. Wire into the Bell button when endpoint is ready.
 *
 * 3. Conditional Admin Link:
 *    Admin nav item is shown only when user.role === "ADMIN".
 *
 * 4. Language preference:
 *    Currently reads from localStorage. After Settings backend is connected,
 *    read from GET /api/v1/me/settings instead.
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    Home, History, Settings, BookOpen, Upload,
    Bell, Search, GraduationCap, Sparkles,
    PanelLeftClose, PanelLeftOpen, Shield, Menu,
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
import { CommandPalette } from "../ui/command-palette";
import { isMac } from "@/lib/utils";
import { useCourse } from "@/queries/useCatalog";
import { useFile } from "@/queries/useFiles";

// ── Static config ─────────────────────────────────────────────────────────────

const languages = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "ar", name: "العربية", dir: "rtl" },
    { code: "he", name: "עברית", dir: "rtl" },
];

const navItems = [
    { label: "Dashboard", icon: Home, href: "/" },
    { label: "Courses", icon: BookOpen, href: "/courses" },
    { label: "Recent", icon: History, href: "/recent" },
    { label: "Uploads", icon: Upload, href: "/uploads" },
];

// ── Dynamic Breadcrumbs ───────────────────────────────────────────────────────

const Breadcrumbs = () => {
    const location = useLocation();
    const pathnames = location.pathname.split("/").filter((x) => x);

    const matchCourse = pathnames[0] === "courses" ? pathnames[1] : undefined;
    const potentialCourseId = matchCourse === "undefined" ? "" : (matchCourse || "");

    const matchFile = pathnames[2] === "files" ? pathnames[3] : undefined;
    const potentialFileId = matchFile === "undefined" ? "" : (matchFile || "");

    const { data: course } = useCourse(potentialCourseId);
    const { data: file } = useFile(potentialFileId);

    const formatLabel = (value: string, index: number) => {
        if (index === 1 && potentialCourseId === value && course) return course.code || course.name;
        if (index === 3 && potentialFileId === value && file) return file.title.replace(/\.[^/.]+$/, "");
        if (value.startsWith("cs") || value.startsWith("math") || value.startsWith("phys")) return value.toUpperCase();
        if (value.length > 20 && value.includes("-")) return "Details";
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const nonClickable = ["files"];

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
                    const isNonCl = nonClickable.includes(value);
                    const label = formatLabel(value, index);
                    return (
                        <div key={to} className="flex items-center gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                            <BreadcrumbItem>
                                {isLast || isNonCl ? (
                                    <BreadcrumbPage className={`px-2 py-1 rounded-md text-xs sm:text-sm ${isNonCl ? "text-white/40" : "text-white font-semibold bg-white/10"}`}>
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

// ── Glass Sidebar ─────────────────────────────────────────────────────────────

function GlassSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const location = useLocation();
    const { user, signOut } = useAuth();

    const isActive = (path: string) =>
        path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

    const initials = user?.displayName
        ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : "?";

    const isAdmin = user?.role === "ADMIN";

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={`
                    min-h-screen liquid-glass-heavy flex flex-col border-r border-white/[0.06]
                    relative z-20 transition-all duration-300 ease-in-out
                    ${collapsed ? "w-[68px]" : "w-[260px]"}
                `}
            >
                <div className="flex flex-col flex-1 px-3 py-6">

                    {/* Logo + collapse toggle */}
                    <div className={`flex items-center mb-8 ${collapsed ? "justify-center" : "justify-between px-1"}`}>
                        {!collapsed && (
                            <Link to="/" className="flex items-center gap-3 group">
                                <div className="w-8 h-8 rounded-xl gradient-bg flex items-center justify-center shadow-lg glow-purple-soft group-hover:scale-105 transition-transform shrink-0">
                                    <GraduationCap className="h-4 w-4 text-white" />
                                </div>
                                <span className="font-display text-[14px] font-bold text-white tracking-[0.15em] uppercase">
                                    GeeksHub
                                </span>
                            </Link>
                        )}

                        {collapsed && (
                            <Link to="/" className="w-8 h-8 rounded-xl gradient-bg flex items-center justify-center shadow-lg glow-purple-soft hover:scale-105 transition-transform">
                                <GraduationCap className="h-4 w-4 text-white" />
                            </Link>
                        )}

                        {/* Close sidebar button — expanded state */}
                        {!collapsed && (
                            <button
                                onClick={onToggle}
                                className="w-11 h-11 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all -mr-2"
                                aria-label="Close sidebar"
                            >
                                <PanelLeftClose className="h-5 w-5" />
                            </button>
                        )}
                    </div>

                    {/* Open sidebar button — collapsed state */}
                    {collapsed && (
                        <button
                            onClick={onToggle}
                            className="w-11 h-11 mx-auto rounded-lg flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-all mb-4"
                            aria-label="Open sidebar"
                        >
                            <PanelLeftOpen className="h-5 w-5" />
                        </button>
                    )}

                    {/* Navigation */}
                    <nav className="flex-1 space-y-0.5">
                        {navItems.map((item) => {
                            const active = isActive(item.href);
                            const Icon = item.icon;

                            const linkContent = (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={`
                                        flex items-center rounded-xl text-[14px] transition-all group relative
                                        ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-4 px-3 py-2.5"}
                                        ${active
                                            ? "text-purple-300 bg-purple-500/[0.08] border border-purple-500/[0.12]"
                                            : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
                                        }
                                    `}
                                >
                                    {active && (
                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none" />
                                    )}
                                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-purple-300" : ""}`} />
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
                                        <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                                    </Tooltip>
                                );
                            }
                            return linkContent;
                        })}

                        {/* Admin link — only shown to admins */}
                        {isAdmin && (() => {
                            const adminLink = (
                                <Link
                                    to="/admin"
                                    className={`
                                        flex items-center rounded-xl text-[14px] transition-all group relative mt-1
                                        ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-4 px-3 py-2.5"}
                                        ${isActive("/admin")
                                            ? "text-rose-300 bg-rose-500/[0.08] border border-rose-500/[0.12]"
                                            : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
                                        }
                                    `}
                                >
                                    <Shield className={`h-[18px] w-[18px] shrink-0 ${isActive("/admin") ? "text-rose-300" : "text-rose-400/80 group-hover:text-rose-400"}`} />
                                    {!collapsed && <span className={`font-medium ${isActive("/admin") ? "text-rose-300 font-semibold" : "text-rose-400/80 group-hover:text-rose-400"}`}>Admin</span>}
                                </Link>
                            );

                            if (collapsed) {
                                return (
                                    <Tooltip key="admin">
                                        <TooltipTrigger asChild>{adminLink}</TooltipTrigger>
                                        <TooltipContent side="right" className="text-xs">Admin Panel</TooltipContent>
                                    </Tooltip>
                                );
                            }
                            return adminLink;
                        })()}
                    </nav>

                    {/* Bottom section */}
                    <div className="mt-auto pt-5 space-y-3">

                        {/* Pro card — only when expanded */}
                        {!collapsed && (
                            <div className="liquid-glass-subtle rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                                    <span className="text-[11px] font-display font-bold text-purple-400 uppercase tracking-[0.15em]">Pro</span>
                                </div>
                                <p className="text-[14px] font-display font-semibold text-white leading-tight">Unlock AI Learning</p>
                                <p className="text-[11px] text-white/40 leading-relaxed">Personalized paths, unlimited files & AI assistant.</p>
                                <button className="w-full h-8 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-display font-semibold transition-all">
                                    Activate Pro
                                </button>
                            </div>
                        )}

                        {/* Pro icon when collapsed */}
                        {collapsed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button className="w-10 h-10 mx-auto rounded-xl gradient-bg flex items-center justify-center glow-purple-soft hover:opacity-90 transition-opacity">
                                        <Sparkles className="h-4 w-4 text-white" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="text-xs">Unlock Pro</TooltipContent>
                            </Tooltip>
                        )}

                        {/* User profile */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className={`
                                    flex items-center hover:bg-white/[0.04] rounded-xl transition-colors outline-none w-full
                                    ${collapsed ? "justify-center p-1" : "gap-3 px-2 py-2"}
                                `}>
                                    <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-white text-[12px] font-display font-semibold shrink-0">
                                        {initials}
                                    </div>
                                    {!collapsed && (
                                        <div className="flex-1 min-w-0 text-left">
                                            {/* user.name is the correct field — displayName doesn't exist */}
                                            <p className="text-[13px] font-medium text-white truncate">{user?.displayName ?? "Guest"}</p>
                                            <p className="text-[11px] text-white/35 truncate">{user?.email ?? ""}</p>
                                        </div>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 mb-2" align={collapsed ? "center" : "start"} side="right">
                                <DropdownMenuLabel>
                                    <p className="font-medium">{user?.displayName ?? "Guest"}</p>
                                    <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                                </DropdownMenuLabel>
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
        </TooltipProvider>
    );
}

// ── App Shell ─────────────────────────────────────────────────────────────────

export default function AppShell() {
    // Persist collapse state across sessions
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        return localStorage.getItem("sidebar_collapsed") === "true";
    });

    const handleToggle = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("sidebar_collapsed", String(next));
            return next;
        });
    };

    // Keyboard shortcut: Cmd+B / Ctrl+B toggles sidebar (mirrors VS Code / Linear)
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

    // Language / RTL
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
                href="#main-content" 
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
            >
                Skip to main content
            </a>

            {/* Sidebar - hidden on mobile */}
            <div className="hidden lg:block relative z-20">
                <GlassSidebar collapsed={collapsed} onToggle={handleToggle} />
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden w-full relative z-10">

                {/* Glass header */}
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 px-4 lg:px-8 liquid-glass border-b border-white/[0.06] border-t-0 border-x-0">
                    <div className="lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <button className="w-11 h-11 flex items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white transition-all -ml-2" aria-label="Open mobile menu">
                                    <Menu className="h-5 w-5" />
                                </button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[260px] p-0 border-r border-white/[0.06] liquid-glass-heavy text-white">
                                <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
                                <GlassSidebar collapsed={false} onToggle={() => {}} />
                            </SheetContent>
                        </Sheet>
                    </div>
                    <Breadcrumbs />
                    <div className="ms-auto flex items-center gap-2">
                        <button
                            className="flex flex-1 items-center gap-2 px-3 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all text-[13px] min-h-[44px] sm:min-h-0"
                            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                            aria-label="Search"
                        >
                            <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Search</span>
                            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] text-white/30">
                                {isMac ? "⌘K" : "Ctrl+K"}
                            </kbd>
                        </button>
                        <button 
                            className="relative w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                            aria-label="Notifications"
                        >
                            <Bell className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
                            {/* Notification badge — wire to GET /api/v1/me/notifications/unread-count when ready */}
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
                    <div className="max-w-[1400px] mx-auto py-6 px-4 lg:py-8 lg:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>

            <CommandPalette />
        </div>
    );
}