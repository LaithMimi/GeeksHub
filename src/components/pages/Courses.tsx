import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, FileText, FolderOpen, Plus, Sparkles, Loader2, AlertCircle, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RequestFileModal from "@/components/features/RequestFileModal";

import { useMajors, useCourses, useLecturers, useTypes } from "@/queries/useCatalog";
import { useFiles, useTopContributors } from "@/queries/useFiles";
import { usePinnedCourses } from "@/hooks/usePinnedCourses";
import { courses as allCourses } from "@/mock/mock-db";
import { useAuth } from "@/context/AuthContext";

export default function Courses() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const initialCourseId = searchParams.get("course");
    const initialCourse = initialCourseId ? allCourses.find(c => c.id === initialCourseId) : null;

    const [selections, setSelections] = useState({
        major: initialCourse?.majorId || user?.majorId || "",
        year: "",
        semester: initialCourse?.semesterId || "",
        course: initialCourseId || "",
        lecturer: "",
        type: ""
    });

    useEffect(() => {
        // Fallback in case user loads later
        if (!selections.major && user?.majorId && !initialCourseId) {
            setSelections(prev => ({ ...prev, major: user.majorId as string }));
        }
    }, [user?.majorId, selections.major, initialCourseId]);

    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const { pinnedIds, togglePin, isPinned } = usePinnedCourses();

    // Resolve pinned course IDs to full course objects
    const pinnedCourses = allCourses.filter(c => pinnedIds.includes(c.id));

    // -- Queries --
    const { data: majors, isLoading: bgMajors } = useMajors();
    const { data: allMajorCourses, isLoading: bgMajorCourses } = useCourses({
        majorId: selections.major
    });
    const { data: lecturers, isLoading: bgLecturers } = useLecturers({
        courseId: selections.course
    });
    const { data: types, isLoading: bgTypes } = useTypes();

    const isReadyForFiles = !!selections.course;
    const { data: files, isLoading: isLoadingFiles, isError: isErrorFiles } = useFiles({
        majorId: selections.major,
        courseId: selections.course,
        lecturerId: selections.lecturer,
        type: selections.type
    });

    const { data: topContributors, isLoading: isLoadingContributors } = useTopContributors();

    // -- Derived Hierarchical Data --
    const availableYears = allMajorCourses ? Array.from(new Set(allMajorCourses.map(c => c.year_id).filter(Boolean) as number[])) : [];
    const yearData = availableYears.map(y => ({ id: y.toString(), label: `Year ${y}` })).sort((a, b) => Number(a.id) - Number(b.id));

    const coursesInYear = selections.year ? allMajorCourses?.filter(c => c.year_id === parseInt(selections.year)) : allMajorCourses;

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
        { key: "type", label: "Type", data: types?.map(t => ({ id: t.id, label: t.display_name })), loading: bgTypes, step: -1, placeholder: "Select Type" },
    ];

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[32px] font-display font-bold text-white tracking-[-0.03em]">Course Library</h1>
                    <p className="text-white/40 mt-1 text-[14px]">Browse materials by hierarchy</p>
                </div>
                <button
                    onClick={() => setIsRequestOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-[13px] font-display font-semibold glow-purple-soft hover:opacity-90 transition-opacity"
                >
                    <Plus className="h-4 w-4" />
                    Request File Add
                </button>
                <RequestFileModal
                    open={isRequestOpen}
                    onOpenChange={setIsRequestOpen}
                    initialData={{
                        major: selections.major,
                        year: selections.year,
                        course: selections.course,
                        lecturer: selections.lecturer,
                        type: selections.type || types?.find(t => t.display_name === "Notes")?.id
                    }}
                />
            </div>

            {/* Pinned Courses Section */}
            {pinnedCourses.length > 0 && (
                <div className="animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <h2 className="text-[14px] font-display font-semibold text-white/70">Pinned Courses</h2>
                        <span className="text-[11px] text-white/30">({pinnedCourses.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {pinnedCourses.map(course => (
                            <button
                                key={course.id}
                                onClick={() => {
                                    setSelections({
                                        major: course.majorId || "",
                                        year: "",
                                        semester: course.semesterId || "",
                                        course: course.id,
                                        lecturer: "",
                                        type: ""
                                    });
                                }}
                                className={`group relative liquid-glass rounded-xl p-4 text-left hover:bg-white/[0.06] transition-all duration-200 border ${selections.course === course.id
                                    ? "border-purple-500/40 bg-purple-500/[0.08]"
                                    : "border-white/[0.06] hover:border-white/[0.12]"
                                    }`}
                            >
                                {/* Color accent bar */}
                                <div className={`absolute top-0 left-4 right-4 h-[2px] rounded-b bg-gradient-to-r ${course.color} opacity-60`} />

                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-display font-bold text-white/90 truncate">
                                            {course.code}
                                        </p>
                                        <p className="text-[12px] text-white/40 mt-0.5 truncate">
                                            {course.name}
                                        </p>
                                        <p className="text-[11px] text-white/25 mt-1">
                                            {course.term}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePin(course.id);
                                        }}
                                        className="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors shrink-0 ml-2"
                                        title="Unpin course"
                                    >
                                        <Star className="h-3.5 w-3.5 fill-current" />
                                    </button>
                                </div>

                                {/* Arrow indicator */}
                                <div className={`absolute right-3 bottom-3 transition-opacity ${selections.course === course.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                                    }`}>
                                    <ChevronRight className="h-3.5 w-3.5 text-purple-400" />
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

                    return (
                        <div key={field.key} className="space-y-2">
                            <label className="text-[11px] font-display font-semibold text-white/35 uppercase tracking-wider flex items-center gap-2">
                                {field.label} {field.loading && <Loader2 className="h-3 w-3 animate-spin text-purple-400" />}
                            </label>
                            <Select
                                value={selections[field.key as keyof typeof selections]}
                                onValueChange={(v) => handleSelect(field.key, v)}
                                disabled={isDisabled}
                            >
                                <SelectTrigger className={`liquid-glass-subtle border-white/[0.08] text-white/70 transition-all [&>span]:text-[13px] h-10 ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/[0.06]"}`}>
                                    <SelectValue placeholder={field.placeholder}>
                                        {selections[field.key as keyof typeof selections] ?
                                            (field.data?.find(d => d.id === selections[field.key as keyof typeof selections])?.label || selections[field.key as keyof typeof selections])
                                            : undefined
                                        }
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="liquid-glass-heavy border-white/[0.1]">
                                    {field.data?.map(item => (
                                        <SelectItem key={item.id} value={item.id} className="text-white/70 hover:text-white focus:bg-white/[0.08] focus:text-white">
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
                    <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FolderOpen className="h-4.5 w-4.5 text-purple-400" />
                            <h3 className="text-[15px] font-display font-semibold text-white">
                                {courseData?.find(c => c.id === selections.course)?.label || selections.course} / {selections.type || "All"}
                            </h3>
                            <button
                                onClick={() => togglePin(selections.course)}
                                className={`p-1.5 rounded-md transition-colors ${isPinned(selections.course)
                                    ? "text-amber-400 hover:text-amber-300"
                                    : "text-white/20 hover:text-amber-400"
                                    }`}
                            >
                                <Star className={isPinned(selections.course) ? "fill-current h-4 w-4" : "h-4 w-4"} />
                            </button>
                        </div>
                        <span className="text-[12px] px-3 py-1 rounded-lg border border-white/[0.08] text-white/40">
                            {files?.length || 0} files found
                        </span>
                    </div>

                    {isLoadingFiles ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-10 w-10 rounded-xl bg-white/[0.06]" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-1/3 bg-white/[0.06]" />
                                        <Skeleton className="h-3 w-1/4 bg-white/[0.04]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : isErrorFiles ? (
                        <div className="p-12 text-center">
                            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                            <p className="font-display font-semibold text-white mb-1">Couldn't load materials right now</p>
                            <p className="text-[13px] text-white/40 mb-4">Mind giving it another try?</p>
                            <Button variant="link" onClick={() => window.location.reload()} className="text-purple-400">
                                Refresh
                            </Button>
                        </div>
                    ) : files && files.length > 0 ? (
                        <div className="divide-y divide-white/[0.06]">
                            {files.map((file) => (
                                <div key={file.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                            <FileText className="h-4.5 w-4.5 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-[14px] text-white group-hover:text-purple-300 transition-colors">
                                                {file.title}
                                            </p>
                                            <div className="flex items-center gap-2 text-[12px] text-white/35 mt-0.5">
                                                <span>{file.lecturer}</span>
                                                <span>•</span>
                                                <span>{file.date}</span>
                                                <span>•</span>
                                                <span>{file.size}</span>
                                                {file.status === "rejected" && (
                                                    <span className="text-red-400">• {file.rejectionReason}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/courses/${file.courseId}/files/${file.id}`}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-[13px] text-white font-medium hover:opacity-90 transition-opacity"
                                    >
                                        {file.status === "approved" ? "Open" : "View Details"}
                                        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-white/30">
                            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                            <p className="font-display font-semibold text-white/60 mb-2">We don't have materials for this yet</p>
                            <button onClick={() => setIsRequestOpen(true)} className="text-purple-400 text-[13px] hover:underline">
                                Want to request them?
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // Top Contributors Section
                <div className="flex justify-center pt-6">
                    <div className="w-full max-w-md">
                        <h3 className="text-[16px] font-display font-bold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-400" />
                            Top Contributors
                        </h3>
                        {isLoadingContributors ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl bg-white/[0.06]" />)}
                            </div>
                        ) : (
                            <div className="liquid-glass rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
                                {topContributors?.map((c, i) => (
                                    <div key={c.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
                                        <div className="font-display font-bold text-white/25 w-4 text-center text-[13px]">
                                            {i + 1}
                                        </div>
                                        <div className="h-8 w-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center text-[12px] font-display font-bold">
                                            {c.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[13px] font-medium text-white truncate">{c.name}</p>
                                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/40">
                                                    {c.points} pts
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[11px] text-white/30 truncate">{c.major}</p>
                                                {c.badge === "Gold" && <span className="text-[10px] text-yellow-400 font-medium">Gold</span>}
                                                {c.badge === "Silver" && <span className="text-[10px] text-slate-300 font-medium">Silver</span>}
                                                {c.badge === "Bronze" && <span className="text-[10px] text-amber-500 font-medium">Bronze</span>}
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
