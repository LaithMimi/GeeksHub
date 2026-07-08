import { RefreshCw, AlertCircle } from "lucide-react";
import { normalizeError } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface RetryNoticeProps {
    /** Raw error, normalized into safe copy internally. */
    error?: unknown;
    /** Override the normalized message. */
    message?: string;
    onRetry: () => void;
    retryLabel?: string;
    className?: string;
}

/**
 * Compact inline banner for a transient failure inside otherwise-loaded UI —
 * a widget that couldn't refresh, a section that failed while the rest of the
 * page is fine. Pairs a plain-language message with a retry button. Prefer this
 * over a disappearing toast when the user needs the action to stay visible.
 */
export function RetryNotice({ error, message, onRetry, retryLabel, className }: RetryNoticeProps) {
    const n = normalizeError(error);
    return (
        <div
            role="alert"
            className={cn(
                "flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2.5",
                className,
            )}
        >
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <span>{message ?? n.message}</span>
            </p>
            <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 shrink-0 text-[13px] font-medium text-foreground hover:opacity-80 transition-opacity"
            >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {retryLabel ?? "Retry"}
            </button>
        </div>
    );
}
