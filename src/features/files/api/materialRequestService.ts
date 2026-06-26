import { api } from "@/lib/apiClient";

export interface MaterialRequestResult {
    /** How many students were notified by this request. */
    notified: number;
    /** True when an identical open request already existed (no new broadcast sent). */
    alreadyRequested?: boolean;
}

/**
 * Asks for materials (optionally of a specific type) to be uploaded for a course.
 * The backend notifies the relevant student cohort inviting them to upload.
 * @param courseId - The course the materials are wanted for
 * @param typeId   - Material-type id, or undefined to request any material
 * @backend POST /api/v1/courses/:courseId/request-files
 */
export const requestMaterials = (courseId: string, typeId?: string) =>
    api<MaterialRequestResult>(`/courses/${courseId}/request-files`, {
        method: "POST",
        body: JSON.stringify({ typeId: typeId ?? null }),
    });
