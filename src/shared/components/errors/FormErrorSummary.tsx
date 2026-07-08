import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormErrorSummaryProps {
    /** Headline — "what happened". Falls back to a friendly default. */
    title?: string;
    /** One or two calm sentences. When empty the summary does not render. */
    message?: string | null;
    /** When true, moves keyboard focus to the summary on mount (submit failure). */
    autoFocus?: boolean;
    className?: string;
}

/**
 * Form-level error banner shown above (or below) a form after a submit fails
 * for a reason that isn't tied to one field — a network drop, a server error,
 * "email already registered", etc.
 *
 * Uses an icon + text, `role="alert"` for immediate announcement, and can pull
 * focus so keyboard and screen-reader users land on the explanation.
 */
export function FormErrorSummary({ title, message, autoFocus, className }: FormErrorSummaryProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoFocus && message) ref.current?.focus();
    }, [autoFocus, message]);

    if (!message) return null;

    return (
        <div
            ref={ref}
            role="alert"
            tabIndex={-1}
            className={cn(
                "flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-left outline-none",
                className,
            )}
        >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
            <div className="space-y-0.5">
                {title && <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">{title}</p>}
                <p className="text-[13px] text-red-700/90 dark:text-red-200/90">{message}</p>
            </div>
        </div>
    );
}
