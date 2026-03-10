/**
 * ============================================================================
 * CATALOG SERVICE - Mock Implementation
 * ============================================================================
 * 
 * This service provides access to catalog data (majors, years, semesters, 
 * courses, lecturers). Currently uses in-memory mock data.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * When the backend is implemented, replace each function's implementation:
 * 
 * 1. Import your API client instead of mock-db:
 *    ```ts
 *    import { api } from "@/lib/apiClient";
 *    ```
 * 
 * 2. Replace function bodies with fetch calls:
 * 
 *    listMajors() → GET /api/majors
 *    - Backend: SELECT * FROM majors ORDER BY name
 * 
 *    listYears() → GET /api/years
 *    - Backend: Return static enum or SELECT * FROM academic_years
 * 
 *    listSemesters() → GET /api/semesters
 *    - Backend: SELECT * FROM semesters ORDER BY start_date DESC
 * 
 *    listCourses(filters) → GET /api/courses?majorId=...&semesterId=...
 *    - Backend: SELECT * FROM courses WHERE major_id = ? AND semester_id = ?
 *    - Add pagination: ?page=1&limit=20
 * 
 *    getCourse(id) → GET /api/courses/:id
 *    - Backend: SELECT * FROM courses WHERE id = ?
 * 
 *    listLecturers(filters) → GET /api/lecturers?courseId=...
 *    - Backend: SELECT DISTINCT l.* FROM lecturers l 
 *               JOIN course_lecturers cl ON l.id = cl.lecturer_id 
 *               WHERE cl.course_id = ?
 * 
 * 3. Example real implementation:
 *    ```ts
 *    export const listCourses = async (filters: { majorId?: string, semesterId?: string }): Promise<Course[]> => {
 *        const params = new URLSearchParams();
 *        if (filters.majorId) params.set("majorId", filters.majorId);
 *        if (filters.semesterId) params.set("semesterId", filters.semesterId);
 *        return api<Course[]>(`/api/courses?${params}`);
 *    };
 *    ```
 * 
 * 4. Keep function signatures unchanged - TanStack Query hooks won't need updates.
 * ============================================================================
 */

import { years, semesters, courses, lecturers, randomDelay } from "@/mock/mock-db";
import type { Course, Lecturer, Major, Semester, AcademicYear } from "@/types/domain";
import { api } from "@/lib/apiClient";

/**
 * Fetches all available majors.
 * @backend GET /api/majors
 */
export const listMajors = async (): Promise<Major[]> => {
    return await api<Major[]>("/majors");
};

/**
 * Fetches academic years (Freshman, Sophomore, etc.)
 * @param majorId - Optional filter (currently unused in mock)
 * @backend GET /api/years
 */
export const listYears = async (_majorId?: string): Promise<AcademicYear[]> => {
    await randomDelay();
    return years;
};

/**
 * Fetches available semesters.
 * @param majorId - Optional filter (currently unused in mock)
 * @backend GET /api/semesters
 */
export const listSemesters = async (_majorId?: string): Promise<Semester[]> => {
    await randomDelay();
    return semesters;
}

/**
 * Fetches courses with optional filters from the Live Backend.
 * @param filters - Filter by majorId, yearId, semesterId
 * @backend GET /api/courses?majorId=...&semesterId=...
 */
export const listCourses = async (filters: { majorId?: string, yearId?: string, semesterId?: string }): Promise<Course[]> => {
    const params = new URLSearchParams();
    if (filters.majorId) params.append("major_id", filters.majorId);
    if (filters.yearId) params.append("year_id", filters.yearId.toString());
    if (filters.semesterId) params.append("semester_id", filters.semesterId.toString());

    return await api<Course[]>(`/courses?${params.toString()}`);
};

/**
 * Fetches a single course by ID.
 * @param courseId - The course ID to fetch
 * @backend GET /api/courses/:courseId
 */
export const getCourse = async (courseId: string): Promise<Course | undefined> => {
    await randomDelay();
    return courses.find(c => c.id === courseId);
};

/**
 * Fetches lecturers, optionally filtered by course.
 * @param filters - Filter by courseId
 * @backend GET /api/lecturers?courseId=...
 */
export const listLecturers = async (_filters: { courseId?: string }): Promise<Lecturer[]> => {
    await randomDelay();
    return lecturers;
}
