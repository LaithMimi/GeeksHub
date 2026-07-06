import { useAuth } from "@/features/auth/context/AuthContext";
import { useMajors } from "@/features/courses/hooks/useCatalog";
import { useReputation } from "@/features/gamification/hooks/useReputation";
import { useMyRequests } from "@/features/files/hooks/useRequests";
import { useActivitySummary } from "@/features/gamification/hooks/useLearningPath";
import { authService } from "@/features/auth/api/authService";
import { formatDate } from "@/lib/formatDate";
import { toast } from "sonner";
import {
    Mail,
    GraduationCap,
    Award,
    Clock,
    UploadCloud,
    CheckCircle2,
    XCircle,
    KeyRound,
    LogOut,
    ShieldAlert,
    ChevronRight,
    TrendingUp,
    FileText,
    Sparkles
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import React, { useState, useCallback } from "react";

/**
 * Reusable flat Section component
 */
const ProfileSection = ({
    title,
    icon: Icon,
    description,
    children,
    headerColor = "text-violet-500 dark:text-violet-400"
}: {
    title: string;
    icon: React.ElementType;
    description: string;
    children: React.ReactNode;
    headerColor?: string;
}) => (
    <section className="flex flex-col gap-6 pt-6 first:pt-0 border-t border-border mt-6 first:border-0 first:mt-0">
        <header className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-muted/50 border border-border ${headerColor}`}>
                    <Icon size={20} />
                </div>
                <h2 className="text-xl font-semibold text-foreground tracking-tight">{title}</h2>
            </div>
            <p className="text-sm text-muted-foreground sm:ml-11">{description}</p>
        </header>

        <div className="w-full sm:ml-11">
            {children}
        </div>
    </section>
);

export default function UserProfile() {
    const { user, signOut } = useAuth();
    const { data: majors } = useMajors();
    const { data: reputation } = useReputation(user?.id || "");
    const { data: activity } = useActivitySummary();
    const { data: uploads } = useMyRequests();

    const [isResetLoading, setIsResetLoading] = useState(false);

    // Password reset handler
    const handlePasswordReset = useCallback(async () => {
        if (!user) return;
        setIsResetLoading(true);
        try {
            await authService.requestPasswordReset(user.email);
            toast.success("Password reset email sent. Check your inbox.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send reset email.");
        } finally {
            setIsResetLoading(false);
        }
    }, [user]);

    // Sign out handler
    const handleSignOut = useCallback(() => {
        signOut();
    }, [signOut]);

    if (!user) return null;

    const userMajor = majors?.find(m => m.id === user.majorId)?.name || "Undecided Major";

    // Stats computation
    const pendingUploads = uploads?.filter(u => u.status === "pending").length || 0;
    const approvedUploads = uploads?.filter(u => u.status === "approved").length || 0;
    const totalUploads = uploads?.length || 0;

    return (
        <div className="min-h-full w-full flex flex-col overflow-x-hidden p-6 sm:p-10 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Ambient Glow */}
            <div className="fixed top-0 left-0 right-0 h-[300px] bg-violet-600/10 blur-[120px] pointer-events-none -z-10" />

            <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">

                {/* 1. PROFILE HEADER */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-border">
                    {/* Avatar */}
                    <div className="h-24 w-24 shrink-0 rounded-2xl liquid-glass flex items-center justify-center text-3xl font-bold text-violet-700 dark:text-violet-100 border border-violet-500/30 shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]">
                        {user.avatarInitials}
                    </div>

                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground">{user.displayName}</h1>
                            {user.role === "ADMIN" && (
                                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20 flex items-center gap-1.5">
                                    <ShieldAlert size={12} />
                                    Admin
                                </span>
                            )}
                            {user.role === "MODERATOR" && (
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                                    Moderator
                                </span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Mail size={14} className="opacity-70" /> {user.email}</span>
                            <span className="flex items-center gap-1.5"><GraduationCap size={14} className="opacity-70" /> {userMajor}</span>
                            {user.createdAt ? (
                                <span className="flex items-center gap-1.5"><Clock size={14} className="opacity-70" /> Member since {formatDate(user.createdAt)}</span>
                            ) : (
                                <span className="flex items-center gap-1.5"><Clock size={14} className="opacity-70" /> Member since 2024</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    {/* 2. REPUTATION & ACTIVITY */}
                    <ProfileSection
                        title="Reputation & Activity"
                        description="Your contributions and progress across GeeksHub."
                        icon={TrendingUp}
                        headerColor="text-emerald-500 dark:text-emerald-400"
                    >
                        <TooltipProvider delayDuration={200}>
                            <div className="flex flex-col md:flex-row items-stretch divide-y md:divide-y-0 md:divide-x divide-border w-full">
                                {/* Points Card */}
                                <div className="flex flex-col gap-1.5 flex-1 py-4 md:py-0 md:pr-8 lg:pr-12">
                                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Award size={16} className="text-amber-500 dark:text-amber-400" /> Total Points
                                    </span>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-baseline gap-1.5 cursor-default group w-fit">
                                                <span className="text-4xl font-light font-display text-foreground tracking-tight group-hover:text-amber-500 transition-colors">{reputation?.totalPoints ?? user.totalPoints ?? 0}</span>
                                                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 relative">
                                                    XP
                                                    <Sparkles size={14} className="text-amber-500 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all absolute -right-5" />
                                                </span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-xs bg-amber-500 border-amber-500 text-foreground font-medium">
                                            Earn XP by completing courses and contributing files!
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                {/* Badge Tier Card */}
                                <div className="flex flex-col gap-1.5 flex-1 py-4 md:py-0 md:px-8 lg:px-12">
                                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                        <ShieldAlert size={16} className="text-violet-500 dark:text-violet-400" /> Current Rank
                                    </span>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-baseline gap-1.5 cursor-default group w-fit">
                                                <span className="text-3xl font-light font-display text-foreground capitalize tracking-tight group-hover:text-violet-500 transition-colors">{reputation?.badge || activity?.badgeTier || "Newcomer"}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-xs bg-violet-500 border-violet-500 text-foreground font-medium">
                                            Keep uploading to unlock Silver and Gold ranks.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                {/* Files Explored */}
                                <div className="flex flex-col gap-2 relative flex-1 py-4 md:py-0 md:pl-8 lg:pl-12 lg:flex-[1.5]">
                                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                        <FileText size={16} className="text-blue-500 dark:text-blue-400" /> Recent Files Explored
                                    </span>
                                    <div className="flex flex-col gap-1.5 mt-1 z-10 w-full">
                                        {activity?.courseActivity && activity.courseActivity.length > 0 ? (
                                            activity.courseActivity.slice(0, 3).map(c => (
                                                <div key={c.courseId} className="flex items-center gap-4 text-sm group">
                                                    <span className="text-foreground font-medium truncate max-w-[140px] transition-colors">{c.courseName}</span>
                                                    <div className="h-px bg-border flex-1 border-dashed group-hover:border-solid group-hover:bg-blue-500/30 transition-all"></div>
                                                    <span className="text-muted-foreground font-mono text-xs">
                                                        {c.totalFiles > 0 ? `${c.filesCompleted}/${c.totalFiles}` : `${c.filesCompleted}`}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-sm text-muted-foreground italic">No course activity yet</span>
                                        )}
                                    </div>
                                    {/* Decorative bg icon */}
                                    <GraduationCap size={120} className="absolute right-0 -bottom-10 text-foreground/[0.02] rotate-12 pointer-events-none" />
                                </div>
                            </div>
                        </TooltipProvider>
                    </ProfileSection>

                    {/* 3. MY UPLOADS */}
                    <ProfileSection
                        title="Upload History"
                        description="Status of any files you've contributed to the platform."
                        icon={UploadCloud}
                        headerColor="text-sky-500 dark:text-sky-400"
                    >
                        <div className="flex flex-col gap-5">
                            <div className="flex gap-4 sm:gap-8 border-b border-border pb-5">
                                <div className="flex flex-col">
                                    <span className="text-2xl font-semibold text-foreground">{totalUploads}</span>
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Submitted</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-semibold text-emerald-500 dark:text-emerald-400">{approvedUploads}</span>
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Approved</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-semibold text-amber-500 dark:text-amber-400">{pendingUploads}</span>
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</span>
                                </div>
                            </div>

                            {uploads && uploads.length > 0 ? (
                                <div className="flex flex-col -mx-4">
                                    {uploads.slice(0, 5).map(req => (
                                        <div key={req.id} className="px-4 py-3 flex items-center justify-between border-b border-border/50 last:border-0 hover:bg-black/[0.02] dark:hover:bg-foreground/5 transition-colors">
                                            <div className="flex flex-col gap-0.5 truncate pr-4">
                                                <span className="text-sm font-medium text-foreground truncate">{req.title}</span>
                                                <span className="text-xs text-muted-foreground truncate">{req.courseName || req.courseId}</span>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-1.5">
                                                {req.status === 'approved' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                                {req.status === 'rejected' && <XCircle size={16} className="text-rose-500" />}
                                                {req.status === 'pending' && <Clock size={16} className="text-amber-500" />}
                                                <span className="text-xs font-medium capitalize hidden sm:inline-block w-16 text-right">
                                                    {req.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {uploads.length > 5 && (
                                        <button className="text-sm px-4 pt-3 pb-1 text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors w-fit flex items-center gap-1">
                                            View all {uploads.length} uploads <ChevronRight size={14} />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                                    You haven't contributed any files yet.
                                </div>
                            )}
                        </div>
                    </ProfileSection>

                    {/* 4. ACCOUNT & SECURITY */}
                    <ProfileSection
                        title="Account Security"
                        description="Manage your password and authentication sessions."
                        icon={KeyRound}
                        headerColor="text-rose-500 dark:text-rose-400"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={handlePasswordReset}
                                disabled={isResetLoading}
                                className="flex items-center justify-between p-4 rounded-xl border border-border bg-transparent hover:bg-muted/50 transition-all text-left group disabled:opacity-50 min-h-[44px]"
                            >
                                <div className="flex flex-col gap-1 pr-4">
                                    <span className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">Reset Password</span>
                                    <span className="text-xs text-muted-foreground line-clamp-2">Send a secure password reset link to your email</span>
                                </div>
                                <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                            </button>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        className="flex items-center justify-between p-4 rounded-xl border border-rose-500/20 bg-transparent hover:bg-rose-500/10 transition-all text-left group min-h-[44px]"
                                    >
                                        <div className="flex flex-col gap-1 pr-4">
                                            <span className="text-sm font-medium text-rose-500 group-hover:text-rose-600 dark:text-rose-400 dark:group-hover:text-rose-300 transition-colors">Sign Out</span>
                                            <span className="text-xs text-muted-foreground line-clamp-2">Securely sign out of your current session</span>
                                        </div>
                                        <LogOut size={18} className="text-rose-500/50 group-hover:text-rose-500/70 dark:group-hover:text-rose-400 transition-colors shrink-0" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Sign Out</DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to securely sign out of GeeksHub? You will need your credentials to log back in.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter className="mt-6 flex-col sm:flex-row gap-2 sm:gap-0">
                                        <DialogTrigger asChild>
                                            <button className="px-5 py-2 rounded-lg border border-border bg-transparent hover:bg-muted text-sm font-medium transition-all w-full sm:w-auto">
                                                Cancel
                                            </button>
                                        </DialogTrigger>
                                        <button
                                            onClick={handleSignOut}
                                            className="px-5 py-2 rounded-lg bg-rose-500/90 text-foreground hover:bg-rose-600 text-sm font-medium transition-all w-full sm:w-auto shadow-sm"
                                        >
                                            Sign out securely
                                        </button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </ProfileSection>
                </div>

                {/* Footer disclaimer */}
                <div className="text-center pb-8 pt-4">
                    <p className="text-xs text-muted-foreground">
                        GeeksHub account securely managed via Auth0. Certain profile elements cannot be changed directly.
                    </p>
                </div>
            </div>
        </div>
    );
}
