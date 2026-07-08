import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineErrorProps {
    children?: string | null;
    className?: string;
}

/**
 * A compact, standalone error line for use outside form fields — next to an
 * action, in a list row, under a control. Icon + text (never color alone),
 * announced with `role="alert"`.
 */
export function InlineError({ children, className }: InlineErrorProps) {
    if (!children) return null;
    return (
        <p
            role="alert"
            className={cn(
                "flex items-start gap-1.5 text-[13px] text-red-600 dark:text-red-400",
                className,
            )}
        >
            <AlertCircle className="h-4 w-4 mt-[1px] shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}
