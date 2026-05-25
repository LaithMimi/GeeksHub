import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMajors } from "@/features/courses/hooks/useCatalog";
import { toast } from "sonner";

export default function SignUpForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [majorId, setMajorId] = useState("");
    const { data: majors, isLoading: isMajorsLoading, isError: isMajorsError } = useMajors();

    const { signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData);

        if (data.password !== data.confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
        }

        // --- DOMAIN CHECK ---
        const userEmail = (data.email as string).toLowerCase().trim();
        if (!userEmail.endsWith("@post.jce.ac.il")) {
            setError("You must use an Azrieli College email (@post.jce.ac.il) to join.");
            setIsLoading(false);
            return;
        }

        if (!majorId) {
            setError("Please select a major");
            setIsLoading(false);
            return;
        }

        try {
            await signUp(data.name as string, data.email as string, data.password as string, data.confirmPassword as string, majorId);
            toast.success("Account created! 📧 Please check your email to verify before logging in.", {
                duration: 8000, // Keep it on screen a bit longer so they read it
            });

            // [backend update] Since we now require email verification, we won't auto-login the user after sign-up.
            // 2. Route them to the sign-in page so they can log in AFTER verifying.
            // (If your sliding auth page is on a specific route like "/auth", change this to that route)
            navigate("/auth");
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
                    name="name"
                    type="text"
                    placeholder="Full name"
                    className="h-10"
                    required
                    autoFocus
                    disabled={isLoading}
                />
                <Input
                    name="email"
                    type="email"
                    placeholder="University email"
                    className="h-10"
                    required
                    disabled={isLoading}
                />

                <Select value={majorId} onValueChange={setMajorId} disabled={isMajorsLoading || isMajorsError || isLoading}>
                    <SelectTrigger className="h-10">
                        <SelectValue placeholder={isMajorsLoading ? "Loading majors..." : isMajorsError ? "Failed to load majors" : "Select Major"}>
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

                <div className="relative">
                    <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        className="h-10 pr-10"
                        required
                        minLength={8}
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isLoading}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>

                <div className="relative">
                    <Input
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm password"
                        className="h-10 pr-10"
                        required
                        minLength={8}
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isLoading}
                    >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            <Button
                className="rounded-full w-full px-12 py-6 mt-6 font-bold uppercase text-xs tracking-wider transition-transform active:scale-95"
                type="submit"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Sign Up"}
            </Button>

            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </form>
    );
}
