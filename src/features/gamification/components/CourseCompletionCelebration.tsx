import { useEffect, useState } from "react";
import { Sparkles, X, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CourseCompletionCelebrationProps {
    open: boolean;
    onClose: () => void;
    courseName?: string;
    pointsAwarded?: number;
    quote?: string | null;
}

export default function CourseCompletionCelebration({
    open,
    onClose,
    courseName = "Course",
    pointsAwarded = 0,
    quote,
}: CourseCompletionCelebrationProps) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (open) {
            setShow(true);
            // Auto close after 10 seconds if user doesn't interact
            const timer = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 300); // Wait for fade out
            }, 10000);
            return () => clearTimeout(timer);
        } else {
            setShow(false);
        }
    }, [open, onClose]);

    if (!open && !show) return null;

    return (
        <div 
            className={`fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}
        >
            <div className={`relative max-w-lg w-full liquid-glass-heavy border border-blue-500/40 rounded-3xl p-8 shadow-2xl shadow-blue-900/60 transform transition-all duration-700 ease-out ${show ? "translate-y-0 scale-100" : "translate-y-8 scale-95"}`}>
                
                {/* Close Button */}
                <button
                    onClick={() => {
                        setShow(false);
                        setTimeout(onClose, 300);
                    }}
                    className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Celebration Icon */}
                <div className="flex justify-center mb-6">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-amber-400 p-1 animate-pulse glow-blue-strong">
                        <div className="h-full w-full bg-slate-900 rounded-full flex items-center justify-center">
                            <Trophy className="h-10 w-10 text-amber-400" />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="text-center space-y-4">
                    <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-amber-300">
                        Course Conquered!
                    </h2>
                    
                    <p className="text-[16px] text-foreground/80 font-medium">
                        You have completed all materials for <strong className="text-foreground">{courseName}</strong>.
                    </p>

                    {pointsAwarded > 0 && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-display font-bold">
                            <Sparkles className="h-4 w-4" />
                            +{pointsAwarded} Reputation Points
                        </div>
                    )}

                    {/* Motivational Quote */}
                    {quote && (
                        <div className="mt-8 p-6 rounded-2xl bg-foreground/5 border border-border/50 relative">
                            <div className="absolute -top-3 left-6 text-4xl text-blue-500/40 leading-none">"</div>
                            <p className="text-[15px] italic text-foreground/70 font-display text-left relative z-10 pl-2">
                                {quote}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-center">
                    <Button 
                        onClick={() => {
                            setShow(false);
                            setTimeout(onClose, 300);
                        }}
                        className="w-full sm:w-auto px-8 py-6 rounded-2xl gradient-bg text-foreground font-display font-bold text-[16px] glow-blue-soft hover:-translate-y-1 transition-transform"
                    >
                        Keep Growing
                    </Button>
                </div>
            </div>
        </div>
    );
}
