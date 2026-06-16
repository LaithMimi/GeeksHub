/**
 * Shared catalog constants for academic years and semesters.
 * Single source of truth for the values the backend stores on a Course
 * (`year_id` 1–4, `semester` 1–3).
 */

/** Academic year levels (1–4). */
export const ACADEMIC_YEARS = [1, 2, 3, 4] as const;

/** Semester code → display label (matches Course.semester on the backend). */
export const SEMESTER_LABELS: Record<number, string> = {
    1: "Fall",
    2: "Spring",
    3: "Summer",
};
