import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/apiClient";
import { requestMaterials } from "@/features/files/api/materialRequestService";

/**
 * Requests that the cohort upload materials for a course. Surfaces the outcome
 * (how many were notified, or that it was already requested) via a toast.
 */
export const useRequestMaterials = () =>
    useMutation({
        mutationFn: ({ courseId, typeId }: { courseId: string; typeId?: string }) =>
            requestMaterials(courseId, typeId),
        onSuccess: (res) => {
            if (res.alreadyRequested) {
                toast.info("Already requested — students have been notified.");
            } else if (res.notified > 0) {
                toast.success(`Request sent! Notified ${res.notified} student${res.notified === 1 ? "" : "s"}.`);
            } else {
                toast.success("Request noted. We'll alert students as they opt in.");
            }
        },
        onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : "Failed to send request"),
    });
