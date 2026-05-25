import { Loader2, ChevronRight, Check } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

import { useMajors, useCourses, useLecturers, useTypes } from "@/features/courses/hooks/useCatalog";
import { useCreateRequest } from "@/features/files/hooks/useRequests";

import { useRequestForm, validateFile } from "./request-modal/useRequestForm";
import { StepMajor } from "./request-modal/StepMajor";
import { StepCourse } from "./request-modal/StepCourse";
import { StepDetails } from "./request-modal/StepDetails";
import { StepUpload } from "./request-modal/StepUpload";

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

const STEPS = [
    { id: 1, label: "Major" },
    { id: 2, label: "Course" },
    { id: 3, label: "Details" },
    { id: 4, label: "Upload" },
];

function StepperBar({ current }: { current: number }) {
    return (
        <div className="flex items-stretch w-full mb-6 rounded-xl overflow-hidden">
            {STEPS.map((step, idx) => {
                const done = current > step.id;
                const active = current === step.id;
                const isLast = idx === STEPS.length - 1;

                const bg = done ? "bg-blue-600" : active ? "bg-blue-500" : "bg-white/[0.05]";
                const textColor = done || active ? "text-foreground" : "text-muted-foreground/50";

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
                                ${done || active ? "bg-foreground/20" : "bg-foreground/10"}
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
                                    borderLeft: `12px solid ${done ? "#2563eb" :
                                        active ? "#3b82f6" :
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

export default function RequestFileModal({ open, onOpenChange, initialData }: RequestFileModalProps) {
    const {
        form,
        setForm,
        step,
        setStep,
        fileError,
        setFileError,
        handleCascadeSelect,
        set,
        canProceed,
        buildPayload,
    } = useRequestForm(open, initialData);

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

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = () => {
        const payload = buildPayload();
        if (!payload) return;
        const err = validateFile(payload.file);
        if (err) {
            setFileError(err);
            return;
        }
        submitRequest(
            payload,
            { onSuccess: () => onOpenChange(false) }
        );
    };

    // ── Step content ──────────────────────────────────────────────────────────

    const renderStep = () => {
        switch (step) {
            case 1:
                return <StepMajor form={form} handleCascadeSelect={handleCascadeSelect} majors={majors} selectedMajor={selectedMajor} />;
            case 2:
                return <StepCourse form={form} handleCascadeSelect={handleCascadeSelect} semesterData={semesterData} filteredCourses={filteredCourses} selectedMajor={selectedMajor} selectedCourse={selectedCourse} loadingCourses={loadingCourses} />;
            case 3:
                return <StepDetails form={form} set={set} lecturers={lecturers} loadingLecturers={loadingLecturers} selectedLecturer={selectedLecturer} types={types} loadingTypes={loadingTypes} selectedType={selectedType} selectedMajor={selectedMajor} selectedCourse={selectedCourse} />;
            case 4:
                return <StepUpload form={form} setForm={setForm} fileError={fileError} setFileError={setFileError} selectedMajor={selectedMajor} selectedCourse={selectedCourse} selectedLecturer={selectedLecturer} selectedType={selectedType} />;
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-transparent border-0 shadow-none">
                <div className="liquid-glass rounded-2xl border border-border p-6">

                    <DialogHeader className="mb-5">
                        <DialogTitle className="text-foreground text-[18px] font-display font-bold">
                            Submit a File
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground/70 text-[13px]">
                            Step {step} of {STEPS.length}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stepper */}
                    <StepperBar current={step} />

                    {/* Step content — fixed min-height prevents modal resize between steps */}
                    <div className={`min-h-[260px] transition-opacity ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}>
                        {renderStep()}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between pt-5 mt-5 border-t border-border">
                        <button
                            type="button"
                            onClick={() => setStep((s) => Math.max(1, s - 1))}
                            disabled={step === 1 || isSubmitting}
                            className={`text-[13px] px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground/70 hover:bg-foreground/5 transition-colors disabled:pointer-events-none ${step === 1 ? "opacity-0" : isSubmitting ? "opacity-50" : ""}`}
                        >
                            Back
                        </button>

                        {step === STEPS.length ? (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!canProceed() || isSubmitting}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-foreground text-[13px] font-semibold hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-foreground text-[13px] font-semibold hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
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