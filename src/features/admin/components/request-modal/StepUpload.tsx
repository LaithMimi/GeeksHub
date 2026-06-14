import { UploadCloud, Check } from "lucide-react";
import type { FormState } from "./useRequestForm";
import { validateFile } from "./useRequestForm";
import { SummaryChip } from "./SummaryChip";
import { Dispatch, SetStateAction } from "react";

interface StepUploadProps {
    form: FormState;
    setForm: Dispatch<SetStateAction<FormState>>;
    fileError: string;
    setFileError: (err: string) => void;
    selectedMajor: any | undefined;
    selectedCourse: any | undefined;
    selectedLecturer: any | undefined;
    selectedType: any | undefined;
}

export function StepUpload({
    form,
    setForm,
    fileError,
    setFileError,
    selectedMajor,
    selectedCourse,
    selectedLecturer,
    selectedType
}: StepUploadProps) {
    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <p className="text-foreground text-[15px] font-semibold">Upload your file</p>
                <p className="text-muted-foreground/70 text-[12px]">PDF, PPTX, DOCX, JPG or PNG — max 15 MB.</p>
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
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-border/50 bg-foreground/5 hover:border-border/80 hover:bg-foreground/5"
                }
            `}>
                <input
                    type="file"
                    accept=".pdf,.pptx,.ppt,.docx,.jpg,.jpeg,.png"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const err = validateFile(f);
                        if (err) {
                            setFileError(err);
                            setForm((prev) => ({ ...prev, file: null }));
                            return;
                        }
                        setFileError("");
                        setForm((prev) => ({ ...prev, file: f }));
                    }}
                />
                {form.file ? (
                    <>
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                            <Check className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-[13px] text-foreground font-medium">{form.file.name}</p>
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                                {(form.file.size / 1024 / 1024).toFixed(2)} MB — click to change
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-border flex items-center justify-center">
                            <UploadCloud className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <div className="text-center">
                            <p className="text-[13px] text-foreground/60">Drag & drop or click to browse</p>
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5">PDF, PPTX, DOCX, JPG, PNG</p>
                        </div>
                    </>
                )}
            </label>
            {fileError && (
                <p className="text-red-400 text-[12px] mt-1">{fileError}</p>
            )}
        </div>
    );
}
