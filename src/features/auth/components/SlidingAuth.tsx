import { useState } from "react";
import SignInForm from "@/features/auth/components/forms/SignInForm";
import SignUpForm from "@/features/auth/components/forms/SignUpForm";
import ForgotForm from "@/features/auth/components/forms/ForgotForm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/shared/components/BrandLogo";

export default function SlidingAuth() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgot, setIsForgot] = useState(false);

    return (
        <>
            {/* Mobile View */}
            <div className="md:hidden min-h-screen w-full flex items-center justify-center bg-muted/20 p-4">
                <div className="w-full max-w-sm bg-card rounded-lg shadow-xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-300 border border-border">
                    <div className="flex items-center gap-3 mb-6">
                        <BrandLogo className="w-12 h-12" />
                        <span className="font-display text-base font-bold text-foreground tracking-[0.15em] uppercase">
                            GeeksHub
                        </span>
                    </div>
                    <div className="flex w-full mb-6 border-b z-10 relative">
                        <Button
                            variant="ghost"
                            onClick={() => setIsSignUp(false)}
                            className={cn(
                                "w-1/2 pb-2 rounded-none h-auto px-0 hover:bg-transparent text-center text-base font-medium transition-colors relative justify-center",
                                !isSignUp ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Sign In
                            {!isSignUp && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full" />}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setIsSignUp(true)}
                            className={cn(
                                "w-1/2 pb-2 rounded-none h-auto px-0 hover:bg-transparent text-center text-base font-medium transition-colors relative justify-center",
                                isSignUp ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Sign Up
                            {isSignUp && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-primary rounded-t-full" />}
                        </Button>
                    </div>

                    <div className="mt-2 min-h-[300px]">
                        {isSignUp ? <SignUpForm /> : <SignInForm />}
                    </div>
                </div>
            </div>

            {/* Desktop Sliding View */}
            <div className="hidden md:block bg-background relative overflow-hidden w-full h-screen">

                {/* Sign Up Container - Left Side when Active */}
                <div
                    className={cn(
                        "absolute top-0 h-full transition-all duration-700 ease-in-out left-0 w-1/2 opacity-0 z-10",
                        isSignUp && "transform translate-x-[100%] opacity-100 z-50 animate-show"
                    )}
                >
                    <div className="flex flex-col items-center justify-center h-full text-left bg-background px-12">
                        <div className="w-full max-w-md mx-auto flex flex-col items-start">
                            <BrandLogo className="w-14 h-14 mb-5" />
                            <h1 className="font-bold text-4xl text-foreground tracking-tight">Create account</h1>
                            <p className="text-muted-foreground mt-2 mb-6">Join Azrieli's student community — it's free.</p>
                            <div className="w-full">
                                <SignUpForm />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sign In Container - Left Side initially */}
                <div
                    className={cn(
                        "absolute top-0 h-full transition-all duration-700 ease-in-out left-0 w-1/2 z-20",
                        isSignUp && "transform translate-x-[100%]"
                    )}
                >
                    <div className="flex flex-col items-center justify-center h-full text-left bg-background px-12">
                        <div className="w-full max-w-md mx-auto flex flex-col items-start">
                            {isForgot ? (
                                <div className="w-full animate-in fade-in zoom-in-95 duration-300">
                                    <ForgotForm onBack={() => setIsForgot(false)} />
                                </div>
                            ) : (
                                <>
                                    <BrandLogo className="w-14 h-14 mb-5" />
                                    <h1 className="font-bold text-4xl text-foreground tracking-tight">Welcome back</h1>
                                    <p className="text-muted-foreground mt-2 mb-6">Sign in to pick up where you left off.</p>
                                    <div className="w-full">
                                        <SignInForm onForgotPassword={() => setIsForgot(true)} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Overlay Container */}
                <div
                    className={cn(
                        "absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-[100]",
                        isSignUp && "transform -translate-x-full"
                    )}
                    style={{
                        // Clip Path for Trapezoid Diagonal
                        clipPath: isSignUp
                            ? "polygon(0 0, 85% 0, 100% 100%, 0 100%)" // Left Overlay: Right edge diagonal /
                            : "polygon(15% 0, 100% 0, 100% 100%, 0 100%)", // Right Overlay: Left edge diagonal /

                        WebkitClipPath: isSignUp
                            ? "polygon(0 0, 85% 0, 100% 100%, 0 100%)"
                            : "polygon(15% 0, 100% 0, 100% 100%, 0 100%)",

                        transition: "transform 0.7s ease-in-out, clip-path 0.7s ease-in-out, -webkit-clip-path 0.7s ease-in-out"
                    }}
                >
                    <div
                        className={cn(
                            "bg-primary text-primary-foreground relative left-[-100%] h-full w-[200%] transform transition-transform duration-700 ease-in-out",
                            isSignUp && "transform translate-x-[50%]"
                        )}
                        style={{
                            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--ring)), hsl(var(--primary)))",
                            // Removed skew and counter-skew
                            backfaceVisibility: "hidden",
                        }}
                    >
                        {/* Ambient floating shapes */}
                        <div className="auth-floating-shape w-64 h-64 top-[-5%] left-[10%]" />
                        <div className="auth-floating-shape w-48 h-48 bottom-[10%] right-[15%]" />
                        <div className="auth-floating-shape w-32 h-32 top-[40%] left-[45%]" />

                        {/* Overlay Panel Left (Visible when isSignUp is TRUE - showing Sign In Form) */}
                        {/* If isSignUp is TRUE, Overlay is on Left. The "Sign In" option should appear to switch back. */}
                        <div
                            className={cn(
                                "absolute flex flex-col items-start justify-center text-left top-0 left-0 h-full w-1/2 transform transition-transform duration-700 ease-in-out px-20",
                                isSignUp ? "translate-x-0" : "-translate-x-[20%]"
                            )}
                        >
                            <div className="w-full max-w-md flex flex-col items-start">
                                <BrandLogo className="w-20 h-20 mb-6" />
                                <h1 className="font-bold text-5xl mb-5 tracking-tight">Welcome back!</h1>
                                <p className="text-lg mb-10 text-primary-foreground/80 font-light leading-relaxed max-w-xs">
                                    Your courses, notes, and study groups are waiting. Pick up right where you left off.
                                </p>
                                <Button
                                    variant="outline"
                                    className="border-primary-foreground/50 text-base text-primary-foreground hover:bg-primary-foreground hover:text-primary bg-transparent rounded-full px-12 py-6 font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                                    onClick={() => setIsSignUp(false)}
                                >
                                    Sign In
                                </Button>
                            </div>
                        </div>

                        {/* Overlay Panel Right (Visible when isSignUp is FALSE - showing Sign Up Form) */}
                        <div
                            className={cn(
                                "absolute flex flex-col items-start justify-center text-left top-0 h-full w-1/2 right-0 transform transition-transform duration-700 ease-in-out px-20",
                                isSignUp ? "translate-x-[20%]" : "translate-x-0"
                            )}
                        >
                            <div className="w-full max-w-md flex flex-col items-start">
                                <BrandLogo className="w-20 h-20 mb-6" />
                                <h1 className="font-bold text-5xl mb-5 tracking-tight">Hello, friend!</h1>
                                <p className="text-lg mb-10 text-primary-foreground/80 font-light leading-relaxed max-w-xs">
                                    Join Azrieli's student community. Share notes, ace your courses, and level up together.
                                </p>
                                <Button
                                    variant="outline"
                                    className="border-primary-foreground/50 text-base text-primary-foreground hover:bg-primary-foreground hover:text-primary bg-transparent rounded-full px-12 py-6 font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                                    onClick={() => setIsSignUp(true)}
                                >
                                    Sign Up
                                </Button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}
