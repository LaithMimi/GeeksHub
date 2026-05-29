import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

export type InAppNotification = {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
};

function fetchNotifications(): Promise<InAppNotification[]> {
    return api<InAppNotification[]>("/me/notifications");
}

function fetchUnreadCount(): Promise<{ count: number }> {
    return api<{ count: number }>("/me/notifications/unread-count");
}

function patchRead(id: string): Promise<unknown> {
    return api(`/me/notifications/${id}/read`, { method: "PATCH" });
}

function patchReadAll(): Promise<unknown> {
    return api("/me/notifications/read-all", { method: "PATCH" });
}

export function useInAppNotifications() {
    const qc = useQueryClient();

    const { data: notifications = [] } = useQuery({
        queryKey: ["notifications"],
        queryFn: fetchNotifications,
    });

    const { data: unreadData } = useQuery({
        queryKey: ["notifications-unread-count"],
        queryFn: fetchUnreadCount,
        refetchInterval: 30_000,
    });

    const { mutate: markAsRead } = useMutation({
        mutationFn: patchRead,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["notifications"] });
            qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        },
    });

    const { mutate: markAllAsRead } = useMutation({
        mutationFn: patchReadAll,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["notifications"] });
            qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        },
    });

    return {
        notifications,
        unreadCount: unreadData?.count ?? 0,
        markAsRead,
        markAllAsRead,
    };
}
