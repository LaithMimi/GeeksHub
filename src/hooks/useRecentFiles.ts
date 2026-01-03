import { useState, useEffect } from 'react';

export interface RecentFile {
    id: string;
    title: string;
    courseId: string;
    type: string;
    viewedAt: string; // ISO string
}

const MAX_RECENT_FILES = 20;
const STORAGE_KEY = 'geekshub-recent-files';

export function useRecentFiles() {
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

    // Load from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setRecentFiles(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse recent files", e);
            }
        }
    }, []);

    const addRecentFile = (file: Omit<RecentFile, 'viewedAt'>) => {
        setRecentFiles(prev => {
            // Remove if already exists to move to top
            const filtered = prev.filter(f => f.id !== file.id);
            const newFile = { ...file, viewedAt: new Date().toISOString() };
            const updated = [newFile, ...filtered].slice(0, MAX_RECENT_FILES);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    const clearHistory = () => {
        setRecentFiles([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    return { recentFiles, addRecentFile, clearHistory };
}
