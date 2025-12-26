import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, File, FileText, FolderOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    majors,
    years,
    semesters,
    coursesHierarchy,
    lecturers,
    types,
    allFiles
} from "@/lib/data";

export default function Courses() {
    const [selections, setSelections] = useState({
        major: "",
        year: "",
        semester: "",
        course: "",
        lecturer: "",
        type: ""
    });

    const isStepEnabled = (stepIndex: number) => {
        const keys = Object.keys(selections);
        if (stepIndex === 0) return true;
        return selections[keys[stepIndex - 1] as keyof typeof selections] !== "";
    };

    const handleSelect = (key: string, value: string) => {
        setSelections(prev => {
            const newSelections = { ...prev, [key]: value };
            // Reset subsequent selections
            const keys = Object.keys(prev);
            const index = keys.indexOf(key);
            for (let i = index + 1; i < keys.length; i++) {
                newSelections[keys[i] as keyof typeof selections] = "";
            }
            return newSelections;
        });
    };

    const isFullySelected = Object.values(selections).every(v => v !== "");

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">Course Library</h1>
                <p className="text-muted-foreground">Browse materials by hierarchy</p>
            </div>

            {/* Hierarchy Selectors */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Major</label>
                    <Select value={selections.major} onValueChange={(v) => handleSelect("major", v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Major" />
                        </SelectTrigger>
                        <SelectContent>
                            {majors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Year</label>
                    <Select value={selections.year} onValueChange={(v) => handleSelect("year", v)} disabled={!isStepEnabled(1)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Semester</label>
                    <Select value={selections.semester} onValueChange={(v) => handleSelect("semester", v)} disabled={!isStepEnabled(2)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Semester" />
                        </SelectTrigger>
                        <SelectContent>
                            {semesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Course</label>
                    <Select value={selections.course} onValueChange={(v) => handleSelect("course", v)} disabled={!isStepEnabled(3)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Course" />
                        </SelectTrigger>
                        <SelectContent>
                            {selections.major && coursesHierarchy[selections.major as keyof typeof coursesHierarchy]?.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Lecturer</label>
                    <Select value={selections.lecturer} onValueChange={(v) => handleSelect("lecturer", v)} disabled={!isStepEnabled(4)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Lecturer" />
                        </SelectTrigger>
                        <SelectContent>
                            {lecturers.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Type</label>
                    <Select value={selections.type} onValueChange={(v) => handleSelect("type", v)} disabled={!isStepEnabled(5)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results Preview Panel */}
            {isFullySelected && (
                <div className="animate-fade-in border rounded-xl overflow-hidden bg-card shadow-sm">
                    <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">
                            {selections.course} / {selections.type}
                        </h3>
                        <Badge variant="secondary" className="ml-auto">
                            {allFiles.length} files found
                        </Badge>
                    </div>
                    <div className="divide-y">
                        {allFiles.map((file) => (
                            <div key={file.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm group-hover:text-primary transition-colors">{file.title}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <span>{file.lecturer}</span>
                                            <span>•</span>
                                            <span>{file.date}</span>
                                            <span>•</span>
                                            <span>{file.size}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button asChild size="sm" className="gap-2">
                                    <Link to={`/courses/cs101/files/${file.id}`}>
                                        Open
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
