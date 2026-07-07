import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { Course, Lecturer, Major, MaterialTypeOption } from "@/types/domain";
import type { FormState } from "./useRequestForm";
import { MATERIAL_YEARS } from "./useRequestForm";
import { SummaryChip } from "./SummaryChip";

interface StepDetailsProps {
    form: FormState;
    set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
    lecturers: Lecturer[] | undefined;
    loadingLecturers: boolean;
    selectedLecturer: Lecturer | undefined;
    types: MaterialTypeOption[] | undefined;
    loadingTypes: boolean;
    selectedType: MaterialTypeOption | undefined;
    selectedMajor: Major | undefined;
    selectedCourse: Course | undefined;
}

export function StepDetails({
    form,
    set,
    lecturers,
    loadingLecturers,
    selectedLecturer,
    types,
    loadingTypes,
    selectedType,
    selectedMajor,
    selectedCourse
}: StepDetailsProps) {
    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <p className="text-foreground text-[15px] font-semibold">File details</p>
                <p className="text-muted-foreground/70 text-[12px]">Tell us what this file is and who it's from.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <SummaryChip label="Major" value={selectedMajor?.name} />
                <SummaryChip label="Course" value={selectedCourse ? `${selectedCourse.code} — ${selectedCourse.name}` : undefined} />
            </div>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label className="text-foreground/60 text-[12px]">
                            Lecturer <span className="text-red-400">*</span> {loadingLecturers && <Loader2 className="h-3 w-3 animate-spin inline" />}
                        </Label>
                        <Select value={form.lecturer} onValueChange={(v) => set("lecturer", v)} disabled={loadingLecturers}>
                            <SelectTrigger className="liquid-glass-subtle h-11">
                                <SelectValue placeholder="Select...">
                                    {selectedLecturer?.name}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px] overflow-y-auto">
                                {lecturers?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/60 text-[12px]">
                            Type <span className="text-red-400">*</span> {loadingTypes && <Loader2 className="h-3 w-3 animate-spin inline" />}
                        </Label>
                        <Select value={form.type_id} onValueChange={(v) => set("type_id", v)}>
                            <SelectTrigger className="liquid-glass-subtle h-11">
                                <SelectValue placeholder="Select...">
                                    {selectedType?.displayName}
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
                        <Label className="text-foreground/60 text-[12px]">Title <span className="text-red-400">*</span></Label>
                        <Input
                            placeholder="e.g. Midterm Solutions"
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            className="liquid-glass-subtle h-11"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground/60 text-[12px]">
                            File Year <span className="text-red-400">*</span>
                            <span className="text-muted-foreground/50 ms-1 font-normal">e.g. 2023</span>
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
                    <Label className="text-foreground/60 text-[12px]">
                        Description <span className="text-red-400">*</span>
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
}
