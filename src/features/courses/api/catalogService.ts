import { api } from "@/lib/apiClient";
import type { Course, Lecturer, Major, Semester, AcademicYear } from "@/types/domain";

/**
 * Fetches all available majors.
 * @backend GET /api/v1/majors
 */
export const listMajors = async (): Promise<Major[]> => {
    return await api<Major[]>("/majors");
};

/**
 * Fetches all available material types.
 * @backend GET /api/v1/types
 */
export const listTypes = async (): Promise<{id: string, displayName: string}[]> => {
    return await api<{id: string, displayName: string}[]>("/types");
};

/**
 * Fetches academic years (Freshman, Sophomore, etc.)
 * @param majorId - Optional filter
 * @backend GET /api/v1/years
 */
export const listYears = async (_majorId?: string): Promise<AcademicYear[]> => {
    const params = new URLSearchParams();
    if (_majorId) params.append("major_id", _majorId);
    return await api<AcademicYear[]>(`/years?${params.toString()}`);
};

/**
 * Fetches available semesters.
 * @param majorId - Optional filter
 * @backend GET /api/v1/semesters
 */
export const listSemesters = async (_majorId?: string): Promise<Semester[]> => {
    const params = new URLSearchParams();
    if (_majorId) params.append("major_id", _majorId);
    return await api<Semester[]>(`/semesters?${params.toString()}`);
}

/**
 * Fetches courses with optional filters from the Live Backend.
 * @param filters - Filter by majorId, yearId, semesterId
 * @backend GET /api/v1/courses?major_id=...&semester_id=...
 */
export const listCourses = async (filters: { majorId?: string, yearId?: string, semesterId?: string }): Promise<Course[]> => {
    const params = new URLSearchParams();
    if (filters.majorId) params.append("major_id", filters.majorId);
    if (filters.yearId) params.append("year_id", filters.yearId);
    if (filters.semesterId) params.append("semester_id", filters.semesterId);

    return await api<Course[]>(`/courses?${params.toString()}`);
};

/**
 * Fetches a single course by ID.
 * @param courseId - The course ID to fetch
 * @backend GET /api/v1/courses/:courseId
 */
export const getCourse = async (courseId: string): Promise<Course | undefined> => {
    return await api<Course>(`/courses/${courseId}`);
};

/**
 * Fetches lecturers, optionally filtered by course.
 * @param filters - Filter by courseId
 * @backend GET /api/v1/lecturers?course_id=...
 */
export const listLecturers = async (filters: { courseId?: string }): Promise<Lecturer[]> => {
    const params = new URLSearchParams();
    if (filters.courseId) params.append("course_id", filters.courseId);
    return await api<Lecturer[]>(`/lecturers?${params.toString()}`);
}
