import { api } from "@/lib/apiClient";

export interface UserSettings {
    language: string;
    defaultMajorId: string | null;
    defaultYearId: number | null;
    notifyNewMaterials: boolean;
    notifyAdminUpdates: boolean;
    reduceMotion: boolean;
    compactMode: boolean;
}

export type SettingsPatch = Partial<UserSettings>;

export function getSettings(): Promise<UserSettings> {
    return api<UserSettings>("/me/settings");
}

export function updateSettings(patch: SettingsPatch): Promise<UserSettings> {
    return api<UserSettings>("/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
    });
}
