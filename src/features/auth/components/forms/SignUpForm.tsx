import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMajors } from "@/features/courses/hooks/useCatalog";
import { toast } from "sonner";
import { FieldError, FormErrorSummary } from "@/shared/components/errors";
import type { AuthError } from "@/features/auth/api/authService";

type FieldErrors = Partial<Record<"name" | "email" | "major" | "password" | "confirmPassword", string>>;

export default function SignUpForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [majorId, setMajorId] = useState("");
    const { data: majors, isLoading: isMajorsLoading, isError: isMajorsError } = useMajors();

    const { signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");

        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Client-side checks — collected together so we can focus the first
        // invalid field and show every problem at once (not one at a time).
        const errors: FieldErrors = {};
        const email = (data.email as string).toLowerCase().trim();

        if (!email.endsWith("@post.jce.ac.il")) {
            errors.email = "Use your Azrieli College email — it ends in @post.jce.ac.il.";
        }
        if ((data.password as string).length < 8) {
            errors.password = "Your password must be at least 8 characters.";
        }
        if (data.password !== data.confirmPassword) {
            errors.confirmPassword = "Both passwords need to match. Re-enter them to be sure.";
        }
        if (!majorId) {
            errors.major = "Choose your major to continue.";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            // Move focus to the first field that needs attention.
            const firstInvalid = (["name", "email", "password", "confirmPassword"] as const).find((f) => errors[f]);
            if (firstInvalid) form.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
            return;
        }

        setFieldErrors({});
        setIsLoading(true);

        try {
            await signUp(data.name as string, data.email as string, data.password as string, data.confirmPassword as string, majorId);
            toast.success("Account created!", {
                description: "Check your email to verify your account, then sign in.",
                duration: 8000,
            });
            navigate("/auth");
        } catch (err) {
            const authErr = err as AuthError;
            setFormError(authErr?.message || "We couldn't create your account. Please try again.");
            setFieldErrors(authErr?.fieldErrors ?? {});
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center w-full px-8" noValidate>

            <div className="w-full space-y-3 mt-4">
                <div>
                    <label htmlFor="signup-name" className="sr-only">Full name</label>
                    <Input
                        id="signup-name"
                        name="name"
                        type="text"
                        placeholder="Full name"
                        className="h-10"
                        required
                        autoFocus
                        disabled={isLoading}
                        aria-invalid={!!fieldErrors.name || undefined}
                        aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
                    />
                    <FieldError id="signup-name-error">{fieldErrors.name}</FieldError>
                </div>

                <div>
                    <label htmlFor="signup-email" className="sr-only">University email</label>
                    <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="University email"
                        className="h-10"
                        required
                        disabled={isLoading}
                        aria-invalid={!!fieldErrors.email || undefined}
                        aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
                    />
                    <FieldError id="signup-email-error">{fieldErrors.email}</FieldError>
                </div>

                <div>
                    <Select value={majorId} onValueChange={(v) => { setMajorId(v); setFieldErrors((p) => ({ ...p, major: undefined })); }} disabled={isMajorsLoading || isMajorsError || isLoading}>
                        <SelectTrigger className="h-10" aria-invalid={!!fieldErrors.major || undefined} aria-describedby={fieldErrors.major ? "signup-major-error" : undefined}>
                            <SelectValue placeholder={isMajorsLoading ? "Loading majors..." : isMajorsError ? "Couldn't load majors — refresh to try again" : "Select Major"}>
                                {majors?.find((m) => m.id === majorId)?.name}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {majors?.map((major) => (
                                <SelectItem key={major.id} value={major.id}>
                                    {major.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError id="signup-major-error">{fieldErrors.major}</FieldError>
                </div>

                <div>
                    <label htmlFor="signup-password" className="sr-only">Password</label>
                    <div className="relative">
                        <Input
                            id="signup-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Password (at least 8 characters)"
                            className="h-10 pr-10"
                            required
                            minLength={8}
                            disabled={isLoading}
                            aria-invalid={!!fieldErrors.password || undefined}
                            aria-describedby={fieldErrors.password ? "signup-password-error" : undefined}
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
                    <FieldError id="signup-password-error">{fieldErrors.password}</FieldError>
                </div>

                <div>
                    <label htmlFor="signup-confirm" className="sr-only">Confirm password</label>
                    <div className="relative">
                        <Input
                            id="signup-confirm"
                            name="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm password"
                            className="h-10 pr-10"
                            required
                            minLength={8}
                            disabled={isLoading}
                            aria-invalid={!!fieldErrors.confirmPassword || undefined}
                            aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-error" : undefined}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            disabled={isLoading}
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <FieldError id="signup-confirm-error">{fieldErrors.confirmPassword}</FieldError>
                </div>
            </div>

            <FormErrorSummary message={formError} autoFocus className="w-full mt-4" />

            <Button
                className="rounded-full w-full px-12 py-6 mt-6 font-bold uppercase text-xs tracking-wider transition-transform active:scale-95"
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Sign Up"}
            </Button>
        </form>
    );
}
