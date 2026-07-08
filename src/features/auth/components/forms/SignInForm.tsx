import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormErrorSummary } from "@/shared/components/errors";
import type { AuthError } from "@/features/auth/api/authService";

interface SignInFormProps {
    onForgotPassword?: () => void;
}

export default function SignInForm({ onForgotPassword }: SignInFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setFieldErrors({});

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            await signIn(email, password, rememberMe);
            navigate("/");
        } catch (err) {
            const authErr = err as AuthError;
            setError(authErr?.message || "We couldn't sign you in. Please try again.");
            setFieldErrors(authErr?.fieldErrors ?? {});
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center w-full px-8" noValidate>

            <div className="w-full space-y-3 mt-4">
                <div>
                    <label htmlFor="signin-email" className="sr-only">Email</label>
                    <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        className="h-10"
                        required
                        autoFocus
                        disabled={isLoading}
                        aria-invalid={!!fieldErrors.email || undefined}
                    />
                </div>
                <div className="relative">
                    <label htmlFor="signin-password" className="sr-only">Password</label>
                    <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        className="h-10 pr-10"
                        required
                        disabled={isLoading}
                        aria-invalid={!!fieldErrors.password || undefined}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isLoading}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            <div className="w-full flex items-center justify-between mt-4 text-sm">
                <div className="flex items-center space-x-2">
                    <Checkbox id="rememberMe" name="rememberMe" checked={rememberMe} onCheckedChange={(val) => setRememberMe(val === true)} disabled={isLoading} />
                    <label htmlFor="rememberMe" className="text-muted-foreground cursor-pointer select-none">Remember me</label>
                </div>
                {/* Forgot Password Link */}
                <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-muted-foreground hover:text-foreground hover:underline bg-transparent border-none cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                >
                    Forgot your password?
                </button>
            </div>

            <FormErrorSummary message={error} autoFocus className="w-full mt-4" />

            {/* Submit Button */}
            <Button
                className="rounded-full w-full px-12 py-6 mt-6 font-bold uppercase text-xs tracking-wider transition-transform active:scale-95"
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Sign In"}
            </Button>
        </form>
    );
}
