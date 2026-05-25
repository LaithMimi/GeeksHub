/**
 * ============================================================================
 * SETTINGS PAGE – Enhanced with working theme switching
 * ============================================================================
 *
 * @backend ALL settings except theme should be persisted via:
 *   GET  /api/me/settings   → load on mount
 *   PATCH /api/me/settings  → save on change (debounced)
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { Monitor, Globe, CheckCircle, Sun, Moon, Laptop, Palette, Sparkles, BookOpen, Bell } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/shared/hooks/useTheme";
import { useMajors, useYears } from "@/features/courses/hooks/useCatalog";

// Language Options
const languages = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "ar", name: "العربية", dir: "rtl" },
    { code: "he", name: "עברית", dir: "rtl" },
];

export default function Settings() {
    const { theme, setTheme } = useTheme();
    const { data: majors = [] } = useMajors();
    const { data: years = [] } = useYears();

    const [language, setLanguage] = useState(() => localStorage.getItem("language") || "en");
    const [defaultMajor, setDefaultMajor] = useState(() => localStorage.getItem("geekshub-default-major") || "none");
    const [defaultYear, setDefaultYear] = useState(() => localStorage.getItem("geekshub-default-year") || "none");
    const [notifications, setNotifications] = useState(() => {
        try {
            const saved = localStorage.getItem("geekshub-notifications");
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return { newMaterials: false, adminUpdates: false };
    });
    const [reduceMotion, setReduceMotion] = useState(() => {
        const saved = localStorage.getItem("geekshub-reduce-motion");
        return saved === "true";
    });
    const [compactMode, setCompactMode] = useState(() => {
        const saved = localStorage.getItem("geekshub-compact-mode");
        return saved === "true";
    });

    // Apply CSS classes when toggles change
    useEffect(() => {
        document.body.classList.toggle("reduce-motion", reduceMotion);
        localStorage.setItem("geekshub-reduce-motion", String(reduceMotion));
    }, [reduceMotion]);

    useEffect(() => {
        localStorage.setItem("geekshub-default-major", defaultMajor);
    }, [defaultMajor]);

    useEffect(() => {
        localStorage.setItem("geekshub-default-year", defaultYear);
    }, [defaultYear]);

    useEffect(() => {
        localStorage.setItem("geekshub-notifications", JSON.stringify(notifications));
        if (notifications.adminUpdates && "Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, [notifications]);

    useEffect(() => {
        document.body.classList.toggle("compact", compactMode);
        localStorage.setItem("geekshub-compact-mode", String(compactMode));
    }, [compactMode]);

    useEffect(() => {
        const selectedLang = languages.find(l => l.code === language);
        if (selectedLang) {
            document.documentElement.lang = selectedLang.code;
            document.documentElement.dir = selectedLang.dir;
            localStorage.setItem("language", language);
        }
    }, [language]);

    const themeOptions = [
        {
            value: "light" as const,
            label: "Light",
            icon: Sun,
            preview: (
                <div className="w-full h-20 rounded-lg bg-gradient-to-br from-[#f8f6ff] to-[#ebe5ff] relative overflow-hidden border border-black/[0.06]">
                    <div className="absolute top-2 left-2 right-2 h-3 rounded bg-white/80 border border-black/[0.06]" />
                    <div className="absolute bottom-2 left-2 w-8 h-8 rounded-lg bg-white border border-black/[0.06]" />
                    <div className="absolute bottom-2 left-12 right-2 space-y-1">
                        <div className="h-2 rounded bg-black/[0.08] w-3/4" />
                        <div className="h-2 rounded bg-black/[0.05] w-1/2" />
                    </div>
                </div>
            ),
        },
        {
            value: "dark" as const,
            label: "Dark",
            icon: Moon,
            preview: (
                <div className="w-full h-20 rounded-lg bg-gradient-to-br from-[#0c0014] to-[#0d0030] relative overflow-hidden border border-border">
                    <div className="absolute top-2 left-2 right-2 h-3 rounded bg-foreground/10 border border-border" />
                    <div className="absolute bottom-2 left-2 w-8 h-8 rounded-lg bg-foreground/10 border border-border" />
                    <div className="absolute bottom-2 left-12 right-2 space-y-1">
                        <div className="h-2 rounded bg-foreground/10 w-3/4" />
                        <div className="h-2 rounded bg-foreground/5 w-1/2" />
                    </div>
                </div>
            ),
        },
        {
            value: "system" as const,
            label: "System",
            icon: Laptop,
            preview: (
                <div className="w-full h-20 rounded-lg relative overflow-hidden border border-border">
                    <div className="absolute inset-0 w-1/2 bg-gradient-to-br from-[#f8f6ff] to-[#ebe5ff]" />
                    <div className="absolute inset-0 left-1/2 bg-gradient-to-br from-[#0c0014] to-[#0d0030]" />
                    <div className="absolute top-2 left-2 right-2 h-3 rounded bg-white/40 border border-black/[0.04]" />
                    <div className="absolute bottom-2 left-2 right-2 space-y-1">
                        <div className="h-2 rounded bg-black/[0.08] w-3/4" />
                        <div className="h-2 rounded bg-black/[0.04] w-1/2" />
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div className="animate-fade-in max-w-3xl mx-auto pb-20">
            {/* Header */}
            <div className="top-0 z-20 py-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[28px] font-display font-bold text-foreground tracking-[-0.03em]">Settings</h1>
                    <p className="text-[13px] text-muted-foreground mt-0.5">Manage your preferences and defaults</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. Theme / Appearance — Featured Section */}
                <GlassSection icon={Palette} iconColor="text-violet-400" title="Theme" desc="Choose how GeeksHub looks for you.">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {themeOptions.map(option => {
                            const Icon = option.icon;
                            const isActive = theme === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => setTheme(option.value)}
                                    aria-label={`Select ${option.label} theme`}
                                    className={`relative rounded-xl p-3 text-left transition-all duration-200 border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${isActive
                                        ? "border-blue-500 bg-blue-500/[0.08] shadow-[0_0_20px_rgba(37,99,235,0.15)]"
                                        : "border-transparent liquid-glass-subtle hover:border-border/50 dark:hover:border-border/50 hover:border-black/[0.12]"
                                        }`}
                                >
                                    {/* Preview */}
                                    {option.preview}

                                    {/* Label */}
                                    <div className="flex items-center gap-2 mt-3">
                                        <Icon className={`h-4 w-4 ${isActive ? "text-blue-500" : "text-muted-foreground"}`} />
                                        <span className={`text-[13px] font-display font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                            {option.label}
                                        </span>
                                    </div>

                                    {/* Active indicator */}
                                    {isActive && (
                                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full gradient-bg flex items-center justify-center">
                                            <CheckCircle className="h-3 w-3 text-foreground" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </GlassSection>

                {/* 2. Display */}
                <GlassSection icon={Monitor} iconColor="text-blue-400" title="Display" desc="Customize text size and visual density.">
                    {/* Language */}
                    <div className="space-y-3 pb-4 border-b border-border">
                        <div>
                            <span className="text-[14px] font-medium text-foreground">Language</span>
                            <p className="text-[12px] text-muted-foreground mt-0.5">Changes the interface language. Course files stay in their original language.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <Select value={language} onValueChange={setLanguage}>
                                <SelectTrigger aria-label="Language selection" className="w-[180px] liquid-glass-subtle text-foreground h-10 [&>span]:text-[13px]">
                                    <SelectValue placeholder="Select Language" />
                                </SelectTrigger>
                                <SelectContent className="liquid-glass border-border/50">
                                    {languages.map(lang => (
                                        <SelectItem key={lang.code} value={lang.code} className="text-foreground focus:bg-foreground/10 focus:text-foreground">
                                            <div className="flex items-center justify-between w-full gap-4">
                                                <span>{lang.name}</span>
                                                {lang.dir === 'rtl' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground">RTL</span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <GlassToggle
                        label="Compact Mode"
                        desc="Reduce spacing to show more content on screen."
                        checked={compactMode}
                        onCheckedChange={setCompactMode}
                    />
                    <GlassToggle
                        label="Reduce Motion"
                        desc="Minimize animations across the app."
                        checked={reduceMotion}
                        onCheckedChange={setReduceMotion}
                    />
                </GlassSection>



                {/* 3. Study Defaults */}
                <GlassSection icon={BookOpen} iconColor="text-blue-400" title="Study Defaults" desc="Pre-fill your search and browse filters.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GlassSelect 
                            label="Default Major" 
                            value={defaultMajor} 
                            onValueChange={setDefaultMajor}
                            displayValue={majors.find(m => m.id === defaultMajor)?.name || (defaultMajor === "none" ? "None" : "Loading...")}
                        >
                            <SelectItem value="none">None</SelectItem>
                            {majors.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </GlassSelect>
                        <GlassSelect 
                            label="Default Year" 
                            value={defaultYear} 
                            onValueChange={setDefaultYear}
                            displayValue={years.find(y => y.id.toString() === defaultYear)?.label || (defaultYear === "none" ? "None" : "Loading...")}
                        >
                            <SelectItem value="none">None</SelectItem>
                            {years.map(y => <SelectItem key={y.id} value={y.id.toString()}>{y.label}</SelectItem>)}
                        </GlassSelect>
                    </div>
                </GlassSection>

                {/* 4. Notifications */}
                <GlassSection icon={Bell} iconColor="text-amber-400" title="Notifications" desc="Choose what you want to be alerted about.">
                    <GlassToggle
                        label="New Materials"
                        desc="Notify when files are added to my courses."
                        checked={notifications.newMaterials}
                        onCheckedChange={(v: boolean) => setNotifications(prev => ({ ...prev, newMaterials: v }))}
                    />
                    <GlassToggle
                        label="Request Updates"
                        desc="Notify status changes for my uploads."
                        checked={notifications.adminUpdates}
                        onCheckedChange={(v: boolean) => setNotifications(prev => ({ ...prev, adminUpdates: v }))}
                    />
                </GlassSection>

                {/* 6. About */}
                <GlassSection icon={Sparkles} iconColor="text-blue-500" title="About GeeksHub" desc="Platform version: 1.0.0-beta">
                    <p className="text-[13px] text-muted-foreground">GeeksHub is built with React, Vite, and the Liquid Glass design system.</p>
                </GlassSection>
            </div>
        </div>
    );
}

// --- Reusable Glass Subcomponents ---

function GlassSection({ icon: Icon, iconColor, title, desc, children }: {
    icon: React.ElementType;
    iconColor: string;
    title: string;
    desc: string;
    children: React.ReactNode;
}) {
    return (
        <section className="liquid-glass rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border dark:border-border border-black/[0.06]">
                <div className="flex items-center gap-2.5 mb-1">
                    <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
                    <h2 className="text-[16px] font-display font-bold text-foreground">{title}</h2>
                </div>
                <p className="text-[12px] text-muted-foreground ms-[30px]">{desc}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
                {children}
            </div>
        </section>
    );
}

function GlassToggle({ label, desc, checked, onCheckedChange, disabled }: {
    label: string;
    desc: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    const id = label.replace(/\s+/g, '-').toLowerCase();
    return (
        <div className="flex flex-row items-center justify-between min-h-[44px] py-1.5 gap-3">
            <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                    <label htmlFor={id} className={`text-[14px] font-medium cursor-pointer select-none block truncate ${disabled ? 'text-muted-foreground/50' : 'text-foreground'}`}>{label}</label>
                </div>
                <p className={`text-[12px] leading-snug break-words ${disabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>{desc}</p>
            </div>
            <div className="shrink-0 flex items-center">
                <Switch id={id} aria-label={label} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
            </div>
        </div>
    );
}

function GlassSelect({ label, value, onValueChange, children, disabled, displayValue }: {
    label: string;
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
    disabled?: boolean;
    displayValue?: string;
}) {
    const defaultAriaLabel = `Select ${label}`;
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <label className={`text-[12px] font-display font-semibold uppercase tracking-wider block ${disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>{label}</label>
            </div>
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger aria-label={defaultAriaLabel} className={`liquid-glass-subtle transition-all [&>span]:text-[13px] h-10 ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-foreground hover:bg-foreground/5 dark:hover:bg-foreground/5 hover:bg-black/[0.02]'}`}>
                    <SelectValue>
                        {displayValue}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="liquid-glass border-border/50 dark:border-border/50 border-black/[0.1]">
                    {children}
                </SelectContent>
            </Select>
        </div>
    );
}
