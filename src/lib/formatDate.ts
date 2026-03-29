import { format } from "date-fns";

/**
 * Safely format a date string.
 * @param dateStr  ISO date string or any parseable value.
 * @param pattern  date-fns format pattern. Defaults to "MMM d, yyyy h:mm a".
 */
export function formatDate(
    dateStr: string,
    pattern: string = "MMM d, yyyy h:mm a",
): string {
    try {
        return format(new Date(dateStr), pattern);
    } catch {
        return dateStr;
    }
}
