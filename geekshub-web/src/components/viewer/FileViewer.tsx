import { FileText, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export default function FileViewer() {
    return (
        <div className="h-full flex flex-col bg-muted/30">
            {/* Viewer Toolbar */}
            <div className="flex items-center justify-between p-3 border-b bg-background">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-medium text-sm">Introduction to Algorithms.pdf</h3>
                        <p className="text-xs text-muted-foreground">Page 3 of 42 • 2.4 MB</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zoom Out</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Badge variant="secondary" className="mx-1">100%</Badge>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zoom In</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Separator orientation="vertical" className="mx-2 h-6" />
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Bookmark className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bookmark Page</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Download className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* PDF Viewer Area */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl aspect-[8.5/11] flex flex-col items-center justify-center p-12 text-center">
                    <div className="mb-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4 mx-auto">
                            <FileText className="h-10 w-10 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Introduction to Algorithms</h2>
                        <p className="text-sm text-gray-500">Chapter 3: Asymptotic Notation</p>
                    </div>

                    <div className="w-full space-y-3 text-left text-sm text-gray-600">
                        <p className="leading-relaxed">
                            <strong className="text-gray-900">Big-O Notation (O)</strong> provides an upper bound on the growth rate of a function.
                            It describes the worst-case scenario for algorithm performance.
                        </p>
                        <p className="leading-relaxed">
                            <strong className="text-gray-900">Big-Omega Notation (Ω)</strong> provides a lower bound, describing the best-case
                            performance of an algorithm.
                        </p>
                        <p className="leading-relaxed">
                            <strong className="text-gray-900">Big-Theta Notation (Θ)</strong> describes tight bounds, meaning the algorithm's
                            performance is bounded both above and below.
                        </p>
                    </div>

                    <div className="mt-8 text-xs text-gray-400">
                        This is a placeholder preview. Actual PDF rendering will be implemented.
                    </div>
                </div>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center justify-center gap-4 p-3 border-t bg-background">
                <Button variant="outline" size="sm" className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Button>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Page</span>
                    <input
                        type="number"
                        value={3}
                        className="w-12 h-8 text-center border rounded-md text-sm"
                        readOnly
                    />
                    <span className="text-muted-foreground">of 42</span>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
