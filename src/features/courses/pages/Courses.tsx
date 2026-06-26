import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, FileText, FolderOpen, Plus, Sparkles, Loader2, AlertCircle, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RequestFileModal from "@/features/admin/components/RequestFileModal";
import { RequestFilesDialog } from "@/features/courses/components/RequestFilesDialog";
import { useRequestMaterials } from "@/features/files/hooks/useMaterialRequests";

import { useMajors, useCourses, useLecturers, useTypes } from "@/features/courses/hooks/useCatalog";
import { useFiles, useTopContributors } from "@/features/files/hooks/useFiles";
import { BadgeChip } from "@/features/gamification/components/BadgeChip";
import { usePinnedCourses } from "@/features/courses/hooks/usePinnedCourses";
import { useAuth } from "@/features/auth/context/AuthContext";

/** Rank-circle styling — gold/silver/bronze for the top three, muted otherwise. */
const rankStyle = (index: number): string => {
    if (index === 0) return "bg-yellow-400/15 text-yellow-300";
    if (index === 1) return "bg-slate-300/15 text-slate-200";
    if (index === 2) return "bg-amber-500/15 text-amber-400";
    return "bg-foreground/5 text-muted-foreground/60";
};

export default function Courses() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const initialCourseId = searchParams.get("course");

    const [selections, setSelections] = useState(() => {
        const defaultMajor = localStorage.getItem("geekshub-default-major");
        const defaultYear = localStorage.getItem("geekshub-default-year");
        return {
            major: (defaultMajor && defaultMajor !== "none") ? defaultMajor : (user?.majorId || ""),
            year: (defaultYear && defaultYear !== "none") ? defaultYear : "",
            semester: "",
            course: initialCourseId || "",
            lecturer: "",
            type: ""
        };
    });

    useEffect(() => {
        // Fallback in case user loads later and no default major is set
        const defaultMajor = localStorage.getItem("geekshub-default-major");
        if (!selections.major && user?.majorId && !initialCourseId && (!defaultMajor || defaultMajor === "none")) {
            setSelections(prev => ({ ...prev, major: user.majorId as string }));
        }
    }, [user?.majorId, selections.major, initialCourseId]);

    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const [requestFilesOpen, setRequestFilesOpen] = useState(false);
    const requestMaterials = useRequestMaterials();
    const { pinnedIds, togglePin, isPinned } = usePinnedCourses();

    // -- Queries --
    const { data: majors, isLoading: bgMajors } = useMajors();
    const { data: allMajorCourses, isLoading: bgMajorCourses } = useCourses({
        majorId: selections.major
    });
    const { data: lecturers, isLoading: bgLecturers } = useLecturers({
        courseId: selections.course
    });
    const { data: types, isLoading: bgTypes } = useTypes();

    // Resolve pinned course IDs to full course objects from the API data
    const pinnedCourses = (allMajorCourses || []).filter(c => pinnedIds.includes(c.id));

    const isReadyForFiles = !!selections.course;
    const { data: files, isLoading: isLoadingFiles, isError: isErrorFiles } = useFiles({
        majorId: selections.major,
        courseId: selections.course,
        lecturerId: selections.lecturer,
        type: selections.type
    });

    const { data: topContributors, isLoading: isLoadingContributors } = useTopContributors();

    // -- Derived Hierarchical Data --
    const availableYears = allMajorCourses ? Array.from(new Set(allMajorCourses.map(c => c.yearId).filter(Boolean) as number[])) : [];
    const yearData = availableYears.map(y => ({ id: y.toString(), label: `Year ${y}` })).sort((a, b) => Number(a.id) - Number(b.id));

    const coursesInYear = selections.year ? allMajorCourses?.filter(c => c.yearId === parseInt(selections.year)) : allMajorCourses;

    const availableSemesters = coursesInYear ? Array.from(new Set(coursesInYear.map(c => c.semester).filter(Boolean) as number[])) : [];
    const semesterData = availableSemesters.map(s => ({ id: s.toString(), label: `Semester ${s === 1 ? 'A' : 'B'}` })).sort((a, b) => Number(a.id) - Number(b.id));

    const filteredCourses = selections.semester ? coursesInYear?.filter(c => c.semester === parseInt(selections.semester)) : coursesInYear;
    const courseData = filteredCourses?.map(c => ({ id: c.id, label: `${c.code} - ${c.name}` }));

    // -- Handler --
    const handleSelect = (key: string, value: string) => {
        setSelections(prev => {
            const newSelections = { ...prev, [key]: value };
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

    const selectFields = [
        { key: "major", label: "Major", data: majors?.map(m => ({ id: m.id, label: m.name })), loading: bgMajors, step: 0, placeholder: "Select Major" },
        { key: "year", label: "Year", data: yearData, loading: bgMajorCourses && !!selections.major, step: 1, placeholder: "Select Year" },
        { key: "semester", label: "Semester", data: semesterData, loading: bgMajorCourses && !!selections.major, step: 2, placeholder: "Select Semester" },
        { key: "course", label: "Course", data: courseData, loading: bgMajorCourses && !!selections.major, step: 3, placeholder: "Select Course" },
        { key: "lecturer", label: "Lecturer", data: lecturers?.map(l => ({ id: l.id, label: l.name })), loading: bgLecturers, step: 4, placeholder: "Select Lecturer" },
        { key: "type", label: "Type", data: types?.map(t => ({ id: t.id, label: t.displayName })), loading: bgTypes, step: -1, placeholder: "Select Type" },
    ];

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[32px] font-display font-bold text-foreground tracking-[-0.03em]">Course Library</h1>
                    <p className="text-muted-foreground mt-1 text-[14px]">Browse materials by hierarchy</p>
                </div>
                <button
                    onClick={() => setIsRequestOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-foreground text-[13px] font-display font-semibold hover:opacity-90 transition-all"
                    aria-label="Request a new file upload"
                >
                    <Plus className="h-4 w-4" />
                    Request File Add
                </button>
                <RequestFileModal
                    open={isRequestOpen}
                    onOpenChange={setIsRequestOpen}
                    initialData={{
                        major: selections.major,
                        course: selections.course,
                        lecturer: selections.lecturer,
                        type: selections.type || types?.find(t => t.displayName === "Notes")?.id
                    }}
                />
            </div>

            {/* Pinned Courses Section */}
            {pinnedCourses.length > 0 && (
                <div className="animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <h2 className="text-[14px] font-display font-semibold text-foreground/70">Pinned Courses</h2>
                        <span className="text-[11px] text-muted-foreground/50">({pinnedCourses.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {pinnedCourses.map(course => (
                            <button
                                key={course.id}
                                onClick={() => {
                                    setSelections({
                                        major: course.majorId || "",
                                        year: "",
                                        semester: "",
                                        course: course.id,
                                        lecturer: "",
                                        type: ""
                                    });
                                }}
                                className={`group relative liquid-glass rounded-xl p-4 text-left hover:glow-blue transition-all duration-200 ${selections.course === course.id
                                    ? "bg-blue-500/[0.08]"
                                    : ""
                                    }`}
                            >
                                {/* Color accent bar */}
                                <div className={`absolute top-0 left-4 right-4 h-[2px] rounded-b bg-gradient-to-r ${course.color} opacity-60`} />

                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-display font-bold text-foreground/90 truncate">
                                            {course.code}
                                        </p>
                                        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                                            {course.name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground/50 mt-1">
                                            {course.term}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePin(course.id);
                                        }}
                                        className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors shrink-0 ml-2"
                                        aria-label={`Unpin course ${course.code}`}
                                    >
                                        <Star className="h-3.5 w-3.5 fill-current" />
                                    </button>
                                </div>

                                {/* Arrow indicator */}
                                <div className={`absolute right-3 bottom-3 transition-opacity ${selections.course === course.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                                    }`}>
                                    <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Hierarchy Selectors */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {selectFields.map((field) => {
                    const isDisabled = field.step >= 0 ? !isStepEnabled(field.step) || !!field.loading : false;
                    const hasValue = !!selections[field.key as keyof typeof selections];

                    return (
                        <div key={field.key} className="space-y-2">
                            <label className={`text-[11px] font-display font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${hasValue ? "text-blue-300" : "text-foreground/80"}`}>
                                {field.label} {field.loading && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
                            </label>
                            <Select
                                value={selections[field.key as keyof typeof selections]}
                                onValueChange={(v) => handleSelect(field.key, v)}
                                disabled={isDisabled}
                            >
                                <SelectTrigger className={`liquid-glass-subtle font-display transition-all [&>span]:text-[13px] [&>span]:font-semibold h-10 focus:ring-2 focus:ring-blue-500/40 data-[state=open]:ring-2 data-[state=open]:ring-blue-500/50 ${hasValue ? "border-blue-500/40 text-foreground" : "border-border text-foreground/70"} ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-foreground/5"}`}>
                                    <SelectValue placeholder={field.placeholder}>
                                        {selections[field.key as keyof typeof selections] ?
                                            (field.data?.find(d => d.id === selections[field.key as keyof typeof selections])?.label)
                                            : undefined
                                        }
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="liquid-glass-heavy border-border/50">
                                    {field.data?.map((item, index) => (
                                        <SelectItem key={item.id || `select-${index}`} value={item.id || `select-${index}`} className="text-foreground/70 hover:text-foreground focus:bg-foreground/10 focus:text-foreground">
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                })}
            </div>

            {/* Results Preview Panel */}
            {isReadyForFiles ? (
                <div className="animate-fade-in liquid-glass rounded-2xl overflow-hidden min-h-[300px]">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FolderOpen className="h-4.5 w-4.5 text-blue-400" />
                            <h3 className="text-[15px] font-display font-semibold text-foreground">
                                {courseData?.find(c => c.id === selections.course)?.label || "Loading Course..."} / {types?.find(t => t.id === selections.type)?.displayName || "All"}
                            </h3>
                            <button
                                onClick={() => togglePin(selections.course)}
                                className={`p-1.5 rounded-md transition-colors ${isPinned(selections.course)
                                    ? "text-amber-400 hover:text-amber-300"
                                    : "text-muted-foreground/30 hover:text-amber-400"
                                    }`}
                            >
                                <Star className={isPinned(selections.course) ? "fill-current h-4 w-4" : "h-4 w-4"} />
                            </button>
                        </div>
                        <span className="text-[12px] px-3 py-1 rounded-lg border border-border text-muted-foreground">
                            {files?.length || 0} files found
                        </span>
                    </div>

                    {isLoadingFiles ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-10 w-10 rounded-xl bg-foreground/5" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-1/3 bg-foreground/5" />
                                        <Skeleton className="h-3 w-1/4 bg-foreground/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : isErrorFiles ? (
                        <div className="p-12 text-center">
                            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                            <p className="font-display font-semibold text-foreground mb-1">Couldn't load materials right now</p>
                            <p className="text-[13px] text-muted-foreground mb-4">Mind giving it another try?</p>
                            <Button variant="link" onClick={() => window.location.reload()} className="text-blue-400">
                                Refresh
                            </Button>
                        </div>
                    ) : files && files.length > 0 ? (
                        <div className="divide-y divide-border">
                            {files.map((file) => (
                                <div key={file.id} className="px-6 py-4 flex items-center justify-between hover:bg-foreground/5 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                            <FileText className="h-4.5 w-4.5 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-[14px] text-foreground group-hover:text-blue-300 transition-colors">
                                                {file.title}
                                            </p>
                                            <div className="flex items-center gap-2 text-[12px] text-muted-foreground/70 mt-0.5">
                                                <span>{file.materialYear}</span>
                                                {file.status === "rejected" && (
                                                    <span className="text-red-400">• {file.rejectionReason}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/courses/${file.courseId}/files/${file.id}`}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-[13px] text-foreground font-medium hover:opacity-90 transition-opacity"
                                    >
                                        {file.status === "approved" ? "Open" : "View Details"}
                                        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-muted-foreground/50">
                            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                            <p className="font-display font-semibold text-foreground/60 mb-2">We don't have materials for this yet</p>
                            <button onClick={() => setRequestFilesOpen(true)} className="text-blue-400 text-[13px] hover:underline">
                                Want to request them?
                            </button>
                            <RequestFilesDialog
                                open={requestFilesOpen}
                                onOpenChange={setRequestFilesOpen}
                                pending={requestMaterials.isPending}
                                typeLabel={types?.find(t => t.id === selections.type)?.displayName ?? "materials"}
                                onConfirm={() =>
                                    requestMaterials.mutate(
                                        { courseId: selections.course, typeId: selections.type || undefined },
                                        { onSuccess: () => setRequestFilesOpen(false) },
                                    )
                                }
                            />
                        </div>
                    )}
                </div>
            ) : (
                // Top Contributors Section
                <div className="flex justify-center pt-6">
                    <div className="w-full max-w-lg">
                        <h3 className="text-[18px] font-display font-bold text-foreground mb-4 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-400" />
                            Top Contributors
                        </h3>
                        {isLoadingContributors ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl bg-foreground/5" />)}
                            </div>
                        ) : (
                            <div className="liquid-glass rounded-2xl divide-y divide-border overflow-hidden">
                                {topContributors?.length === 0 ? (
                                    <p className="px-5 py-9 text-center text-[14px] text-muted-foreground/60">
                                        No contributors yet.
                                    </p>
                                ) : topContributors?.map((c, i) => (
                                    <div key={c.id} className="px-5 py-4 flex items-center gap-3.5 hover:bg-foreground/5 transition-colors">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-display font-bold shrink-0 ${rankStyle(i)}`}>
                                            {i + 1}
                                        </div>
                                        <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center text-[13px] font-display font-bold shrink-0">
                                            {c.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] font-semibold text-foreground truncate">{c.name}</p>
                                            <div className="mt-1">
                                                <BadgeChip tier={c.badge} />
                                            </div>
                                        </div>
                                        <span className="text-[16px] font-display font-bold text-foreground shrink-0 tabular-nums">
                                            {c.points}
                                            <span className="text-[11px] text-muted-foreground/60 font-normal ml-0.5">pts</span>
                                        </span>
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
