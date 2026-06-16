import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Major } from "@/types/domain";
import type { FormState } from "./useRequestForm";
import { PROGRAM_YEARS } from "./useRequestForm";

interface StepMajorProps {
    form: FormState;
    handleCascadeSelect: (key: keyof FormState, value: string) => void;
    majors: Major[] | undefined;
    selectedMajor: Major | undefined;
}

export function StepMajor({ form, handleCascadeSelect, majors, selectedMajor }: StepMajorProps) {
    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <p className="text-foreground text-[15px] font-semibold">Which major is this file for?</p>
                <p className="text-muted-foreground/70 text-[12px]">Select the academic major this material belongs to.</p>
            </div>
            <div className="space-y-3">
                <div className="space-y-2">
                    <Label className="text-foreground/60 text-[12px]">Major</Label>
                    <Select value={form.major} onValueChange={(v) => handleCascadeSelect("major", v)}>
                        <SelectTrigger className="liquid-glass-subtle h-11">
                            <SelectValue placeholder="Select a major...">
                                {selectedMajor?.name}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-[220px] overflow-y-auto">
                            {majors?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-foreground/60 text-[12px]">
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
                                        ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                        : "bg-foreground/5 border-border text-muted-foreground hover:text-foreground/70 hover:bg-white/[0.07]"
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
}
