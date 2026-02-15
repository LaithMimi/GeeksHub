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
import { Bell, Monitor, Globe, BookOpen, Brain, Clock, CheckCircle, Sun, Moon, Laptop, Palette, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { majors, years, userRequests } from "@/lib/data";
import { Link } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";

// Language Options
const languages = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "ar", name: "العربية", dir: "rtl" },
    { code: "he", name: "עברית", dir: "rtl" },
];

export default function Settings() {
    const { theme, setTheme } = useTheme();

    const [language, setLanguage] = useState(() => localStorage.getItem("language") || "en");
    const [textSize, setTextSize] = useState("medium");
    const [notifications, setNotifications] = useState({
        newMaterials: true,
        adminUpdates: true,
        weeklyDigest: false,
        soundEffects: true,
    });
    const [defaultMajor, setDefaultMajor] = useState(majors[0]);
    const [defaultYear, setDefaultYear] = useState(years[0]);
    const [aiSourceExpanded, setAiSourceExpanded] = useState(true);
    const [aiScope, setAiScope] = useState("file");
    const [reduceMotion, setReduceMotion] = useState(false);
    const [compactMode, setCompactMode] = useState(false);

    useEffect(() => {
        const selectedLang = languages.find(l => l.code === language);
        if (selectedLang) {
            document.documentElement.lang = selectedLang.code;
            document.documentElement.dir = selectedLang.dir;
            localStorage.setItem("language", language);
        }
    }, [language]);

    const statusBg: Record<string, string> = {
        pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
        approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
        rejected: "bg-red-500/15 text-red-400 border-red-500/20",
    };

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
                <div className="w-full h-20 rounded-lg bg-gradient-to-br from-[#0c0014] to-[#0d0030] relative overflow-hidden border border-white/[0.08]">
                    <div className="absolute top-2 left-2 right-2 h-3 rounded bg-white/[0.08] border border-white/[0.06]" />
                    <div className="absolute bottom-2 left-2 w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.06]" />
                    <div className="absolute bottom-2 left-12 right-2 space-y-1">
                        <div className="h-2 rounded bg-white/[0.1] w-3/4" />
                        <div className="h-2 rounded bg-white/[0.06] w-1/2" />
                    </div>
                </div>
            ),
        },
        {
            value: "system" as const,
            label: "System",
            icon: Laptop,
            preview: (
                <div className="w-full h-20 rounded-lg relative overflow-hidden border border-white/[0.08]">
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
            <div className="top-0 z-20 py-4 mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-[28px] font-display font-bold text-white tracking-[-0.03em]">Settings</h1>
                    <p className="text-[13px] text-white/40 mt-0.5">Manage your preferences and defaults</p>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    Saved
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. Theme / Appearance — Featured Section */}
                <GlassSection icon={Palette} iconColor="text-violet-400" title="Theme" desc="Choose how GeeksHub looks for you.">
                    <div className="grid grid-cols-3 gap-3">
                        {themeOptions.map(option => {
                            const Icon = option.icon;
                            const isActive = theme === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => setTheme(option.value)}
                                    className={`relative rounded-xl p-3 text-left transition-all duration-200 border-2 ${isActive
                                        ? "border-purple-500 bg-purple-500/[0.08] shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                                        : "border-transparent liquid-glass-subtle hover:border-white/[0.12]"
                                        }`}
                                >
                                    {/* Preview */}
                                    {option.preview}

                                    {/* Label */}
                                    <div className="flex items-center gap-2 mt-3">
                                        <Icon className={`h-4 w-4 ${isActive ? "text-purple-400" : "text-white/40"}`} />
                                        <span className={`text-[13px] font-display font-semibold ${isActive ? "text-white" : "text-white/60"}`}>
                                            {option.label}
                                        </span>
                                    </div>

                                    {/* Active indicator */}
                                    {isActive && (
                                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full gradient-bg flex items-center justify-center">
                                            <CheckCircle className="h-3 w-3 text-white" />
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
                    <div className="space-y-3 pb-4 border-b border-white/[0.06]">
                        <div>
                            <span className="text-[14px] font-medium text-white">Language</span>
                            <p className="text-[12px] text-white/35 mt-0.5">Changes the interface language. Course files stay in their original language.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Globe className="h-4 w-4 text-white/30" />
                            <Select value={language} onValueChange={setLanguage}>
                                <SelectTrigger className="w-[180px] liquid-glass-subtle border-white/[0.08] text-white/70 h-10 [&>span]:text-[13px]">
                                    <SelectValue placeholder="Select Language" />
                                </SelectTrigger>
                                <SelectContent className="liquid-glass-heavy border-white/[0.1]">
                                    {languages.map(lang => (
                                        <SelectItem key={lang.code} value={lang.code} className="text-white/70 focus:bg-white/[0.08] focus:text-white">
                                            <div className="flex items-center justify-between w-full gap-4">
                                                <span>{lang.name}</span>
                                                {lang.dir === 'rtl' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/[0.1] text-white/30">RTL</span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GlassSelect label="Text Size" value={textSize} onValueChange={setTextSize}>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium (Default)</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                        </GlassSelect>
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
                <GlassSection icon={BookOpen} iconColor="text-purple-400" title="Study Defaults" desc="Pre-fill your search and browse filters.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GlassSelect label="Default Major" value={defaultMajor} onValueChange={setDefaultMajor}>
                            {majors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </GlassSelect>
                        <GlassSelect label="Default Year" value={defaultYear} onValueChange={setDefaultYear}>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </GlassSelect>
                    </div>
                </GlassSection>

                {/* 4. AI Preferences */}
                <GlassSection icon={Brain} iconColor="text-purple-400" title="AI Preferences" desc="Customize how the AI assistant behaves.">
                    <GlassToggle
                        label="Explain Sources"
                        desc="Always expand source citations in chat."
                        checked={aiSourceExpanded}
                        onCheckedChange={setAiSourceExpanded}
                    />
                    <div className="pt-2">
                        <GlassSelect label="Default Scope" value={aiScope} onValueChange={setAiScope}>
                            <SelectItem value="file">Current File Only</SelectItem>
                            <SelectItem value="course">Entire Course</SelectItem>
                        </GlassSelect>
                    </div>
                </GlassSection>

                {/* 5. Notifications */}
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
                    <GlassToggle
                        label="Weekly Digest"
                        desc="Receive a weekly summary of new materials."
                        checked={notifications.weeklyDigest}
                        onCheckedChange={(v: boolean) => setNotifications(prev => ({ ...prev, weeklyDigest: v }))}
                    />
                    <GlassToggle
                        label="Sound Effects"
                        desc="Play sounds for notifications and actions."
                        checked={notifications.soundEffects}
                        onCheckedChange={(v: boolean) => setNotifications(prev => ({ ...prev, soundEffects: v }))}
                    />
                </GlassSection>

                {/* 6. Active Requests */}
                <GlassSection icon={Clock} iconColor="text-white/40" title="Active Requests" desc="A quick glance at your file submission statuses.">
                    {userRequests.length > 0 ? (
                        <div className="space-y-1.5">
                            {userRequests.map(req => (
                                <div key={req.id} className="flex items-center justify-between text-[13px] px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                                    <span className="truncate max-w-[200px] text-white/70">{req.title}</span>
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${statusBg[req.status] || statusBg.pending}`}>
                                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[13px] text-white/30">No active requests.</p>
                    )}
                    <Link to="/uploads" className="inline-block text-[13px] text-purple-400 hover:text-purple-300 hover:underline mt-2 transition-colors">
                        Manage all uploads
                    </Link>
                </GlassSection>

                {/* 7. About */}
                <GlassSection icon={Sparkles} iconColor="text-purple-400" title="About GeeksHub" desc="Version and platform info.">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-[13px]">
                            <span className="text-white/50">Version</span>
                            <span className="text-white/70 font-mono">1.0.0-beta</span>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                            <span className="text-white/50">Frontend</span>
                            <span className="text-white/70 font-mono">React + Vite</span>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                            <span className="text-white/50">Design System</span>
                            <span className="text-white/70 font-mono">Liquid Glass</span>
                        </div>
                    </div>
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
        <div className="liquid-glass rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5 mb-1">
                    <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
                    <h3 className="text-[16px] font-display font-bold text-white">{title}</h3>
                </div>
                <p className="text-[12px] text-white/35 ms-[30px]">{desc}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
                {children}
            </div>
        </div>
    );
}

function GlassToggle({ label, desc, checked, onCheckedChange }: {
    label: string;
    desc: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="space-y-0.5">
                <span className="text-[14px] font-medium text-white">{label}</span>
                <p className="text-[12px] text-white/35">{desc}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

function GlassSelect({ label, value, onValueChange, children }: {
    label: string;
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <span className="text-[12px] font-display font-semibold text-white/35 uppercase tracking-wider">{label}</span>
            <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger className="liquid-glass-subtle border-white/[0.08] text-white/70 hover:bg-white/[0.06] transition-all [&>span]:text-[13px] h-10">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="liquid-glass-heavy border-white/[0.1]">
                    {children}
                </SelectContent>
            </Select>
        </div>
    );
}
