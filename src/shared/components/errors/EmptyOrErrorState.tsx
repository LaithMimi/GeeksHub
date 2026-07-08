import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageErrorState } from "./PageErrorState";

interface EmptyOrErrorStateProps {
    /** True when the underlying query/request failed. */
    isError?: boolean;
    /** The raw error, forwarded to PageErrorState for friendly copy. */
    error?: unknown;
    /** Retry handler for the error branch (e.g. `refetch`). */
    onRetry?: () => void;

    // Empty-state props (used when there's no error, just no data).
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

/**
 * One switch for a data region that can be either **empty** or **failed**.
 *
 * Keeps the two visually consistent while giving a failed load its own honest,
 * retryable message instead of pretending the list is simply empty. Use it
 * wherever a list/grid renders `data?.length ? … : <EmptyState/>`.
 */
export function EmptyOrErrorState({
    isError,
    error,
    onRetry,
    icon,
    title,
    description,
    action,
    className,
}: EmptyOrErrorStateProps) {
    if (isError || error) {
        return <PageErrorState error={error} onRetry={onRetry} className={className} />;
    }
    return (
        <EmptyState icon={icon} title={title} description={description} action={action} className={className} />
    );
}
