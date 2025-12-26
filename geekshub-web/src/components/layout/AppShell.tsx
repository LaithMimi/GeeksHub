import { Home, Search, History, Settings, GraduationCap, Command, BookOpen } from "lucide-react";
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
    SidebarProvider,
    SidebarTrigger,
    SidebarInset,
} from "@/components/ui/sidebar";
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
                {pathnames.length > 0 && <BreadcrumbSeparator />}
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
                            {!isLast && <BreadcrumbSeparator />}
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
                                <div className="grid flex-1 text-left text-sm leading-tight">
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
                                <SidebarMenuButton asChild tooltip="Dashboard" isActive={isActive("/")}>
                                    <Link to="/">
                                        <Home className="h-4 w-4" />
                                        <span>Dashboard</span>
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
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Search (⌘K)">
                                    <button onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
                                        <Search className="h-4 w-4" />
                                        <span>Search</span>
                                        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                            <span className="text-xs">⌘</span>K
                                        </kbd>
                                    </button>
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
                        <div className="flex-1 truncate text-sm">
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
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumbs />
                    <div className="ml-auto flex items-center gap-2">
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
