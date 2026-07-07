/**
 * ============================================================================
 * DIRECTORY SERVICE
 * ============================================================================
 *
 * API calls for managing the platform directory — users, lecturers, courses,
 * and lecturer↔course assignment. Used by both the moderator (Users) and admin
 * (Lecturers, Courses) sections. Hierarchy: STUDENT < ADMIN < MODERATOR — the
 * backend gates `/directory/users` and `/directory/stats` to MODERATOR only,
 * while majors/lecturers/courses are ADMIN-level (moderators inherit).
 * Request bodies are camelCase; responses are auto-camelCased.
 * ============================================================================
 */

import { api } from "@/lib/apiClient";
import type { Course, Lecturer, Major, Role } from "@/types/domain";

// -- Types ---------------------------------------------------------------------

export interface DirectoryStats {
    totalUsers: number;
    totalLecturers: number;
    totalCourses: number;
    newUsersThisWeek: number;
}

export interface DirectoryUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    majorId?: string | null;
    majorName?: string | null;
    totalPoints: number;
    createdAt: string;
}

export interface LecturerWithCount {
    id: string;
    name: string;
    courseCount: number;
}

export interface MajorWithCount {
    id: string;
    name: string;
    slug: string;
    courseCount: number;
}

export interface UserFilters {
    search?: string;
    role?: string;
    majorId?: string;
}

export interface UserUpdateInput {
    name?: string;
    // `null` explicitly clears the user's major; omit the key to leave it unchanged.
    majorId?: string | null;
    role?: Role;
}

export interface CourseInput {
    code: string;
    name: string;
    majorId: string;
    yearId: number;
    semester: number;
    lecturerIds: string[];
}

// -- Stats ---------------------------------------------------------------------

export const fetchDirectoryStats = () => api<DirectoryStats>("/directory/stats");

// -- Users ---------------------------------------------------------------------

export const listUsers = (filters?: UserFilters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.role) params.append("role", filters.role);
    if (filters?.majorId) params.append("major_id", filters.majorId);
    const qs = params.toString();
    return api<DirectoryUser[]>(`/directory/users${qs ? `?${qs}` : ""}`);
};

export const updateUser = (id: string, data: UserUpdateInput) =>
    api<DirectoryUser>(`/directory/users/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteUser = (id: string) =>
    api<void>(`/directory/users/${id}`, { method: "DELETE" });

// -- Majors --------------------------------------------------------------------

export const listMajors = () => api<MajorWithCount[]>("/directory/majors");

export const createMajor = (name: string) =>
    api<Major>("/directory/majors", { method: "POST", body: JSON.stringify({ name }) });

export const updateMajor = (id: string, name: string) =>
    api<Major>(`/directory/majors/${id}`, { method: "PUT", body: JSON.stringify({ name }) });

export const deleteMajor = (id: string) =>
    api<void>(`/directory/majors/${id}`, { method: "DELETE" });

// -- Lecturers -----------------------------------------------------------------

export const listLecturers = () => api<LecturerWithCount[]>("/directory/lecturers");

export const createLecturer = (name: string) =>
    api<Lecturer>("/directory/lecturers", { method: "POST", body: JSON.stringify({ name }) });

export const updateLecturer = (id: string, name: string) =>
    api<Lecturer>(`/directory/lecturers/${id}`, { method: "PUT", body: JSON.stringify({ name }) });

export const deleteLecturer = (id: string) =>
    api<void>(`/directory/lecturers/${id}`, { method: "DELETE" });

// -- Lecturer ↔ course assignment ---------------------------------------------

export const listLecturerCourses = (lecturerId: string) =>
    api<Course[]>(`/directory/lecturers/${lecturerId}/courses`);

export const assignLecturerCourse = (lecturerId: string, courseId: string) =>
    api<{ message: string }>(`/directory/lecturers/${lecturerId}/courses/${courseId}`, { method: "POST" });

export const unassignLecturerCourse = (lecturerId: string, courseId: string) =>
    api<void>(`/directory/lecturers/${lecturerId}/courses/${courseId}`, { method: "DELETE" });

export const listCourseLecturers = (courseId: string) =>
    api<Lecturer[]>(`/directory/courses/${courseId}/lecturers`);

// -- Courses -------------------------------------------------------------------

export const createCourse = (data: CourseInput) =>
    api<Course>("/directory/courses", { method: "POST", body: JSON.stringify(data) });

export const updateCourse = (id: string, data: Partial<CourseInput>) =>
    api<Course>(`/directory/courses/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteCourse = (id: string) =>
    api<void>(`/directory/courses/${id}`, { method: "DELETE" });
