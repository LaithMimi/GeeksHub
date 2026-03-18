import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Bot, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Outlet, useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import { useState, useCallback, useRef } from "react";
import { useFile } from "@/queries/useFiles";

// ---------------------------------------------------------------------------
// Context type — consumed by FileViewer via useOutletContext()
// ---------------------------------------------------------------------------

export interface FileShellOutletContext {
    onTextSelect: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FileShell() {
    const isMobile = useIsMobile();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assistantPanelRef = useRef<any>(null);

    const { fileId } = useParams();
    const { data: file, isLoading, isError } = useFile(fileId ?? "");

    // ── selectedText bridge ──────────────────────────────────────────────────
    // FileViewer (child route) calls onTextSelect when the user clicks "Ask AI"
    // on a PDF text selection. We forward it to AssistantPanel as selectedText.
    // The setTimeout reset ensures repeated selections of identical text still
    // trigger AssistantPanel's useEffect (value must change to fire).
    const [selectedText, setSelectedText] = useState("");

    const handleTextSelect = useCallback((text: string) => {
        setSelectedText(text);
        setTimeout(() => setSelectedText(""), 0);
    }, []);

    // Passed via Outlet context → consumed in FileViewer with useOutletContext()
    const outletContext: FileShellOutletContext = { onTextSelect: handleTextSelect };

    // ── Shared content slot ───────────────────────────────────────────────────
    const Content = () => {
        if (isLoading) return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
        if (isError) return (
            <div className="h-full flex flex-col items-center justify-center text-red-500">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>Error loading file.</p>
            </div>
        );
        // Pass onTextSelect down to FileViewer via React Router outlet context
        return <Outlet context={outletContext} />;
    };

    // ── Mobile layout ─────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <div className="flex h-[calc(100vh-4rem)] flex-col relative">
                <div className="flex-1 overflow-auto">
                    <Content />
                </div>

                {/* Floating Action Button → bottom sheet assistant */}
                <div className="absolute bottom-4 right-4">
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                            <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
                                <Bot className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
                            <SheetTitle className="sr-only">AI Assistant</SheetTitle>
                            <div className="flex-1 overflow-hidden">
                                <AssistantPanel
                                    fileId={fileId}
                                    fileTitle={file?.title}
                                    selectedText={selectedText}
                                />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        );
    }

    // ── Desktop layout ────────────────────────────────────────────────────────
    // AssistantPanel owns its own header (tabs + collapse button) so we no
    // longer need the "Assistant" label wrapper div that was here before.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PanelGroup = ResizablePanelGroup as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PanelAny = ResizablePanel as any;

    return (
        <div className="h-[calc(100vh-4rem)]">
            <PanelGroup direction="horizontal">

                <PanelAny defaultSize={70} minSize={30}>
                    <Content />
                </PanelAny>

                <ResizableHandle withHandle />

                <PanelAny
                    ref={assistantPanelRef}
                    defaultSize={30}
                    minSize={15}
                    collapsible={true}
                    collapsedSize={4}
                    onCollapse={() => setIsAssistantOpen(false)}
                    onExpand={() => setIsAssistantOpen(true)}
                >
                    <AssistantPanel
                        fileId={fileId}
                        fileTitle={file?.title}
                        selectedText={selectedText}
                        isOpen={isAssistantOpen}
                        onOpen={() => assistantPanelRef.current?.expand()}
                        onClose={() => assistantPanelRef.current?.collapse()}
                    />
                </PanelAny>

            </PanelGroup>
        </div>
    );
}