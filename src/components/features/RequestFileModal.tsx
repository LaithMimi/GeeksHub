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
        year?: string;
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
        type: "",
        title: "",
        description: "",
        file: null as File | null
    };

    const [requestForm, setRequestForm] = useState(defaultForm);

    // Queries
    const { data: majors } = useMajors();
    const { data: types, isLoading: loadingTypes } = useTypes();
    const { data: allMajorCourses, isLoading: loadingCourses } = useCourses({ majorId: requestForm.major });
    const { data: lecturers } = useLecturers({ courseId: requestForm.course });

    // -- Derived Hierarchical Data (same as Courses page) --
    const availableYears = allMajorCourses
        ? Array.from(new Set(allMajorCourses.map(c => c.year_id).filter(Boolean) as number[]))
        : [];
    const yearData = availableYears
        .map(y => ({ id: y.toString(), label: y === 1 ? "1st Year" : y === 2 ? "2nd Year" : y === 3 ? "3rd Year" : `${y}th Year` }))
        .sort((a, b) => Number(a.id) - Number(b.id));

    const coursesInYear = requestForm.year
        ? allMajorCourses?.filter(c => c.year_id === parseInt(requestForm.year))
        : allMajorCourses;

    const availableSemesters = coursesInYear
        ? Array.from(new Set(coursesInYear.map(c => c.semester).filter(Boolean) as number[]))
        : [];
    const semesterData = availableSemesters
        .map(s => ({ id: s.toString(), label: `Semester ${s === 1 ? "A" : "B"}` }))
        .sort((a, b) => Number(a.id) - Number(b.id));

    const filteredCourses = requestForm.semester
        ? coursesInYear?.filter(c => c.semester === parseInt(requestForm.semester))
        : coursesInYear;

    const { mutate: submitRequest, isPending: isSubmitting } = useCreateRequest();

    useEffect(() => {
        if (open) {
            if (initialData) {
                setRequestForm({
                    major: initialData.major || "",
                    year: initialData.year || "",
                    semester: "",
                    course: initialData.course || "",
                    lecturer: initialData.lecturer || "",
                    type: initialData.type || "",
                    title: "",
                    description: "",
                    file: null
                });
            } else {
                setRequestForm(defaultForm);
            }
        }
    }, [open, initialData]);

    const handleCascadeSelect = (key: string, value: string) => {
        setRequestForm(prev => {
            const updated = { ...prev, [key]: value };
            // Clear downstream selections when a parent changes
            const cascade = ["major", "year", "semester", "course", "lecturer"];
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
        setRequestForm(prev => ({ ...prev, [key]: value }));
    };

    const isRequestValid =
        requestForm.major &&
        requestForm.course &&
        requestForm.lecturer &&
        requestForm.type &&
        requestForm.title &&
        requestForm.file;

    const handleSubmit = () => {
        submitRequest({
            userId: user!.id,
            courseId: requestForm.course,
            lecturerId: requestForm.lecturer,
            type: requestForm.type,
            title: requestForm.title,
            year: requestForm.year ? parseInt(requestForm.year) : undefined,
            notes: requestForm.description,
            file: requestForm.file!
        }, {
            onSuccess: () => {
                onOpenChange(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Request File Addition</DialogTitle>
                    <DialogDescription>
                        Please specify the full context for the file you are requesting.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Row 1: Major + Year */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Major</Label>
                            <Select value={requestForm.major} onValueChange={(v) => handleCascadeSelect("major", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Major">
                                        {requestForm.major ? (majors?.find(m => m.id === requestForm.major)?.name || requestForm.major) : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {majors?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Year {loadingCourses && requestForm.major && <Loader2 className="h-3 w-3 animate-spin inline" />}</Label>
                            <Select value={requestForm.year} onValueChange={(v) => handleCascadeSelect("year", v)} disabled={!requestForm.major || yearData.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {yearData.map(y => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: Semester + Course */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Semester</Label>
                            <Select value={requestForm.semester} onValueChange={(v) => handleCascadeSelect("semester", v)} disabled={!requestForm.year || semesterData.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Semester" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {semesterData.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Course {loadingCourses && <Loader2 className="h-3 w-3 animate-spin inline" />}</Label>
                            <Select value={requestForm.course} onValueChange={(v) => handleCascadeSelect("course", v)} disabled={!requestForm.major || loadingCourses}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Course">
                                        {requestForm.course ? (filteredCourses?.find(c => c.id === requestForm.course)?.code + " - " + filteredCourses?.find(c => c.id === requestForm.course)?.name || requestForm.course) : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {filteredCourses?.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 3: Lecturer + Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Lecturer</Label>
                            <Select value={requestForm.lecturer} onValueChange={(v) => handleFieldChange("lecturer", v)} disabled={!requestForm.course}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Lecturer">
                                        {requestForm.lecturer ? (lecturers?.find(l => l.id === requestForm.lecturer)?.name || requestForm.lecturer) : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {lecturers?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Type {loadingTypes && <Loader2 className="h-3 w-3 animate-spin inline" />}</Label>
                            <Select value={requestForm.type} onValueChange={(v) => handleFieldChange("type", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Type">
                                        {requestForm.type ? (types?.find(t => t.id === requestForm.type)?.display_name || requestForm.type) : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {types?.map(t => <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>)}
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

                    <div className="space-y-2">
                        <Label htmlFor="desc">Description</Label>
                        <Textarea
                            id="desc"
                            placeholder="e.g. Week 5 Lecture Slides details"
                            value={requestForm.description}
                            onChange={(e) => handleFieldChange("description", e.target.value)}
                        />
                    </div>

                    <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 relative">
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    handleFieldChange("file", e.target.files[0] as any);
                                }
                            }}
                        />
                        <UploadCloud className="h-6 w-6 mb-2" />
                        <span className="text-xs">
                            {requestForm.file ? requestForm.file.name : "Drag & drop or Click to browse"}
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
                        Submit Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
