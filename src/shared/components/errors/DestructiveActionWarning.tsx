import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DestructiveActionWarningProps {
    /** What is about to happen and why it can't be undone. */
    children: string;
    className?: string;
}

/**
 * A calm, high-contrast warning block for use inside a confirmation dialog
 * before a destructive action (delete, reject, bulk remove). Icon + text so the
 * caution never rests on color alone; `role="alert"` so it's announced when the
 * dialog opens.
 *
 * @example
 * <Dialog>
 *   <DestructiveActionWarning>
 *     This permanently deletes 12 files. This can't be undone.
 *   </DestructiveActionWarning>
 * </Dialog>
 */
export function DestructiveActionWarning({ children, className }: DestructiveActionWarningProps) {
    return (
        <div
            role="alert"
            className={cn(
                "flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3",
                className,
            )}
        >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-[13px] text-amber-800 dark:text-amber-200">{children}</p>
        </div>
    );
}
