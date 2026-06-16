import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { Role } from "@/types/domain";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    /** Restricts the route to users whose role is in this list. Omit to allow any signed-in user. */
    requiredRoles?: Role[];
}

export default function ProtectedRoute({ requiredRoles }: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (requiredRoles && !requiredRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
