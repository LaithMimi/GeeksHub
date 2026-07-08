import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService, type AuthError } from "@/features/auth/api/authService";
import { Loader2, CheckCircle2, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { FieldError, FormErrorSummary } from "@/shared/components/errors";

/**
 * Prefer the token from the URL fragment (#token=...) over the query string.
 * Fragments are never sent to servers, never logged, and never leak via the
 * Referer header — unlike query params. Query is kept as a fallback so existing
 * email links keep working until the backend switches to fragment-based links.
 */
function readResetToken(searchParams: URLSearchParams): string {
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    const fromHash = new URLSearchParams(hash).get("token");
    return fromHash || searchParams.get("token") || "";
}

export default function ResetPasswordForm() {
    const [searchParams] = useSearchParams();
    const token = readResetToken(searchParams);

    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setFieldErrors({});

        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const password = formData.get("password") as string;
        const confirmPassword = formData.get("confirmPassword") as string;

        const errors: { password?: string; confirmPassword?: string } = {};
        if (password.length < 8) {
            errors.password = "Your password must be at least 8 characters.";
        }
        if (password !== confirmPassword) {
            errors.confirmPassword = "Both passwords need to match. Re-enter them to be sure.";
        }
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            const firstInvalid = errors.password ? "password" : "confirmPassword";
            form.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
            return;
        }

        setIsLoading(true);
        try {
            await authService.confirmPasswordReset({ token, password });
            setSuccess(true);
        } catch (err) {
            const authErr = err as AuthError;
            setError(authErr?.message || "We couldn't reset your password. The link may have expired — request a new one.");
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
                    <h3 className="text-xl font-semibold">Password Reset Complete</h3>
                    <p className="text-muted-foreground text-sm max-w-[280px]">
                        Your password has been updated. You can now sign in with your new password.
                    </p>
                </div>
                <Button className="w-full mt-4" asChild>
                    <Link to="/auth">Sign In</Link>
                </Button>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="text-center p-8 space-y-4">
                <div className="p-3 bg-red-100 rounded-full w-fit mx-auto text-red-600">
                    <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">Invalid Link</h3>
                <p className="text-muted-foreground text-sm">
                    This password reset link is invalid or missing a token.
                </p>
                <Button variant="outline" asChild>
                    <Link to="/auth">Back to Sign In</Link>
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 animate-in fade-in duration-300 w-full max-w-sm mx-auto p-6 bg-card rounded-xl shadow-lg border">
            <div className="text-center mb-2">
                <h2 className="text-2xl font-bold">Reset Password</h2>
                <p className="text-sm text-muted-foreground">Enter a new secure password</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        className="h-10"
                        required
                        autoFocus
                        disabled={isLoading}
                        aria-invalid={!!fieldErrors.password || undefined}
                        aria-describedby={fieldErrors.password ? "reset-password-error" : undefined}
                    />
                    <FieldError id="reset-password-error">{fieldErrors.password}</FieldError>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        className="h-10"
                        required
                        disabled={isLoading}
                        aria-invalid={!!fieldErrors.confirmPassword || undefined}
                        aria-describedby={fieldErrors.confirmPassword ? "reset-confirm-error" : undefined}
                    />
                    <FieldError id="reset-confirm-error">{fieldErrors.confirmPassword}</FieldError>
                </div>
            </div>

            <FormErrorSummary message={error} autoFocus />

            <Button className="w-full mt-2" type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
            </Button>

            <Button variant="link" asChild className="text-xs text-muted-foreground">
                <Link to="/auth">Back to Sign In</Link>
            </Button>
        </form>
    );
}
