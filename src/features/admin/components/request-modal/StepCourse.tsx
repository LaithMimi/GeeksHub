import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { FormState } from "./useRequestForm";
import { PROGRAM_YEARS } from "./useRequestForm";
import { SummaryChip } from "./SummaryChip";

interface StepCourseProps {
    form: FormState;
    handleCascadeSelect: (key: keyof FormState, value: string) => void;
    semesterData: { id: string; label: string }[];
    filteredCourses: any[] | undefined;
    selectedMajor: any | undefined;
    selectedCourse: any | undefined;
    loadingCourses: boolean;
}

export function StepCourse({
    form,
    handleCascadeSelect,
    semesterData,
    filteredCourses,
    selectedMajor,
    selectedCourse,
    loadingCourses
}: StepCourseProps) {
    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <p className="text-foreground text-[15px] font-semibold">Select the course</p>
                <p className="text-muted-foreground/70 text-[12px]">Optionally filter by semester first.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <SummaryChip label="Major" value={selectedMajor?.name} />
                <SummaryChip label="Year" value={PROGRAM_YEARS.find(y => y.id === form.program_year)?.label} />
            </div>
            <div className="space-y-3">
                {semesterData.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-foreground/60 text-[12px]">Semester <span className="text-muted-foreground/50 font-normal">(optional)</span></Label>
                        <div className="flex gap-2">
                            {semesterData.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleCascadeSelect("semester", form.semester === s.id ? "" : s.id)}
                                    className={`
                                        flex-1 py-2 rounded-xl text-[13px] font-medium border transition-all duration-200
                                        ${form.semester === s.id
                                            ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                            : "bg-foreground/5 border-border text-muted-foreground hover:text-foreground/70 hover:bg-white/[0.07]"
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
                    <Label className="text-foreground/60 text-[12px]">
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
}
