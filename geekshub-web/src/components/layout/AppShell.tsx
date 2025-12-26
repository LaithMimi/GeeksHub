import { useEffect } from "react";
import { Home, Search, History, Settings, GraduationCap, Command, BookOpen, FileText, ChevronRight } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarTrigger,
    SidebarInset,
} from "@/components/ui/sidebar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "../ui/command-palette";

// Data for language persistence (duplicated from Settings for init, or could be in a shared lib)
const languages = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "ar", name: "العربية", dir: "rtl" },
    { code: "he", name: "עברית", dir: "rtl" },
];

// Dynamic Breadcrumbs Component
const Breadcrumbs = () => {
    const location = useLocation();
    const pathnames = location.pathname.split("/").filter((x) => x);

    const formatLabel = (value: string) => {
        // Handle special cases
        if (value.startsWith("cs") || value.startsWith("math") || value.startsWith("phys")) {
            return value.toUpperCase();
        }
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    // Paths that should not be clickable (folders/categories without index pages)
    const nonClickablePaths = ["files"];

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink href="/" className="flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5" />
                        Home
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {pathnames.length > 0 && <BreadcrumbSeparator className="rtl:rotate-180" />}
                {pathnames.map((value, index) => {
                    const to = `/${pathnames.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathnames.length - 1;
                    const isNonClickable = nonClickablePaths.includes(value);

                    return (
                        <div key={to} className="flex items-center gap-2">
                            <BreadcrumbItem>
                                {isLast || isNonClickable ? (
                                    <BreadcrumbPage className={isNonClickable ? "text-muted-foreground font-normal" : ""}>
                                        {formatLabel(value)}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={to}>{formatLabel(value)}</BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator className="rtl:rotate-180" />}
                        </div>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

function AppSidebar() {
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    return (
        <Sidebar variant="inset" collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link to="/">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg gradient-bg">
                                    <GraduationCap className="h-4 w-4 text-white" />
                                </div>
                                <div className="grid flex-1 text-start text-sm leading-tight">
                                    <span className="truncate font-semibold">GeeksHub</span>
                                    <span className="truncate text-xs text-muted-foreground">AI Study Workspace</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Search (⌘K)">
                                    <button onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
                                        <Search className="h-4 w-4" />
                                        <span>Search</span>
                                        <kbd className="ms-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                            <span className="text-xs">⌘</span>K
                                        </kbd>
                                    </button>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Dashboard" isActive={isActive("/")}>
                                    <Link to="/">
                                        <Home className="h-4 w-4" />
                                        <span>Dashboard</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Recent" isActive={isActive("/recent")}>
                                    <Link to="/recent">
                                        <History className="h-4 w-4" />
                                        <span>Recent</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Courses" isActive={isActive("/courses")}>
                                    <Link to="/courses">
                                        <BookOpen className="h-4 w-4" />
                                        <span>Courses</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <Collapsible asChild defaultOpen className="group/collapsible">
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton tooltip="File Requests">
                                            <FileText className="h-4 w-4" />
                                            <span>File Requests</span>
                                            <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            <SidebarMenuSubItem>
                                                <SidebarMenuSubButton asChild isActive={isActive("/uploads")}>
                                                    <Link to="/uploads">
                                                        <span>My Uploads</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                            <SidebarMenuSubItem>
                                                <SidebarMenuSubButton asChild>
                                                    <Link to="/uploads">
                                                        <span>Recent Requests</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup className="mt-auto">
                    <SidebarGroupLabel>Account</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Settings" isActive={isActive("/settings")}>
                                    <Link to="/settings">
                                        <Settings className="h-4 w-4" />
                                        <span>Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-2">
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                            S
                        </div>
                        <div className="flex-1 truncate text-sm text-start">
                            <p className="font-medium truncate">Student</p>
                            <p className="text-xs text-muted-foreground truncate">student@university.edu</p>
                        </div>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

export default function AppShell() {
    // Global Language Persistence Init
    useEffect(() => {
        const savedLang = localStorage.getItem("language") || "en";
        const selectedLang = languages.find(l => l.code === savedLang);
        if (selectedLang) {
            document.documentElement.lang = selectedLang.code;
            document.documentElement.dir = selectedLang.dir;
        }
    }, []);

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
                    <SidebarTrigger className="-ms-1" />
                    <Separator orientation="vertical" className="me-2 h-4" />
                    <Breadcrumbs />
                    <div className="ms-auto flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                            <Command className="h-4 w-4" />
                            <span className="hidden sm:inline">Search...</span>
                            <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                ⌘K
                            </kbd>
                        </Button>
                    </div>
                </header>
                <main className="flex-1 overflow-auto">
                    <div className="container max-w-6xl mx-auto py-6 px-4">
                        <Outlet />
                    </div>
                </main>
                <CommandPalette />
            </SidebarInset>
        </SidebarProvider>
    );
}
