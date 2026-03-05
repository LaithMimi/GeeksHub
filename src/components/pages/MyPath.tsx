import { Link } from "react-router-dom";
import { Map, ChevronLeft, Sparkles } from "lucide-react";

export default function MyPath() {
    return (
        <div className="animate-fade-in space-y-8">
            <Link to="/" className="text-white/40 hover:text-white/70 flex items-center gap-2 text-[13px] w-fit transition-colors">
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                Back to Dashboard
            </Link>

            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-6 border border-purple-500/20">
                    <Map className="h-8 w-8 text-purple-400" />
                </div>
                <h1 className="text-[28px] font-display font-bold text-white tracking-[-0.03em]">
                    My Learning Path
                </h1>
                <p className="text-white/40 mt-2 text-[14px] max-w-md">
                    Track your progress across courses, set goals, and visualize your academic journey.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[13px]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Coming soon
                </div>
            </div>
        </div>
    );
}
