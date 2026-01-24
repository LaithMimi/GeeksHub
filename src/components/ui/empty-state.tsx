import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    actionLink?: string;
    onAction?: () => void;
}

export function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    actionLink,
    onAction
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl bg-muted/20 border border-dashed border-muted-foreground/20">
            <div className="mb-4 opacity-50">
                {icon || <FileText className="h-12 w-12 text-muted-foreground" />}
            </div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    {description}
                </p>
            )}
            {(actionLabel && (actionLink || onAction)) && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAction}
                    asChild={!!actionLink}
                >
                    {actionLink ? (
                        <Link to={actionLink}>{actionLabel}</Link>
                    ) : (
                        actionLabel
                    )}
                </Button>
            )}
        </div>
    );
}
