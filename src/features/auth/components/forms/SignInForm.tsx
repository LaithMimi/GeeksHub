import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
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
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center w-full px-8 auth-focus-glow rounded-xl" noValidate>

            <div className="w-full space-y-3 mt-4">
                <div>
                    <label htmlFor="signin-email" className="text-sm font-medium text-foreground mb-1.5 block">Email address</label>
                    <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="you@post.jce.ac.il"
                        className="h-11"
                        required
                        autoFocus
                        disabled={isLoading}
                        aria-invalid={!!fieldErrors.email || undefined}
                    />
                </div>
                <div>
                    <label htmlFor="signin-password" className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                    <div className="relative">
                        <Input
                            id="signin-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="h-11 pr-10"
                            required
                            disabled={isLoading}
                            aria-invalid={!!fieldErrors.password || undefined}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            disabled={isLoading}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
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
                className="rounded-full w-full px-12 py-6 mt-6 font-semibold uppercase text-sm tracking-wider transition-all active:scale-95 group"
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <><span>Sign In</span><ArrowRight className="ml-2 h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" /></>}
            </Button>
        </form>
    );
}
