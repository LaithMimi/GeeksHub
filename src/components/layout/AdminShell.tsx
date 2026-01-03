import { useEffect } from "react";
import { Home, ClipboardList, FileSearch, Shield, AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { DEMO_ADMIN } from "@/mock/mock-db";

function AdminSidebar() {
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === "/admin") return location.pathname === "/admin";
        return location.pathname.startsWith(path);
    };

    return (
        <Sidebar variant="inset" collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link to="/admin">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-red-600">
                                    <Shield className="h-4 w-4 text-white" />
                                </div>
                                <div className="grid flex-1 text-start text-sm leading-tight">
                                    <span className="truncate font-semibold">Admin Panel</span>
                                    <span className="truncate text-xs text-muted-foreground">GeeksHub Moderation</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Moderation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Dashboard" isActive={isActive("/admin") && location.pathname === "/admin"}>
                                    <Link to="/admin">
                                        <Home className="h-4 w-4" />
                                        <span>Dashboard</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Moderation Queue" isActive={isActive("/admin/requests")}>
                                    <Link to="/admin/requests">
                                        <ClipboardList className="h-4 w-4" />
                                        <span>Queue</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Audit Log" isActive={isActive("/admin/audit")}>
                                    <Link to="/admin/audit">
                                        <FileSearch className="h-4 w-4" />
                                        <span>Audit Log</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Management</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Catalog (Coming Soon)" disabled className="opacity-50 cursor-not-allowed">
                                    <span className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>Catalog</span>
                                        <Badge variant="outline" className="text-[10px] ml-auto">Soon</Badge>
                                    </span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Users (Coming Soon)" disabled className="opacity-50 cursor-not-allowed">
                                    <span className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>Users</span>
                                        <Badge variant="outline" className="text-[10px] ml-auto">Soon</Badge>
                                    </span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-2">
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-sm font-medium">
                            A
                        </div>
                        <div className="flex-1 truncate text-sm text-start">
                            <p className="font-medium truncate">{DEMO_ADMIN.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{DEMO_ADMIN.role}</p>
                        </div>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

export default function AdminShell() {
    // RTL support
    useEffect(() => {
        const savedLang = localStorage.getItem("language") || "en";
        const dir = savedLang === "ar" || savedLang === "he" ? "rtl" : "ltr";
        document.documentElement.dir = dir;
    }, []);

    return (
        <SidebarProvider>
            <AdminSidebar />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
                    <SidebarTrigger className="-ms-1" />
                    <Separator orientation="vertical" className="me-2 h-4" />
                    <div className="flex items-center gap-2">
                        <Link to="/admin" className="font-semibold text-sm">Admin Panel</Link>
                    </div>
                    <div className="ms-auto flex items-center gap-2">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Mock Data
                        </Badge>
                        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            ← Back to App
                        </Link>
                    </div>
                </header>
                <main className="flex-1 overflow-auto">
                    <div className="container max-w-7xl mx-auto py-6 px-4">
                        <Outlet />
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
