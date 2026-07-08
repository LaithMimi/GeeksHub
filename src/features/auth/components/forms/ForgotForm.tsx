import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/features/auth/api/authService";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

interface ForgotFormProps {
    onBack?: () => void;
}

export default function ForgotForm({ onBack }: ForgotFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get("email") as string;

        try {
            await authService.requestPasswordReset(email);
            setSuccess(true);
        } catch (err) {
            // In forgot password, we typically don't show errors for security (enumeration)
            setSuccess(true);
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="rounded-full bg-emerald-500/15 p-3 text-emerald-400 auth-success-pulse">
                    <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-semibold text-foreground">Check your email</h3>
                    <p className="text-muted-foreground text-sm max-w-[280px]">
                        We've sent a password reset link to your email address.
                    </p>
                </div>
                <Button variant="outline" onClick={onBack} className="mt-4 rounded-full">
                    Back to Sign In
                </Button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch w-full animate-in fade-in duration-300 auth-focus-glow rounded-xl">
            <div className="w-full text-left mb-6">
                <h2 className="text-3xl font-bold mb-2 tracking-tight">Forgot password?</h2>
                <p className="text-base text-muted-foreground">We'll send a reset link to your Azrieli email.</p>
            </div>

            <div className="w-full space-y-3">
                <div>
                    <label htmlFor="forgot-email" className="text-sm font-medium text-foreground mb-1.5 block">Email address</label>
                    <Input
                        id="forgot-email"
                        name="email"
                        type="email"
                        placeholder="you@post.jce.ac.il"
                        className="h-11"
                        required
                        autoFocus
                        disabled={isLoading}
                    />
                </div>
            </div>

            <Button
                className="rounded-full w-full px-12 py-6 mt-6 font-semibold uppercase text-sm tracking-wider transition-all active:scale-95"
                type="submit"
                disabled={isLoading}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
            </Button>

            <button
                type="button"
                onClick={onBack}
                className="flex items-center text-sm text-muted-foreground mt-4 hover:text-primary transition-colors bg-transparent border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
            </button>
        </form>
    );
}
