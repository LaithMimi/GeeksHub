import { api } from "@/lib/apiClient";
import type { Course, Lecturer } from "@/types/domain";

export function listAllCourses(): Promise<Course[]> {
    return api<Course[]>("/courses");
}

export function listAllLecturers(): Promise<Lecturer[]> {
    return api<Lecturer[]>("/lecturers");
}

export function getCourseLecturers(courseId: string): Promise<Lecturer[]> {
    return api<Lecturer[]>(`/admin/courses/${courseId}/lecturers`);
}

export function assignLecturer(courseId: string, lecturerId: string): Promise<unknown> {
    return api(`/admin/courses/${courseId}/lecturers/${lecturerId}`, { method: "POST" });
}

export function unassignLecturer(courseId: string, lecturerId: string): Promise<unknown> {
    return api(`/admin/courses/${courseId}/lecturers/${lecturerId}`, { method: "DELETE" });
}
