import { useState, useEffect, useCallback } from "react";

export type InAppNotification = {
    id: string;
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
};

export function useInAppNotifications() {
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);

    useEffect(() => {
        const load = () => {
            try {
                const saved = localStorage.getItem("geekshub-inapp-notifications-list");
                if (saved) {
                    setNotifications(JSON.parse(saved));
                }
            } catch (e) { }
        };
        load();

        // Listen for changes from other components across tabs or same window
        const handleStorage = () => load();
        window.addEventListener("geekshub-notifications-update", handleStorage);
        return () => window.removeEventListener("geekshub-notifications-update", handleStorage);
    }, []);

    const addNotification = useCallback((title: string, message: string) => {
        setNotifications(prev => {
            const newNotif: InAppNotification = {
                id: Math.random().toString(36).substr(2, 9),
                title,
                message,
                timestamp: Date.now(),
                read: false,
            };
            const newNotifs = [newNotif, ...prev].slice(0, 50); // Keep last 50
            localStorage.setItem("geekshub-inapp-notifications-list", JSON.stringify(newNotifs));
            
            // Trigger browser notification if permissions granted and enabled
            try {
                const prefs = JSON.parse(localStorage.getItem("geekshub-notifications") || "{}");
                if (prefs.adminUpdates && "Notification" in window && Notification.permission === "granted") {
                    new Notification(title, { body: message });
                }
            } catch(e) {}
            
            return newNotifs;
        });
        window.dispatchEvent(new Event("geekshub-notifications-update"));
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => {
            const newNotifs = prev.map(n => n.id === id ? { ...n, read: true } : n);
            localStorage.setItem("geekshub-inapp-notifications-list", JSON.stringify(newNotifs));
            return newNotifs;
        });
        window.dispatchEvent(new Event("geekshub-notifications-update"));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => {
            const newNotifs = prev.map(n => ({ ...n, read: true }));
            localStorage.setItem("geekshub-inapp-notifications-list", JSON.stringify(newNotifs));
            return newNotifs;
        });
        window.dispatchEvent(new Event("geekshub-notifications-update"));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
        localStorage.setItem("geekshub-inapp-notifications-list", JSON.stringify([]));
        window.dispatchEvent(new Event("geekshub-notifications-update"));
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return {
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll
    };
}
