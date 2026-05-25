import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isToday, isTomorrow, isPast, format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isMac = typeof window !== 'undefined' && typeof navigator !== 'undefined'
  ? navigator.platform.toUpperCase().includes("MAC") || navigator.userAgent.includes("Mac")
  : false;

/** Returns a time-of-day greeting. Accepts an optional hour for testability. */
export function getGreeting(hour: number = new Date().getHours()): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Format a decimal hour (e.g. 9.5) as 24h "H:MM" (e.g. "9:30").
 * Used by the LearningPlan schedule blocks where tasks can start/end on the half-hour.
 */
export function formatHour(decimalHour: number): string {
    const totalMinutes = Math.round(decimalHour * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

/** Formats a YYYY-MM-DD date string into a friendly deadline label. */
export function formatDeadline(dateStr: string): { label: string; urgent: boolean } {
  const date = new Date(dateStr + "T00:00:00");
  if (isToday(date)) return { label: "Due Today", urgent: true };
  if (isTomorrow(date)) return { label: "Due Tomorrow", urgent: true };
  if (isPast(date)) return { label: `Overdue — ${format(date, "MMM d")}`, urgent: true };
  return { label: format(date, "MMM d, EEEE"), urgent: false };
}
