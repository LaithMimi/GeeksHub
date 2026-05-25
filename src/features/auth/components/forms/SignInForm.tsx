import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface SignInFormProps {
    onForgotPassword?: () => void;
}

export default function SignInForm({ onForgotPassword }: SignInFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            await signIn(email, password, rememberMe);
            navigate("/");
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center w-full px-8">

            <div className="w-full space-y-3 mt-4">
                <Input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="h-10"
                    required
                    autoFocus
                />
                <div className="relative">
                    <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        className="h-10 pr-10"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            <div className="w-full flex items-center justify-between mt-4 text-sm">
                <div className="flex items-center space-x-2">
                    <Checkbox id="rememberMe" name="rememberMe" checked={rememberMe} onCheckedChange={(val) => setRememberMe(val === true)} />
                    <label htmlFor="rememberMe" className="text-muted-foreground cursor-pointer select-none">Remember me</label>
                </div>
                {/* Forgot Password Link */}
                <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-muted-foreground hover:text-foreground hover:underline bg-transparent border-none cursor-pointer transition-colors"
                >
                    Forgot your password?
                </button>
            </div>

            <div>
                <br />
            </div>
            {/* Submit Button */}
            <Button
                className="rounded-full w-full px-12 py-6 font-bold uppercase text-xs tracking-wider transition-transform active:scale-95"
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Sign In"}
            </Button>

            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </form>
    );
}
