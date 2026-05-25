import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={`liquid-glass rounded-2xl p-10 text-center ${className ?? ""}`}>
            <Icon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-[15px] font-display font-semibold text-muted-foreground">{title}</p>
            {description && <p className="text-[13px] text-muted-foreground/50 mt-1 mb-4">{description}</p>}
            {action}
        </div>
    );
}
