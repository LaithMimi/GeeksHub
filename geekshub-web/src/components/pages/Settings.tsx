import { useState, useEffect } from "react";
import { Bell, Monitor, Globe, BookOpen, Brain, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { majors, years, userRequests } from "@/lib/data";
import { Link } from "react-router-dom";

// Language Options with native names and direction
const languages = [
    { code: "en", name: "English", dir: "ltr" },
    { code: "ar", name: "العربية", dir: "rtl" },
    { code: "he", name: "עברית", dir: "rtl" },
];

export default function Settings() {
    // --- State Management ---
    const [language, setLanguage] = useState(() => localStorage.getItem("language") || "en");
    const [theme, setTheme] = useState("system");
    const [textSize, setTextSize] = useState("medium");
    const [notifications, setNotifications] = useState({
        newMaterials: true,
        adminUpdates: true
    });

    // Study Defaults State
    const [defaultMajor, setDefaultMajor] = useState(majors[0]);
    const [defaultYear, setDefaultYear] = useState(years[0]);

    // AI State
    const [aiSourceExpanded, setAiSourceExpanded] = useState(true);
    const [aiScope, setAiScope] = useState("file");
    const [reduceMotion, setReduceMotion] = useState(false);

    // --- Language Persistence & Direction ---
    useEffect(() => {
        const selectedLang = languages.find(l => l.code === language);
        if (selectedLang) {
            document.documentElement.lang = selectedLang.code;
            document.documentElement.dir = selectedLang.dir;
            localStorage.setItem("language", language);
        }
    }, [language]);

    return (
        <div className="animate-fade-in max-w-3xl mx-auto pb-20">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur py-4 mb-6 border-b flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-sm text-muted-foreground">Manage your preferences and defaults</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Saved
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. Study Defaults */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <CardTitle>Study Defaults</CardTitle>
                        </div>
                        <CardDescription>Pre-fill your search and browse filters.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Default Major</Label>
                                <Select value={defaultMajor} onValueChange={setDefaultMajor}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Major" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {majors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Default Year</Label>
                                <Select value={defaultYear} onValueChange={setDefaultYear}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. AI Preferences */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-purple-500" />
                            <CardTitle>AI Preferences</CardTitle>
                        </div>
                        <CardDescription>Customize how the AI assistant behaves.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Explain Sources</Label>
                                <p className="text-sm text-muted-foreground">Always expand source citations in chat.</p>
                            </div>
                            <Switch checked={aiSourceExpanded} onCheckedChange={setAiSourceExpanded} />
                        </div>
                        <div className="space-y-2 pt-2">
                            <Label>Default Scope</Label>
                            <Select value={aiScope} onValueChange={setAiScope}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="file">Current File Only</SelectItem>
                                    <SelectItem value="course">Entire Course</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Notifications */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-amber-500" />
                            <CardTitle>Notifications</CardTitle>
                        </div>
                        <CardDescription>Choose what you want to be alerted about.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">New Materials</Label>
                                <p className="text-sm text-muted-foreground">Notify when files are added to my courses.</p>
                            </div>
                            <Switch checked={notifications.newMaterials} onCheckedChange={(v: boolean) => setNotifications(prev => ({ ...prev, newMaterials: v }))} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Request Updates</Label>
                                <p className="text-sm text-muted-foreground">Notify status changes for my uploads.</p>
                            </div>
                            <Switch checked={notifications.adminUpdates} onCheckedChange={(v: boolean) => setNotifications(prev => ({ ...prev, adminUpdates: v }))} />
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Accessibility & Appearance */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Monitor className="h-5 w-5 text-blue-500" />
                            <CardTitle>Appearance & Accessibility</CardTitle>
                        </div>
                        <CardDescription>Customize the interface for your needs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Language Selector */}
                        <div className="space-y-3 pb-4 border-b">
                            <div className="space-y-1">
                                <Label className="text-base">Language</Label>
                                <p className="text-sm text-muted-foreground">
                                    Changes the interface language. Some course files may still be in their original language.
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger className="w-[180px]">
                                        <Globe className="mr-2 h-4 w-4 opacity-50" />
                                        <SelectValue placeholder="Select Language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {languages.map(lang => (
                                            <SelectItem key={lang.code} value={lang.code}>
                                                <div className="flex items-center justify-between w-full gap-4">
                                                    <span>{lang.name}</span>
                                                    {lang.dir === 'rtl' && <Badge variant="outline" className="text-[10px] px-1 h-5">RTL</Badge>}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Theme</Label>
                                <Select value={theme} onValueChange={setTheme}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Text Size</Label>
                                <Select value={textSize} onValueChange={setTextSize}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="small">Small</SelectItem>
                                        <SelectItem value="medium">Medium (Default)</SelectItem>
                                        <SelectItem value="large">Large</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Reduce Motion</Label>
                                <p className="text-sm text-muted-foreground">Minimize animations across the app.</p>
                            </div>
                            <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Request Status Snapshot */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>Active Requests</CardTitle>
                        </div>
                        <CardDescription>A quick glance at your file submission statuses.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {userRequests.length > 0 ? (
                            <div className="space-y-2">
                                {userRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50">
                                        <span className="truncate max-w-[200px]">{req.title}</span>
                                        {req.status === 'pending' && <Badge variant="secondary" className="bg-amber-100 text-amber-700">Pending</Badge>}
                                        {req.status === 'approved' && <Badge variant="secondary" className="bg-green-100 text-green-700">Approved</Badge>}
                                        {req.status === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No active requests.</p>
                        )}
                        <Button variant="link" className="px-0 mt-2 h-auto" asChild>
                            <Link to="/uploads">Manage all uploads</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
