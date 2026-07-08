import ResetPasswordForm from "@/features/auth/components/forms/ResetPasswordForm";
import BrandLogo from "@/shared/components/BrandLogo";

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-zinc-950 p-4">
            <div className="flex flex-col items-center gap-2">
                <BrandLogo className="w-14 h-14" />
                <span className="font-display text-sm font-bold text-foreground tracking-[0.15em] uppercase">
                    GeeksHub
                </span>
            </div>
            <ResetPasswordForm />
        </div>
    );
}
