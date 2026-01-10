import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/authService";
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
            await authService.requestPasswordReset({ email });
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
                <div className="rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/20">
                    <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">Check your email</h3>
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
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center w-full px-8 animate-in fade-in duration-300">
            <div className="w-full text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Forgot Password?</h2>
                <p className="text-sm text-muted-foreground">Enter your email to reset it.</p>
            </div>

            <div className="w-full space-y-3">
                <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    className="h-10"
                    required
                    autoFocus
                />
            </div>

            <Button
                className="rounded-full w-full px-12 py-6 mt-6 font-bold uppercase text-xs tracking-wider transition-transform active:scale-95"
                type="submit"
                disabled={isLoading}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
            </Button>

            <button
                type="button"
                onClick={onBack}
                className="flex items-center text-sm text-muted-foreground mt-4 hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
            </button>
        </form>
    );
}
