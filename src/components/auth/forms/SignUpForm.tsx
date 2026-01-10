import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/authService";
import { Loader2, Facebook, Twitter } from "lucide-react";

export default function SignUpForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData);

        try {
            await authService.signUp(data as Record<string, string>);
            alert("Account created!");
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center w-full px-8">

            {/* Social Container */}
            <div className="flex gap-4 my-2">
                <Button variant="outline" size="icon" className="rounded-full border-muted-foreground/20 hover:border-muted-foreground/50 w-10 h-10" type="button">
                    <span className="font-bold text-lg">G</span>
                </Button>
                <Button variant="outline" size="icon" className="rounded-full border-muted-foreground/20 hover:border-muted-foreground/50 w-10 h-10" type="button">
                    <Facebook className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-full border-muted-foreground/20 hover:border-muted-foreground/50 w-10 h-10" type="button">
                    <Twitter className="h-4 w-4" />
                </Button>
            </div>

            <span className="text-xs text-[#333] my-4">or use your email for registration</span>

            {/* Form Inputs */}
            <div className="w-full space-y-3">
                <Input
                    name="name"
                    type="text"
                    placeholder="Name"
                    className="bg-gray-100 border-none outline-none text-sm w-full py-3 h-10"
                    required
                    autoFocus
                />
                <Input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="bg-gray-100 border-none outline-none text-sm w-full py-3 h-10"
                    required
                />
                <Input
                    name="password"
                    type="password"
                    placeholder="Password"
                    className="bg-gray-100 border-none outline-none text-sm w-full py-3 h-10"
                    required
                    minLength={8}
                />
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
