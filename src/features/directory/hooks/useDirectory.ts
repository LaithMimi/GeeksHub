/**
 * ============================================================================
 * DIRECTORY QUERY HOOKS
 * ============================================================================
 *
 * TanStack Query hooks for directory management (users, lecturers, courses).
 * Mutations invalidate the relevant query-key prefix and surface success/error
 * via sonner toasts.
 * ============================================================================
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import {
    fetchDirectoryStats,
    listUsers,
    updateUser,
    deleteUser,
    listMajors,
    createMajor,
    updateMajor,
    deleteMajor,
    listLecturers,
    createLecturer,
    updateLecturer,
    deleteLecturer,
    listLecturerCourses,
    assignLecturerCourse,
    unassignLecturerCourse,
    listCourseLecturers,
    createCourse,
    updateCourse,
    deleteCourse,
    type UserFilters,
    type UserUpdateInput,
    type CourseInput,
} from "@/features/directory/api/directoryService";

const k = queryKeys.directory;

/** Human-friendly message from an ApiError, with a fallback. */
const errMessage = (err: unknown, fallback: string) =>
    err instanceof ApiError ? err.message : fallback;

// -- Stats ---------------------------------------------------------------------

export const useDirectoryStats = () =>
    useQuery({ queryKey: k.stats(), queryFn: fetchDirectoryStats });

// -- Users ---------------------------------------------------------------------

export const useDirectoryUsers = (filters?: UserFilters) =>
    useQuery({ queryKey: k.users(filters), queryFn: () => listUsers(filters) });

export const useUpdateUser = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UserUpdateInput }) => updateUser(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["directory", "users"] });
            qc.invalidateQueries({ queryKey: k.stats() });
            toast.success("User updated");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to update user")),
    });
};

export const useDeleteUser = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteUser(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["directory", "users"] });
            qc.invalidateQueries({ queryKey: k.stats() });
            toast.success("User deleted");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to delete user")),
    });
};

// -- Majors --------------------------------------------------------------------

/** Refresh the directory major list, the public catalog majors list, and stats. */
const invalidateMajors = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: k.majors() });
    qc.invalidateQueries({ queryKey: ["majors"] }); // shared public catalog dropdowns
    qc.invalidateQueries({ queryKey: k.stats() });
};

export const useDirectoryMajors = () =>
    useQuery({ queryKey: k.majors(), queryFn: listMajors });

export const useCreateMajor = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (name: string) => createMajor(name),
        onSuccess: () => {
            invalidateMajors(qc);
            toast.success("Major created");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to create major")),
    });
};

export const useUpdateMajor = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateMajor(id, name),
        onSuccess: () => {
            invalidateMajors(qc);
            toast.success("Major renamed");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to rename major")),
    });
};

export const useDeleteMajor = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteMajor(id),
        onSuccess: () => {
            invalidateMajors(qc);
            toast.success("Major deleted");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to delete major")),
    });
};

// -- Lecturers -----------------------------------------------------------------

export const useDirectoryLecturers = () =>
    useQuery({ queryKey: k.lecturers(), queryFn: listLecturers });

export const useCreateLecturer = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (name: string) => createLecturer(name),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: k.lecturers() });
            qc.invalidateQueries({ queryKey: k.stats() });
            toast.success("Lecturer created");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to create lecturer")),
    });
};

export const useUpdateLecturer = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => updateLecturer(id, name),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: k.lecturers() });
            toast.success("Lecturer renamed");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to rename lecturer")),
    });
};

export const useDeleteLecturer = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteLecturer(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: k.lecturers() });
            qc.invalidateQueries({ queryKey: k.stats() });
            toast.success("Lecturer deleted");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to delete lecturer")),
    });
};

// -- Lecturer ↔ course assignment (works from either side) ---------------------

export const useLecturerCourses = (lecturerId?: string) =>
    useQuery({
        queryKey: k.lecturerCourses(lecturerId),
        queryFn: () => listLecturerCourses(lecturerId!),
        enabled: !!lecturerId,
    });

export const useCourseLecturers = (courseId?: string) =>
    useQuery({
        queryKey: k.courseLecturers(courseId),
        queryFn: () => listCourseLecturers(courseId!),
        enabled: !!courseId,
    });

/** Refresh both sides of an assignment plus lecturer course counts. */
const invalidateAssignment = (
    qc: ReturnType<typeof useQueryClient>,
    lecturerId: string,
    courseId: string,
) => {
    qc.invalidateQueries({ queryKey: k.lecturerCourses(lecturerId) });
    qc.invalidateQueries({ queryKey: k.courseLecturers(courseId) });
    qc.invalidateQueries({ queryKey: k.lecturers() });
};

export const useAssignLecturerCourse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ lecturerId, courseId }: { lecturerId: string; courseId: string }) =>
            assignLecturerCourse(lecturerId, courseId),
        onSuccess: (_d, { lecturerId, courseId }) => invalidateAssignment(qc, lecturerId, courseId),
        onError: (err) => toast.error(errMessage(err, "Failed to assign course")),
    });
};

export const useUnassignLecturerCourse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ lecturerId, courseId }: { lecturerId: string; courseId: string }) =>
            unassignLecturerCourse(lecturerId, courseId),
        onSuccess: (_d, { lecturerId, courseId }) => invalidateAssignment(qc, lecturerId, courseId),
        onError: (err) => toast.error(errMessage(err, "Failed to remove course")),
    });
};

// -- Courses -------------------------------------------------------------------

export const useCreateCourse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: CourseInput) => createCourse(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: k.stats() });
            qc.invalidateQueries({ queryKey: k.courses() });
            toast.success("Course created");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to create course")),
    });
};

export const useUpdateCourse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CourseInput> }) => updateCourse(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: k.courses() });
            toast.success("Course updated");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to update course")),
    });
};

export const useDeleteCourse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCourse(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: k.stats() });
            qc.invalidateQueries({ queryKey: k.courses() });
            toast.success("Course deleted");
        },
        onError: (err) => toast.error(errMessage(err, "Failed to delete course")),
    });
};
