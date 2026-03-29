import { useState, useEffect } from "react";
import { UploadCloud, Loader2, ChevronRight, Check } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useMajors, useCourses, useLecturers, useTypes } from "@/queries/useCatalog";
import { useCreateRequest } from "@/queries/useRequests";

interface RequestFileModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: {
        major?: string;
        course?: string;
        lecturer?: string;
        type?: string;
    };
}

// ── Static data ───────────────────────────────────────────────────────────────

const PROGRAM_YEARS = [
    { id: "1", label: "1st Year" },
    { id: "2", label: "2nd Year" },
    { id: "3", label: "3rd Year" },
    { id: "4", label: "4th Year" },
];

const currentYear = new Date().getFullYear();
const MATERIAL_YEARS = Array.from({ length: currentYear - 2016 + 1 }, (_, i) => {
    const y = (currentYear - i).toString();
    return { id: y, label: y };
});

const STEPS = [
    { id: 1, label: "Major" },
    { id: 2, label: "Course" },
    { id: 3, label: "Details" },
    { id: 4, label: "Upload" },
];

// ── Stepper bar ───────────────────────────────────────────────────────────────

function StepperBar({ current }: { current: number }) {
    return (
        <div className="flex items-stretch w-full mb-6 rounded-xl overflow-hidden">
            {STEPS.map((step, idx) => {
                const done = current > step.id;
                const active = current === step.id;
                const isLast = idx === STEPS.length - 1;

                const bg = done ? "bg-purple-600" : active ? "bg-purple-500" : "bg-white/[0.05]";
                const textColor = done || active ? "text-white" : "text-white/30";

                return (
                    <div key={step.id} className="relative flex-1 flex items-center">
                        <div
                            className={`
                                relative flex-1 flex items-center justify-center gap-2
                                py-2.5 text-[12px] font-semibold transition-all duration-300
                                ${bg} ${textColor}
                                ${idx === 0 ? "rounded-l-xl" : ""}
                                ${isLast ? "rounded-r-xl" : ""}
                            `}
                            style={{
                                paddingLeft: idx === 0 ? "16px" : "24px",
                                paddingRight: isLast ? "16px" : "8px",
                            }}
                        >
                            <span className={`
                                w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0
                                ${done || active ? "bg-white/20" : "bg-white/[0.08]"}
                            `}>
                                {done
                                    ? <Check className="h-2.5 w-2.5" />
                                    : <span>{step.id}</span>
                                }
                            </span>
                            <span className="hidden sm:block">{step.label}</span>
                        </div>

                        {/* Chevron arrow divider */}
                        {!isLast && (
                            <div
                                className="absolute right-0 top-0 bottom-0 z-10"
                                style={{
                                    width: 0,
                                    height: 0,
                                    borderTop: "20px solid transparent",
                                    borderBottom: "20px solid transparent",
                                    borderLeft: `12px solid ${done ? "#9333ea" :
                                            active ? "#a855f7" :
                                                "rgba(255,255,255,0.05)"
                                        }`,
                                    transform: "translateX(100%)",
                                }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Summary chip ──────────────────────────────────────────────────────────────

function SummaryChip({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] text-white/30">{label}</span>
            <span className="text-[11px] text-purple-300 font-medium">{value}</span>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RequestFileModal({ open, onOpenChange, initialData }: RequestFileModalProps) {
    const [step, setStep] = useState(1);

    const defaultForm = {
        major: "",
        program_year: "",   // 1–4, required — sent as `academic_year` to backend
        semester: "",   // optional filter
        course: "",
        lecturer: "",
        type_id: "",
        title: "",
        description: "",
        material_year: "",   // 2016–current, sent as `material_year` to backend
        file: null as File | null,
    };

    const [form, setForm] = useState(defaultForm);

    // ── Queries ───────────────────────────────────────────────────────────────

    const { data: majors } = useMajors();
    const { data: types, isLoading: loadingTypes } = useTypes();
    const { data: allMajorCourses, isLoading: loadingCourses } = useCourses({
        majorId: form.major,
        yearId: form.program_year || undefined,
    });
    const { data: lecturers, isLoading: loadingLecturers } = useLecturers({ courseId: form.course });
    const { mutate: submitRequest, isPending: isSubmitting } = useCreateRequest();

    const availableSemesters = allMajorCourses
        ? Array.from(new Set(allMajorCourses.map((c) => c.semester).filter(Boolean) as number[]))
        : [];
    const semesterData = availableSemesters
        .map((s) => ({ id: s.toString(), label: `Semester ${s === 1 ? "A" : "B"}` }))
        .sort((a, b) => Number(a.id) - Number(b.id));

    const filteredCourses = form.semester
        ? allMajorCourses?.filter((c) => c.semester === parseInt(form.semester))
        : allMajorCourses;

    const selectedMajor = majors?.find((m) => m.id === form.major);
    const selectedCourse = filteredCourses?.find((c) => c.id === form.course);
    const selectedLecturer = lecturers?.find((l) => l.id === form.lecturer);
    const selectedType = types?.find((t) => t.id === form.type_id);

    // ── Reset on open ─────────────────────────────────────────────────────────

    useEffect(() => {
        if (open) {
            setStep(1);
            setForm(
                initialData
                    ? { ...defaultForm, major: initialData.major || "", course: initialData.course || "", lecturer: initialData.lecturer || "", type_id: initialData.type || "" }
                    : defaultForm
            );
        }
    }, [open, initialData]);

    // ── Cascade ───────────────────────────────────────────────────────────────

    const handleCascadeSelect = (key: string, value: string) => {
        setForm((prev) => {
            const updated = { ...prev, [key]: value };
            const cascade = ["major", "program_year", "semester", "course", "lecturer"];
            const idx = cascade.indexOf(key);
            if (idx >= 0) for (let i = idx + 1; i < cascade.length; i++) (updated as any)[cascade[i]] = "";
            return updated;
        });
    };

    const set = (key: string, value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    // ── Validation per step ───────────────────────────────────────────────────

    const canProceed = () => {
        if (step === 1) return !!form.major && !!form.program_year;
        if (step === 2) return !!form.course;
        if (step === 3) return !!form.lecturer && !!form.type_id && !!form.title && !!form.material_year;
        if (step === 4) return !!form.file;
        return false;
    };

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = () => {
        submitRequest(
            {
                courseId: form.course,
                lecturerId: form.lecturer,
                type_id: form.type_id,
                title: form.title,
                academic_year: parseInt(form.program_year),
                material_year: parseInt(form.material_year),
                notes: form.description || undefined,
                file: form.file!,
            },
            { onSuccess: () => onOpenChange(false) }
        );
    };

    // ── Step content ──────────────────────────────────────────────────────────

    const renderStep = () => {
        switch (step) {

            case 1:
                return (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <p className="text-white text-[15px] font-semibold">Which major is this file for?</p>
                            <p className="text-white/35 text-[12px]">Select the academic major this material belongs to.</p>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label className="text-white/60 text-[12px]">Major</Label>
                                <Select value={form.major} onValueChange={(v) => handleCascadeSelect("major", v)}>
                                    <SelectTrigger className="liquid-glass-subtle h-11">
                                        <SelectValue placeholder="Select a major...">
                                            {form.major ? selectedMajor?.name ?? form.major : undefined}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[220px] overflow-y-auto">
                                        {majors?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white/60 text-[12px]">
                                    Program Year <span className="text-red-400">*</span>
                                </Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PROGRAM_YEARS.map((y) => (
                                        <button
                                            key={y.id}
                                            type="button"
                                            disabled={!form.major}
                                            onClick={() => handleCascadeSelect("program_year", form.program_year === y.id ? "" : y.id)}
                                            className={`
                                                py-2.5 rounded-xl text-[13px] font-medium border transition-all duration-200
                                                disabled:opacity-30 disabled:pointer-events-none
                                                ${form.program_year === y.id
                                                    ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                                                    : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.07]"
                                                }
                                            `}
                                        >
                                            {y.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <p className="text-white text-[15px] font-semibold">Select the course</p>
                            <p className="text-white/35 text-[12px]">Optionally filter by semester first.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <SummaryChip label="Major" value={selectedMajor?.name} />
                            <SummaryChip label="Year" value={PROGRAM_YEARS.find(y => y.id === form.program_year)?.label} />
                        </div>
                        <div className="space-y-3">
                            {semesterData.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-white/60 text-[12px]">Semester <span className="text-white/25 font-normal">(optional)</span></Label>
                                    <div className="flex gap-2">
                                        {semesterData.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => handleCascadeSelect("semester", form.semester === s.id ? "" : s.id)}
                                                className={`
                                                    flex-1 py-2 rounded-xl text-[13px] font-medium border transition-all duration-200
                                                    ${form.semester === s.id
                                                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                                                        : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.07]"
                                                    }
                                                `}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-white/60 text-[12px]">
                                    Course {loadingCourses && <Loader2 className="h-3 w-3 animate-spin inline ms-1" />}
                                </Label>
                                <Select value={form.course} onValueChange={(v) => handleCascadeSelect("course", v)} disabled={loadingCourses}>
                                    <SelectTrigger className="liquid-glass-subtle h-11">
                                        <SelectValue placeholder="Select a course...">
                                            {selectedCourse ? `${selectedCourse.code} — ${selectedCourse.name}` : undefined}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[240px] overflow-y-auto">
                                        {filteredCourses?.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <p className="text-white text-[15px] font-semibold">File details</p>
                            <p className="text-white/35 text-[12px]">Tell us what this file is and who it's from.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <SummaryChip label="Major" value={selectedMajor?.name} />
                            <SummaryChip label="Course" value={selectedCourse ? `${selectedCourse.code} — ${selectedCourse.name}` : undefined} />
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-white/60 text-[12px]">
                                        Lecturer {loadingLecturers && <Loader2 className="h-3 w-3 animate-spin inline" />}
                                    </Label>
                                    <Select value={form.lecturer} onValueChange={(v) => set("lecturer", v)} disabled={loadingLecturers}>
                                        <SelectTrigger className="liquid-glass-subtle h-11">
                                            <SelectValue placeholder="Select...">
                                                {form.lecturer ? selectedLecturer?.name ?? form.lecturer : undefined}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] overflow-y-auto">
                                            {lecturers?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60 text-[12px]">
                                        Type {loadingTypes && <Loader2 className="h-3 w-3 animate-spin inline" />}
                                    </Label>
                                    <Select value={form.type_id} onValueChange={(v) => set("type_id", v)}>
                                        <SelectTrigger className="liquid-glass-subtle h-11">
                                            <SelectValue placeholder="Select...">
                                                {form.type_id ? selectedType?.displayName ?? form.type_id : undefined}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] overflow-y-auto">
                                            {types?.map((t) => <SelectItem key={t.id} value={t.id}>{t.displayName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-white/60 text-[12px]">Title</Label>
                                    <Input
                                        placeholder="e.g. Midterm Solutions"
                                        value={form.title}
                                        onChange={(e) => set("title", e.target.value)}
                                        className="liquid-glass-subtle h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white/60 text-[12px]">
                                        File Year <span className="text-red-400">*</span>
                                        <span className="text-white/25 ms-1 font-normal">e.g. 2023</span>
                                    </Label>
                                    <Select value={form.material_year} onValueChange={(v) => set("material_year", v)}>
                                        <SelectTrigger className="liquid-glass-subtle h-11">
                                            <SelectValue placeholder="Year" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] overflow-y-auto">
                                            {MATERIAL_YEARS.map((y) => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white/60 text-[12px]">
                                    Description <span className="text-white/25 font-normal">(optional)</span>
                                </Label>
                                <Textarea
                                    placeholder="e.g. Week 5 Lecture Slides — covers chapters 3 and 4"
                                    value={form.description}
                                    onChange={(e) => set("description", e.target.value)}
                                    className="liquid-glass-subtle resize-none h-20"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-5">
                        <div className="space-y-1">
                            <p className="text-white text-[15px] font-semibold">Upload your file</p>
                            <p className="text-white/35 text-[12px]">PDF, PPTX, DOCX, JPG or PNG — max 25 MB.</p>
                        </div>
                        {/* Full summary before committing */}
                        <div className="flex flex-wrap gap-2">
                            <SummaryChip label="Major" value={selectedMajor?.name} />
                            <SummaryChip label="Course" value={selectedCourse?.code} />
                            <SummaryChip label="Lecturer" value={selectedLecturer?.name} />
                            <SummaryChip label="Type" value={selectedType?.displayName} />
                            <SummaryChip label="Year" value={form.material_year} />
                            <SummaryChip label="Title" value={form.title} />
                        </div>
                        {/* Drop zone */}
                        <label className={`
                            relative flex flex-col items-center justify-center gap-3
                            border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-200
                            ${form.file
                                ? "border-purple-500/50 bg-purple-500/10"
                                : "border-white/[0.1] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                            }
                        `}>
                            <input
                                type="file"
                                accept=".pdf,.pptx,.ppt,.docx,.jpg,.png"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => { if (e.target.files?.[0]) set("file", e.target.files[0] as any); }}
                            />
                            {form.file ? (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                        <Check className="h-5 w-5 text-purple-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] text-white font-medium">{form.file.name}</p>
                                        <p className="text-[11px] text-white/30 mt-0.5">
                                            {(form.file.size / 1024 / 1024).toFixed(2)} MB — click to change
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                        <UploadCloud className="h-5 w-5 text-white/30" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] text-white/60">Drag & drop or click to browse</p>
                                        <p className="text-[11px] text-white/25 mt-0.5">PDF, PPTX, DOCX, JPG, PNG</p>
                                    </div>
                                </>
                            )}
                        </label>
                    </div>
                );

            default: return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-transparent border-0 shadow-none">
                <div className="liquid-glass rounded-2xl border border-white/[0.08] p-6">

                    <DialogHeader className="mb-5">
                        <DialogTitle className="text-white text-[18px] font-display font-bold">
                            Submit a File
                        </DialogTitle>
                        <DialogDescription className="text-white/35 text-[13px]">
                            Step {step} of {STEPS.length}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stepper */}
                    <StepperBar current={step} />

                    {/* Step content — fixed min-height prevents modal resize between steps */}
                    <div className="min-h-[260px]">
                        {renderStep()}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/[0.06]">
                        <button
                            type="button"
                            onClick={() => setStep((s) => Math.max(1, s - 1))}
                            disabled={step === 1}
                            className="text-[13px] px-4 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors disabled:opacity-0 disabled:pointer-events-none"
                        >
                            Back
                        </button>

                        {step === STEPS.length ? (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-[13px] font-semibold hover:bg-purple-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                                {isSubmitting
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Submitting...</>
                                    : "Submit File"
                                }
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setStep((s) => s + 1)}
                                disabled={!canProceed()}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-[13px] font-semibold hover:bg-purple-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                                Next
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}