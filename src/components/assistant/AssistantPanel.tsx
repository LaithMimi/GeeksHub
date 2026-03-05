/**
 * ============================================================================
 * AI ASSISTANT PANEL
 * ============================================================================
 *
 * Provides a chat interface for asking questions about the current file,
 * and a notes tab for taking study notes.
 *
 * @backend See assistantService.ts for migration guide.
 * ============================================================================
 */

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Sparkles, FileText, MessageCircle, StickyNote, User, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { sendMessage, getNotes, saveNotes } from "@/services/assistantService";
import type { AssistantMessage } from "@/services/assistantService";

interface AssistantPanelProps {
    fileId?: string;
    fileTitle?: string;
}

export default function AssistantPanel({ fileId = "", fileTitle = "this file" }: AssistantPanelProps) {
    const [messages, setMessages] = useState<AssistantMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hello! 👋 I can help you study this file. Here's what I can do:\n\n• Summarize key concepts\n• Explain complex topics\n• Quiz you on the material\n• Answer specific questions",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Notes state
    const [noteContent, setNoteContent] = useState("");
    const [noteSaveStatus, setNoteSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Load notes on mount/fileId change
    useEffect(() => {
        if (!fileId) return;
        let cancelled = false;
        getNotes(fileId).then((content) => {
            if (!cancelled) setNoteContent(content);
        });
        return () => { cancelled = true; };
    }, [fileId]);

    // Debounced note save
    const handleNoteChange = useCallback((value: string) => {
        setNoteContent(value);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            if (!fileId) return;
            setNoteSaveStatus("saving");
            try {
                await saveNotes(fileId, value);
                setNoteSaveStatus("saved");
                statusTimeoutRef.current = setTimeout(() => setNoteSaveStatus("idle"), 2000);
            } catch {
                setNoteSaveStatus("error");
            }
        }, 500);
    }, [fileId]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMessage: AssistantMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsTyping(true);

        try {
            const response = await sendMessage(fileId, inputValue, messages);
            const aiMessage: AssistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch {
            const errorMessage: AssistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Something went wrong. Please try again.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex h-full flex-col bg-gradient-to-b from-background to-muted/30">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
                <div className="px-4 py-3 border-b bg-background/80 backdrop-blur-sm">
                    <TabsList className="w-full grid grid-cols-2 p-1">
                        <TabsTrigger value="chat" className="gap-2">
                            <MessageCircle className="h-4 w-4" />
                            Chat
                        </TabsTrigger>
                        <TabsTrigger value="notes" className="gap-2">
                            <StickyNote className="h-4 w-4" />
                            Notes
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div key={message.id} className={`flex gap-3 animate-fade-in ${message.role === 'user' ? 'justify-end' : ''}`}>
                                    {message.role === 'assistant' && (
                                        <div className="shrink-0 w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
                                            <Bot className="h-4 w-4 text-white" />
                                        </div>
                                    )}

                                    <div className={`flex-1 space-y-2 max-w-[85%] ${message.role === 'user' ? 'min-w-0' : ''}`}>
                                        {message.role === 'assistant' && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">GeeksHub AI</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    <Sparkles className="h-3 w-3 mr-1" />
                                                    AI
                                                </Badge>
                                            </div>
                                        )}

                                        <div className={`${message.role === 'user'
                                            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm ml-auto'
                                            : 'bg-muted/50 rounded-2xl rounded-tl-sm'
                                            } p-4 text-sm leading-relaxed whitespace-pre-wrap`}>
                                            <p>{message.content}</p>
                                        </div>
                                    </div>

                                    {message.role === 'user' && (
                                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                            <User className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Typing indicator */}
                            {isTyping && (
                                <div className="flex gap-3 animate-fade-in">
                                    <div className="shrink-0 w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="bg-muted/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                                        <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                                        <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
                        <div className="relative">
                            <Textarea
                                placeholder="Ask about this file..."
                                className="min-h-[80px] resize-none pr-14 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isTyping}
                            />
                            <Button
                                size="icon"
                                className="absolute right-2 bottom-2 h-10 w-10 rounded-full gradient-bg hover:opacity-90 transition-opacity"
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim() || isTyping}
                            >
                                {isTyping ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-3">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                                Answering from <span className="font-medium text-foreground">{fileTitle}</span>
                            </p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="notes" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
                    <div className="flex-1 p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <StickyNote className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Your Notes</span>
                            </div>
                            {noteSaveStatus === "saving" && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                                </span>
                            )}
                            {noteSaveStatus === "saved" && (
                                <span className="text-xs text-emerald-400 flex items-center gap-1 animate-fade-in">
                                    <CheckCircle className="h-3 w-3" /> Saved ✓
                                </span>
                            )}
                            {noteSaveStatus === "error" && (
                                <span className="text-xs text-red-400 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Failed to save
                                </span>
                            )}
                        </div>
                        <Textarea
                            placeholder="Take notes while studying... Your notes are saved automatically."
                            className="flex-1 resize-none bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-xl text-sm"
                            value={noteContent}
                            onChange={(e) => handleNoteChange(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground mt-2 text-center">
                            Notes for <span className="font-medium">{fileTitle}</span>
                        </p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
