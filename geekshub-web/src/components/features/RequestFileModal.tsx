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
import { Textarea } from "@/components/ui/textarea";

import { useMajors, useYears, useSemesters, useCourses, useLecturers } from "@/queries/useCatalog";
import { useCreateRequest } from "@/queries/useRequests";
import type { MaterialType } from "@/types/domain";

const DEMO_TYPES: MaterialType[] = ["Slides", "Homeworks", "Past Papers", "Notes"];
const DEMO_USER_ID = "u1";

interface RequestFileModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: {
        major?: string;
        year?: string;
        semester?: string;
        course?: string;
        lecturer?: string;
        type?: string;
    };
}

export default function RequestFileModal({ open, onOpenChange, initialData }: RequestFileModalProps) {
    const defaultForm = {
        major: "",
        year: "",
        semester: "",
        course: "",
        lecturer: "",
        type: "",
        description: ""
    };

    const [requestForm, setRequestForm] = useState(defaultForm);

    // Queries
    const { data: majors } = useMajors();
    const { data: years } = useYears(requestForm.major);
    const { data: semesters } = useSemesters(requestForm.major);
    // Only fetch courses if major is selected
    const { data: courses, isLoading: loadingCourses } = useCourses({ majorId: requestForm.major });
    const { data: lecturers } = useLecturers({ courseId: requestForm.course });

    const { mutate: submitRequest, isPending: isSubmitting } = useCreateRequest();

    useEffect(() => {
        if (open) {
            if (initialData) {
                setRequestForm({
                    major: initialData.major || "",
                    year: initialData.year || "",
                    semester: initialData.semester || "",
                    course: initialData.course || "",
                    lecturer: initialData.lecturer || "",
                    type: initialData.type || "",
                    description: ""
                });
            } else {
                setRequestForm(defaultForm);
            }
        }
    }, [open, initialData]);

    const handleRequestSelect = (key: string, value: string) => {
        setRequestForm(prev => ({ ...prev, [key]: value }));
    };

    const isRequestValid =
        requestForm.major &&
        requestForm.year &&
        requestForm.semester &&
        requestForm.course &&
        requestForm.lecturer &&
        requestForm.type;

    const handleSubmit = () => {
        submitRequest({
            userId: DEMO_USER_ID,
            courseId: requestForm.course,
            lecturerId: requestForm.lecturer, // In real app, name lookup or ID
            type: requestForm.type as MaterialType,
            title: "New Request", // Title isn't in form? Adding default or need input
            notes: requestForm.description
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
                    {/* Hierarchy Selects */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Major</Label>
                            <Select value={requestForm.major} onValueChange={(v) => handleRequestSelect("major", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Major" />
                                </SelectTrigger>
                                <SelectContent>
                                    {majors?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Year</Label>
                            <Select value={requestForm.year} onValueChange={(v) => handleRequestSelect("year", v)} disabled={!requestForm.major}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years?.map(y => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Semester</Label>
                            <Select value={requestForm.semester} onValueChange={(v) => handleRequestSelect("semester", v)} disabled={!requestForm.major}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Semester" />
                                </SelectTrigger>
                                <SelectContent>
                                    {semesters?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Course {loadingCourses && <Loader2 className="h-3 w-3 animate-spin inline" />}</Label>
                            <Select value={requestForm.course} onValueChange={(v) => handleRequestSelect("course", v)} disabled={!requestForm.major || loadingCourses}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Course" />
                                </SelectTrigger>
                                <SelectContent>
                                    {courses?.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Lecturer</Label>
                            <Select value={requestForm.lecturer} onValueChange={(v) => handleRequestSelect("lecturer", v)} disabled={!requestForm.course}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Lecturer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lecturers?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={requestForm.type} onValueChange={(v) => handleRequestSelect("type", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEMO_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="desc">Description</Label>
                        <Textarea
                            id="desc"
                            placeholder="e.g. Week 5 Lecture Slides details"
                            value={requestForm.description}
                            onChange={(e) => handleRequestSelect("description", e.target.value)}
                        />
                    </div>

                    <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50">
                        <UploadCloud className="h-6 w-6 mb-2" />
                        <span className="text-xs">Drag & drop or Click to browse</span>
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
