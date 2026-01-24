import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText, FolderOpen, Plus, Sparkles, Loader2, AlertCircle, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import RequestFileModal from "@/components/features/RequestFileModal";

import { useMajors, useYears, useSemesters, useCourses, useLecturers } from "@/queries/useCatalog";
import { useFiles, useTopContributors } from "@/queries/useFiles";
import { usePinnedCourses } from "@/hooks/usePinnedCourses";
import type { MaterialType } from "@/types/domain";

const DEMO_TYPES: MaterialType[] = ["Slides", "Homeworks", "Past Papers", "Notes"];

export default function Courses() {
    const [selections, setSelections] = useState({
        major: "",
        year: "",
        semester: "",
        course: "",
        lecturer: "",
        type: ""
    });

    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const { togglePin, isPinned } = usePinnedCourses();

    // -- Queries --
    const { data: majors, isLoading: bgMajors } = useMajors();
    const { data: years, isLoading: bgYears } = useYears(selections.major);
    const { data: semesters, isLoading: bgSemesters } = useSemesters(selections.major);
    const { data: courses, isLoading: bgCourses } = useCourses({
        majorId: selections.major,
        // yearId: selections.year, // Optional in our service, but good to filter if service supported it
        semesterId: selections.semester
    });
    const { data: lecturers, isLoading: bgLecturers } = useLecturers({
        courseId: selections.course
    });

    // Files Query - only fetch if we have enough info? Or at least course?
    const isReadyForFiles = !!selections.course;
    const { data: files, isLoading: isLoadingFiles, isError: isErrorFiles } = useFiles({
        majorId: selections.major,
        courseId: selections.course,
        lecturerId: selections.lecturer, // Note: service expects ID, but our UI currently might be mixing name/ID. 
        // In this refactor, let's assume UI selects ID or Name depending on what service returns. 
        // Our service returns Lecturer objects { id, name }.
        // But the File object has `lecturer` string (name). 
        // Ideally we filter by ID in backend. Let's pass the value from Select (which should be ID).
        type: selections.type
    });

    const { data: topContributors, isLoading: isLoadingContributors } = useTopContributors();

    // -- Handler --
    const handleSelect = (key: string, value: string) => {
        setSelections(prev => {
            const newSelections = { ...prev, [key]: value };
            // Reset subsequent selections to avoid invalid states
            const keys = Object.keys(prev);
            const index = keys.indexOf(key);
            for (let i = index + 1; i < keys.length; i++) {
                newSelections[keys[i] as keyof typeof selections] = "";
            }
            return newSelections;
        });
    };

    const isStepEnabled = (stepIndex: number) => {
        const keys = Object.keys(selections);
        if (stepIndex === 0) return true;
        return selections[keys[stepIndex - 1] as keyof typeof selections] !== "";
    };

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Course Library</h1>
                    <p className="text-muted-foreground">Browse materials by hierarchy</p>
                </div>
                <Button onClick={() => setIsRequestOpen(true)}>
                    <Plus className="me-2 h-4 w-4" />
                    Request File Add
                </Button>
                <RequestFileModal
                    open={isRequestOpen}
                    onOpenChange={setIsRequestOpen}
                    initialData={{
                        major: selections.major,
                        year: selections.year,
                        semester: selections.semester,
                        course: selections.course,
                        lecturer: selections.lecturer,
                        type: selections.type || "Notes"
                    }}
                />
            </div>

            {/* Hierarchy Selectors */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Major */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                        Major {bgMajors && <Loader2 className="h-3 w-3 animate-spin" />}
                    </label>
                    <Select value={selections.major} onValueChange={(v) => handleSelect("major", v)} disabled={bgMajors}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Major" />
                        </SelectTrigger>
                        <SelectContent>
                            {majors?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {/* Year */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                        Year {bgYears && <Loader2 className="h-3 w-3 animate-spin" />}
                    </label>
                    <Select value={selections.year} onValueChange={(v) => handleSelect("year", v)} disabled={!isStepEnabled(1) || bgYears}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years?.map(y => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {/* Semester */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                        Semester {bgSemesters && <Loader2 className="h-3 w-3 animate-spin" />}
                    </label>
                    <Select value={selections.semester} onValueChange={(v) => handleSelect("semester", v)} disabled={!isStepEnabled(2) || bgSemesters}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Semester" />
                        </SelectTrigger>
                        <SelectContent>
                            {semesters?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {/* Course */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                        Course {bgCourses && <Loader2 className="h-3 w-3 animate-spin" />}
                    </label>
                    <Select value={selections.course} onValueChange={(v) => handleSelect("course", v)} disabled={!isStepEnabled(3) || bgCourses}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Course" />
                        </SelectTrigger>
                        <SelectContent>
                            {courses?.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Lecturer */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
                        Lecturer {bgLecturers && <Loader2 className="h-3 w-3 animate-spin" />}
                    </label>
                    <Select value={selections.lecturer} onValueChange={(v) => handleSelect("lecturer", v)} disabled={!isStepEnabled(4) || bgLecturers}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Lecturer" />
                        </SelectTrigger>
                        <SelectContent>
                            {lecturers?.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {/* Type */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase flex items-center">Type</label>
                    <Select value={selections.type} onValueChange={(v) => handleSelect("type", v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {DEMO_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results Preview Panel / Content Area */}
            {isReadyForFiles ? (
                <div className="animate-fade-in border rounded-xl overflow-hidden bg-card shadow-sm min-h-[300px]">
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FolderOpen className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">
                                {selections.course} / {selections.type || "All"}
                            </h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => togglePin(selections.course)}
                                className={isPinned(selections.course) ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500"}
                            >
                                <Star className={isPinned(selections.course) ? "fill-current h-5 w-5" : "h-5 w-5"} />
                            </Button>
                        </div>
                        <Badge variant="secondary">
                            {files?.length || 0} files found
                        </Badge>
                    </div>

                    {isLoadingFiles ? (
                        <div className="p-4 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-12 w-12 rounded-lg" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : isErrorFiles ? (
                        <div className="p-12 text-center">
                            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                            <p className="font-semibold mb-1">Couldn't load materials right now</p>
                            <p className="text-sm text-muted-foreground mb-4">Mind giving it another try?</p>
                            <Button variant="link" onClick={() => window.location.reload()}>Refresh</Button>
                        </div>
                    ) : files && files.length > 0 ? (
                        <div className="divide-y">
                            {files.map((file) => (
                                <div key={file.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm group-hover:text-primary transition-colors">{file.title}</p>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <span>{file.lecturer}</span>
                                                <span>•</span>
                                                <span>{file.date}</span>
                                                <span>•</span>
                                                <span>{file.size}</span>
                                                {file.status === "rejected" && (
                                                    <span className="text-red-500">• Reason: {file.rejectionReason}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button asChild size="sm" className="gap-2" disabled={file.status !== "approved"}>
                                        <Link to={`/courses/${file.courseId}/files/${file.id}`}>
                                            {file.status === "approved" ? "Open" : "View Details"}
                                            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                                        </Link>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-muted-foreground">
                            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="font-semibold mb-1">We don't have materials for this yet</p>
                            <Button variant="link" onClick={() => setIsRequestOpen(true)}>Want to request them?</Button>
                        </div>
                    )}
                </div>
            ) : (
                // Top Contributors Section (Show when not searching)
                <div className="flex justify-center pt-8 border-t">
                    <div className="w-full max-w-md">
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Top Contributors
                        </h3>
                        {isLoadingContributors ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                            </div>
                        ) : (
                            <div className="bg-card rounded-xl border shadow-sm divide-y">
                                {topContributors?.map((c, i) => (
                                    <div key={c.id} className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                                        <div className="font-bold text-muted-foreground w-4 text-center text-sm">
                                            {i + 1}
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-background">
                                            {c.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium truncate">{c.name}</p>
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                                    {c.points} pts
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[10px] text-muted-foreground truncate">{c.major}</p>
                                                {c.badge === "Gold" && <span className="text-[10px] text-yellow-500 font-medium">Gold</span>}
                                                {c.badge === "Silver" && <span className="text-[10px] text-slate-400 font-medium">Silver</span>}
                                                {c.badge === "Bronze" && <span className="text-[10px] text-amber-600 font-medium">Bronze</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
