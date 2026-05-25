/**
 * ============================================================================
 * AI ASSISTANT PANEL — v5
 * ============================================================================
 *  - Width/collapse fully controlled by parent (FileShell + ResizablePanel)
 *  - isOpen / onOpen / onClose props replace internal width state
 *  - When collapsed → full-height clickable strip (calls onOpen)
 *  - When open → full tabs UI (h-full w-full, no fixed widths)
 *  - Chat: prompt chips, copy, pin-to-notes, clear chat
 *  - Notes: yellow sticky cards on a dot-grid corkboard, persisted as JSON
 * ============================================================================
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, MessageCircle, StickyNote, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef } from "react";

import { AssistantChat } from "./AssistantChat";
import { NotesBoard } from "./NotesBoard";
import type { NotesBoardRef } from "./NotesBoard";

interface AssistantPanelProps {
    fileId?: string;
    fileTitle?: string;
    selectedText?: string;
    /** Controlled by FileShell via ResizablePanel callbacks */
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
}

export default function AssistantPanel({
    fileId = "",
    fileTitle = "this file",
    selectedText = "",
    isOpen = true,
    onOpen,
    onClose,
}: AssistantPanelProps) {
    const [activeTab, setActiveTab] = useState("chat");
    const [noteCount, setNoteCount] = useState(0);
    const notesBoardRef = useRef<NotesBoardRef>(null);

    return (
        <div className="relative h-full w-full overflow-hidden border-l border-border/20 bg-black/40 backdrop-blur-2xl">
            {!isOpen && (
                <button
                    onClick={onOpen}
                    className="absolute inset-0 w-full flex flex-col items-center justify-center gap-3
                               bg-transparent hover:bg-foreground/5 transition-colors"
                    title="Open AI Assistant"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl
                                    bg-blue-600
                                    shadow-lg shadow-blue-500/20">
                        <Bot className="h-4 w-4 text-foreground" />
                    </div>
                    <span
                        className="text-[11px] font-medium text-muted-foreground select-none uppercase tracking-widest"
                        style={{ writingMode: "vertical-rl" }}
                    >
                        AI Assistant
                    </span>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            <div
                className="flex h-full w-full flex-col transition-opacity duration-150"
                style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-foreground/5 shrink-0">
                        <TabsList className="flex-1 grid grid-cols-2 p-1">
                            <TabsTrigger value="chat"
                                className="gap-1.5 text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground text-muted-foreground rounded-lg transition-all"
                            >
                                <MessageCircle className="h-3.5 w-3.5" />Chat
                            </TabsTrigger>
                            <TabsTrigger value="notes"
                                className="gap-1.5 text-xs data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground text-muted-foreground rounded-lg transition-all"
                            >
                                <StickyNote className="h-3.5 w-3.5" />Notes
                                {noteCount > 0 && (
                                    <span className="ml-1 text-[10px] bg-yellow-400/80 text-yellow-900 rounded-full px-1.5 font-semibold">
                                        {noteCount}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl
                                       text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                            title="Collapse assistant"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <TabsContent value="chat" className="data-[state=active]:flex hidden flex-1 flex-col m-0 p-0 overflow-hidden min-h-0">
                        <AssistantChat
                            fileId={fileId}
                            fileTitle={fileTitle}
                            selectedText={selectedText}
                            pinToNotes={(content) => {
                                notesBoardRef.current?.pinNote(content);
                                setActiveTab("notes");
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="notes" className="data-[state=active]:flex hidden flex-1 flex-col m-0 p-0 overflow-hidden min-h-0">
                        <NotesBoard
                            ref={notesBoardRef}
                            fileId={fileId}
                            fileTitle={fileTitle}
                            onCountChange={setNoteCount}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}