import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldErrorProps {
    /** The error text. When empty/undefined nothing renders. */
    children?: string | null;
    /**
     * Stable id so the matching input can point to it via
     * `aria-describedby`. Convention: `${fieldName}-error`.
     */
    id?: string;
    className?: string;
}

/**
 * Inline, accessible error shown directly beneath a form field.
 *
 * Communicates with an icon **and** text (never color alone) and announces
 * itself to screen readers via `role="alert"`. Pair it with an input that sets
 * `aria-invalid` and `aria-describedby={id}`.
 */
export function FieldError({ children, id, className }: FieldErrorProps) {
    if (!children) return null;
    return (
        <p
            id={id}
            role="alert"
            className={cn(
                "flex items-start gap-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 mt-1.5",
                className,
            )}
        >
            <AlertCircle className="h-3.5 w-3.5 mt-[1px] shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}
