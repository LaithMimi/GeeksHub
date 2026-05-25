import { useState, useEffect } from "react";

export const PROGRAM_YEARS = [
    { id: "1", label: "1st Year" },
    { id: "2", label: "2nd Year" },
    { id: "3", label: "3rd Year" },
    { id: "4", label: "4th Year" },
];

const currentYear = new Date().getFullYear();
export const MATERIAL_YEARS = Array.from({ length: currentYear - 2016 + 1 }, (_, i) => {
    const y = (currentYear - i).toString();
    return { id: y, label: y };
});

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [".pdf", ".pptx", ".ppt", ".docx", ".jpg", ".jpeg", ".png"];

export function validateFile(file: File): string | null {
    const name = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        return "Unsupported file type. Use PDF, PPTX, DOCX, JPG, or PNG.";
    }
    if (file.size > MAX_FILE_SIZE) {
        return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`;
    }
    return null;
}

export interface FormState {
    major: string;
    program_year: string;
    semester: string;
    course: string;
    lecturer: string;
    type_id: string;
    title: string;
    description: string;
    material_year: string;
    file: File | null;
}

const defaultForm: FormState = {
    major: "",
    program_year: "",
    semester: "",
    course: "",
    lecturer: "",
    type_id: "",
    title: "",
    description: "",
    material_year: "",
    file: null,
};

export function useRequestForm(open: boolean, initialData?: { major?: string; course?: string; lecturer?: string; type?: string }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<FormState>(defaultForm);
    const [fileError, setFileError] = useState("");

    useEffect(() => {
        if (open) {
            setStep(1);
            setFileError("");
            setForm(
                initialData
                    ? { ...defaultForm, major: initialData.major || "", course: initialData.course || "", lecturer: initialData.lecturer || "", type_id: initialData.type || "" }
                    : defaultForm
            );
        }
    }, [open, initialData]);

    const handleCascadeSelect = (key: keyof FormState, value: string) => {
        setForm((prev) => {
            const updated = { ...prev, [key]: value };
            const cascade: (keyof FormState)[] = ["major", "program_year", "semester", "course", "lecturer"];
            const idx = cascade.indexOf(key);
            if (idx >= 0) {
                for (let i = idx + 1; i < cascade.length; i++) {
                    const cascadeKey = cascade[i];
                    if (cascadeKey !== "file") {
                         updated[cascadeKey] = "";
                    }
                }
                updated.file = null;
            }
            return updated;
        });
        setFileError("");
    };

    const set = (key: keyof FormState, value: any) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const canProceed = () => {
        if (step === 1) return !!form.major && !!form.program_year;
        if (step === 2) return !!form.course;
        if (step === 3) return !!form.lecturer && !!form.type_id && !!form.title && !!form.material_year;
        if (step === 4) return !!form.file && !fileError;
        return false;
    };

    const buildPayload = () => {
        if (!form.file) return null;
        return {
            courseId: form.course,
            lecturerId: form.lecturer,
            type_id: form.type_id,
            title: form.title,
            academic_year: parseInt(form.program_year),
            material_year: parseInt(form.material_year),
            notes: form.description || undefined,
            file: form.file,
        };
    };

    return {
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
    };
}
