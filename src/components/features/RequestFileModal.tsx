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
    const currentYear = new Date().getFullYear();
    const PAST_YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

    const defaultForm = {
        major: "",
        year: "",
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

    const handleRequestSelect = (key: string, value: string) => {
        setRequestForm(prev => ({ ...prev, [key]: value }));
    };

    const isRequestValid =
        requestForm.major &&
        requestForm.year &&
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
            year: parseInt(requestForm.year),
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
                    {/* Hierarchy Selects */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Major</Label>
                            <Select value={requestForm.major} onValueChange={(v) => handleRequestSelect("major", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Major">
                                        {requestForm.major ? (majors?.find(m => m.id === requestForm.major)?.name || requestForm.major) : undefined}
                                    </SelectValue>
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
                                    {PAST_YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                placeholder="e.g. Midterm 2023 Solutions"
                                value={requestForm.title}
                                onChange={(e) => handleRequestSelect("title", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Course {loadingCourses && <Loader2 className="h-3 w-3 animate-spin inline" />}</Label>
                            <Select value={requestForm.course} onValueChange={(v) => handleRequestSelect("course", v)} disabled={!requestForm.major || loadingCourses}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Course">
                                        {requestForm.course ? (courses?.find(c => c.id === requestForm.course)?.code + " - " + courses?.find(c => c.id === requestForm.course)?.name || requestForm.course) : undefined}
                                    </SelectValue>
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
                                    <SelectValue placeholder="Lecturer">
                                        {requestForm.lecturer ? (lecturers?.find(l => l.id === requestForm.lecturer)?.name || requestForm.lecturer) : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {lecturers?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Type {loadingTypes && <Loader2 className="h-3 w-3 animate-spin inline" />}</Label>
                            <Select value={requestForm.type} onValueChange={(v) => handleRequestSelect("type", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Type">
                                        {requestForm.type ? (types?.find(t => t.id === requestForm.type)?.display_name || requestForm.type) : undefined}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {types?.map(t => <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>)}
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

                    <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 relative">
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    handleRequestSelect("file", e.target.files[0] as any);
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
