import { useState, useEffect } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useMajors, useCourses, useLecturers, useTypes } from "@/queries/useCatalog";
import { useCreateRequest } from "@/queries/useRequests";
import { useAuth } from "@/context/AuthContext";

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

export default function RequestFileModal({ open, onOpenChange, initialData }: RequestFileModalProps) {
    const { user } = useAuth();

    const defaultForm = {
        major: "",
        year: "",
        semester: "",
        course: "",
        lecturer: "",
        type_id: "",
        title: "",
        description: "",
        file: null as File | null,
    };

    const [requestForm, setRequestForm] = useState(defaultForm);

    // Queries
    const { data: majors } = useMajors();
    const { data: types, isLoading: loadingTypes } = useTypes();
    const { data: allMajorCourses, isLoading: loadingCourses } = useCourses({ majorId: requestForm.major });
    const { data: lecturers } = useLecturers({ courseId: requestForm.course });

    // Derive current calendar year list (matches backend `year: int` field — academic year e.g. 2024)
    const currentYear = new Date().getFullYear();
    const yearData = Array.from({ length: currentYear - 2016 + 1 }, (_, i) => ({
        id: (currentYear - i).toString(),
        label: (currentYear - i).toString(),
    }));

    // Derive available semesters from the fetched course list
    const availableSemesters = allMajorCourses
        ? Array.from(new Set(allMajorCourses.map((c) => c.semester).filter(Boolean) as number[]))
        : [];
    const semesterData = availableSemesters
        .map((s) => ({ id: s.toString(), label: `Semester ${s === 1 ? "A" : "B"}` }))
        .sort((a, b) => Number(a.id) - Number(b.id));

    // Filter courses by chosen semester
    const filteredCourses = requestForm.semester
        ? allMajorCourses?.filter((c) => c.semester === parseInt(requestForm.semester))
        : allMajorCourses;

    const { mutate: submitRequest, isPending: isSubmitting } = useCreateRequest();

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setRequestForm(
                initialData
                    ? {
                        major: initialData.major || "",
                        year: "",
                        semester: "",
                        course: initialData.course || "",
                        lecturer: initialData.lecturer || "",
                        type_id: initialData.type || "",
                        title: "",
                        description: "",
                        file: null,
                    }
                    : defaultForm
            );
        }
    }, [open, initialData]);

    // Clears all downstream fields when a parent in the cascade changes
    const handleCascadeSelect = (key: string, value: string) => {
        setRequestForm((prev) => {
            const updated = { ...prev, [key]: value };
            const cascade = ["major", "semester", "course", "lecturer"];
            const idx = cascade.indexOf(key);
            if (idx >= 0) {
                for (let i = idx + 1; i < cascade.length; i++) {
                    (updated as any)[cascade[i]] = "";
                }
            }
            return updated;
        });
    };

    const handleFieldChange = (key: string, value: string) => {
        setRequestForm((prev) => ({ ...prev, [key]: value }));
    };

    // Backend requires: course, lecturer, type_id, title, year, file
    // year is Form(...) on the backend — required
    const isRequestValid =
        requestForm.major &&
        requestForm.course &&
        requestForm.lecturer &&
        requestForm.type_id &&
        requestForm.title &&
        requestForm.year &&
        requestForm.file;

    const handleSubmit = () => {
        // userId is NOT sent — backend extracts it from the JWT cookie
        submitRequest(
            {
                courseId: requestForm.course,
                lecturerId: requestForm.lecturer,
                type_id: requestForm.type_id,   // backend field name: type_id (UUID)
                title: requestForm.title,
                year: parseInt(requestForm.year), // backend requires int, not optional
                notes: requestForm.description || undefined,
                file: requestForm.file!,
            },
            {
                onSuccess: () => onOpenChange(false),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Submit a File</DialogTitle>
                    <DialogDescription>
                        Fill in the full context for the file you are uploading.
                    </DialogDescription>
                </DialogHeader>

                {/* ALL form rows are inside this single wrapper — fixes the layout bug */}
                <div className="grid gap-4 py-4">

                    {/* Row 1: Major + Course */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Major</Label>
                            <Select
                                value={requestForm.major}
                                onValueChange={(v) => handleCascadeSelect("major", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Major">
                                        {requestForm.major
                                            ? majors?.find((m) => m.id === requestForm.major)?.name ?? requestForm.major
                                            : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {majors?.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                Course{" "}
                                {loadingCourses && <Loader2 className="h-3 w-3 animate-spin inline" />}
                            </Label>
                            <Select
                                value={requestForm.course}
                                onValueChange={(v) => handleCascadeSelect("course", v)}
                                disabled={!requestForm.major || loadingCourses}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Course">
                                        {requestForm.course
                                            ? (filteredCourses?.find((c) => c.id === requestForm.course)?.code ?? "") +
                                            " - " +
                                            (filteredCourses?.find((c) => c.id === requestForm.course)?.name ?? "")
                                            : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {filteredCourses?.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.code} - {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: Semester + Year */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Semester <span className="text-white/30 text-[11px]">(optional)</span></Label>
                            <Select
                                value={requestForm.semester}
                                onValueChange={(v) => handleCascadeSelect("semester", v)}
                                disabled={!requestForm.major || semesterData.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by Semester" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {semesterData.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            {/* Year is required on the backend (Form(...)) */}
                            <Label>Academic Year <span className="text-red-400 text-[11px]">*</span></Label>
                            <Select
                                value={requestForm.year}
                                onValueChange={(v) => handleFieldChange("year", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="e.g. 2024" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {yearData.map((y) => (
                                        <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 3: Lecturer + Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Lecturer</Label>
                            <Select
                                value={requestForm.lecturer}
                                onValueChange={(v) => handleFieldChange("lecturer", v)}
                                disabled={!requestForm.course}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Lecturer">
                                        {requestForm.lecturer
                                            ? lecturers?.find((l) => l.id === requestForm.lecturer)?.name ?? requestForm.lecturer
                                            : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {lecturers?.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                Type{" "}
                                {loadingTypes && <Loader2 className="h-3 w-3 animate-spin inline" />}
                            </Label>
                            <Select
                                value={requestForm.type_id}
                                onValueChange={(v) => handleFieldChange("type_id", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Type">
                                        {requestForm.type_id
                                            ? types?.find((t) => t.id === requestForm.type_id)?.display_name ?? requestForm.type_id
                                            : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {types?.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 4: Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Midterm 2023 Solutions"
                            value={requestForm.title}
                            onChange={(e) => handleFieldChange("title", e.target.value)}
                        />
                    </div>

                    {/* Row 5: Description (maps to `notes` on the backend) */}
                    <div className="space-y-2">
                        <Label htmlFor="desc">
                            Description <span className="text-white/30 text-[11px]">(optional)</span>
                        </Label>
                        <Textarea
                            id="desc"
                            placeholder="e.g. Week 5 Lecture Slides — covers chapters 3 and 4"
                            value={requestForm.description}
                            onChange={(e) => handleFieldChange("description", e.target.value)}
                        />
                    </div>

                    {/* Row 6: File Upload */}
                    <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 relative">
                        <input
                            type="file"
                            accept=".pdf,.pptx,.ppt,.docx,.jpg,.png"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleFieldChange("file", e.target.files[0] as any);
                                }
                            }}
                        />
                        <UploadCloud className="h-6 w-6 mb-2" />
                        <span className="text-xs">
                            {requestForm.file
                                ? requestForm.file.name
                                : "Drag & drop or click to browse"}
                        </span>
                        <span className="text-[11px] text-muted-foreground/50 mt-1">
                            PDF, PPTX, DOCX, JPG, PNG — max 25 MB
                        </span>
                    </div>

                </div>

                <DialogFooter>
                    <Button
                        type="submit"
                        disabled={!isRequestValid || isSubmitting}
                        onClick={handleSubmit}
                    >
                        {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                        Submit File
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}