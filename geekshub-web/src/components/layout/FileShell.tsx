import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Bot, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import { useState } from "react";

export default function FileShell() {
    const isMobile = useIsMobile();
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    if (isMobile) {
        return (
            <div className="flex h-[calc(100vh-4rem)] flex-col relative">
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>

                {/* Floating Action Button for Assistant */}
                <div className="absolute bottom-4 right-4">
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                            <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
                                <Bot className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
                            <SheetTitle className="sr-only">AI Assistant</SheetTitle>
                            <div className="p-4 border-b">
                                <h2 className="font-semibold flex items-center gap-2">
                                    <Bot className="h-4 w-4" />
                                    AI Assistant
                                </h2>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <AssistantPanel />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)]">
            <ResizablePanelGroup direction="horizontal" autoSaveId="file-shell-layout">
                <ResizablePanel defaultSize={70} minSize={30}>
                    <Outlet />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={20} collapsible={true}>
                    <div className="flex h-full flex-col border-l">
                        <div className="flex h-12 items-center border-b px-4">
                            <span className="font-semibold text-sm flex items-center gap-2">
                                <Bot className="h-4 w-4" />
                                Assistant
                            </span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <AssistantPanel />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
