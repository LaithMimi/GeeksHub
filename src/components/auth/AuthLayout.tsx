import type { ReactNode } from "react";

interface AuthLayoutProps {
    children: ReactNode;
    bgGradientPosition?: string;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="min-h-screen w-full overflow-hidden font-sans text-foreground">
            {children}
        </div>
    );
}
