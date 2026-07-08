import { AlertTriangle, RefreshCw, WifiOff, Lock, SearchX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { normalizeError, type ErrorKind } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface PageErrorStateProps {
    /** The raw error — normalized internally into safe, friendly copy. */
    error?: unknown;
    /** Override the normalized title. */
    title?: string;
    /** Override the normalized message. */
    message?: string;
    /** Retry handler. When provided (and the error is retryable) a button shows. */
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
}

const ICONS: Record<ErrorKind, LucideIcon> = {
    network: WifiOff,
    authorization: Lock,
    authentication: Lock,
    notFound: SearchX,
    validation: AlertTriangle,
    conflict: AlertTriangle,
    rateLimit: AlertTriangle,
    server: AlertTriangle,
    payment: AlertTriangle,
    upload: AlertTriangle,
    unknown: AlertTriangle,
};

/**
 * Full-region error state for a page or panel whose data failed to load —
 * dashboards, lists, detail views. Replaces bare "Something went wrong" blocks.
 *
 * Normalizes the error into plain language and offers a retry when the failure
 * is transient. Announced to assistive tech via `role="alert"`.
 */
export function PageErrorState({ error, title, message, onRetry, retryLabel, className }: PageErrorStateProps) {
    const n = normalizeError(error);
    const Icon = ICONS[n.kind];
    const showRetry = !!onRetry && (n.retryable || !error);

    return (
        <div
            role="alert"
            className={cn(
                "liquid-glass rounded-2xl p-10 text-center flex flex-col items-center",
                className,
            )}
        >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-red-500/80" aria-hidden="true" />
            </div>
            <p className="text-[15px] font-display font-semibold text-foreground">{title ?? n.title}</p>
            <p className="text-[13px] text-muted-foreground mt-1.5 max-w-sm">{message ?? n.message}</p>
            {showRetry && (
                <button
                    onClick={onRetry}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
                >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {retryLabel ?? "Try again"}
                </button>
            )}
        </div>
    );
}
