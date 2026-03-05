import { Link } from "react-router-dom";
import { Ghost, Home } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
            <div className="text-center max-w-md animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
                    <Ghost className="h-8 w-8 text-white/20" />
                </div>
                <h1 className="text-[64px] font-display font-bold text-white tracking-[-0.04em] leading-none">404</h1>
                <p className="text-[18px] text-white/60 font-medium mt-3">Page not found</p>
                <p className="text-[14px] text-white/30 mt-2">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-xl gradient-bg text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
                >
                    <Home className="h-4 w-4" />
                    Go Home
                </Link>
            </div>
        </div>
    );
}
