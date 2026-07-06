import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";

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
        queryKey: queryKeys.notifications.list(),
        queryFn: fetchNotifications,
    });

    const { data: unreadData } = useQuery({
        queryKey: queryKeys.notifications.unreadCount(),
        queryFn: fetchUnreadCount,
        refetchInterval: 30_000,
    });

    const { mutate: markAsRead } = useMutation({
        mutationFn: patchRead,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.notifications.list() });
            qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
        },
    });

    const { mutate: markAllAsRead } = useMutation({
        mutationFn: patchReadAll,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.notifications.list() });
            qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
        },
    });

    return {
        notifications,
        unreadCount: unreadData?.count ?? 0,
        markAsRead,
        markAllAsRead,
    };
}
