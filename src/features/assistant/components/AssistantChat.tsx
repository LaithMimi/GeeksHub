import { useState, useRef, useEffect } from "react";
import { SelectionPopup } from "@/components/ui/selection-popup";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Bot, Send, Sparkles, FileText,
    User, Loader2, CheckCircle,
    Copy, Trash2, BookOpen, Search,
} from "lucide-react";
import { sendMessage } from "@/features/assistant/api/assistantService";
import type { AssistantMessage } from "@/features/assistant/api/assistantService";
import { makeWelcome } from "./NotesBoard";

const SUGGESTED_PROMPTS = [
    "Summarize the key concepts",
    "Quiz me on this material",
    "Explain the hardest topic here",
    "What are the main takeaways?",
];

function RichContent({ content }: { content: string }) {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return (
        <p className="whitespace-pre-wrap leading-relaxed">
            {parts.map((part, i) =>
                part.startsWith("**") && part.endsWith("**")
                    ? <strong key={i}>{part.slice(2, -2)}</strong>
                    : part
            )}
        </p>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    async function handleCopy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    return (
        <button onClick={handleCopy}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
            {copied
                ? <><CheckCircle className="h-3 w-3 text-emerald-400" />Copied</>
                : <><Copy className="h-3 w-3" />Copy</>
            }
        </button>
    );
}

interface AssistantChatProps {
    fileId: string;
    fileTitle: string;
    selectedText: string;
    pinToNotes: (content: string) => void;
}

export function AssistantChat({ fileId, fileTitle, selectedText, pinToNotes }: AssistantChatProps) {
    const [messages, setMessages] = useState<AssistantMessage[]>(() => {
        try {
            const saved = localStorage.getItem(`geekshub_chat_${fileId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        return [makeWelcome(fileTitle)];
    });
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [showChips, setShowChips] = useState(() => messages.length <= 1);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    useEffect(() => {
        localStorage.setItem(`geekshub_chat_${fileId}`, JSON.stringify(messages));
    }, [messages, fileId]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(`geekshub_chat_${fileId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages([
                        { ...parsed[0], content: makeWelcome(fileTitle).content },
                        ...parsed.slice(1),
                    ]);
                    setShowChips(parsed.length <= 1);
                    return;
                }
            }
        } catch (e) {}
        
        setMessages([makeWelcome(fileTitle)]);
        setShowChips(true);
    }, [fileId, fileTitle]);

    useEffect(() => {
        if (!selectedText) return;
        setInputValue(`Explain this: "${selectedText}"`);
    }, [selectedText]);

    function clearChat() {
        setMessages([makeWelcome(fileTitle)]);
        setShowChips(true);
    }

    async function sendMsg(override?: string) {
        const text = (override ?? inputValue).trim();
        if (!text) return;
        setMessages(prev => [...prev, {
            id: Date.now().toString(), role: "user", content: text, timestamp: new Date(),
        }]);
        setInputValue("");
        setIsTyping(true);
        setShowChips(false);
        try {
            const { reply, agentAction } = await sendMessage(fileId, text, messages);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: "assistant", content: reply, timestamp: new Date(), agentAction,
            }]);
        } catch {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: "assistant",
                content: "Something went wrong. Please try again.", timestamp: new Date(),
            }]);
        } finally {
            setIsTyping(false);
        }
    }

    function onChatKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    }

    return (
        <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden min-h-0">
            {messages.length > 1 && (
                <div className="flex justify-end px-4 pt-3 shrink-0">
                    <button onClick={clearChat}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
                    >
                        <Trash2 className="h-3 w-3" />Clear
                    </button>
                </div>
            )}

            <ScrollArea className="flex-1 min-h-0 p-4">
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}>
                            {msg.role === "assistant" && (
                                <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Bot className="h-4 w-4 text-foreground" />
                                </div>
                            )}

                            <div className={`flex-1 space-y-1.5 max-w-[85%] ${msg.role === "user" ? "min-w-0" : ""}`}>
                                {msg.role === "assistant" && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-[13px] text-foreground/90">GeeksHub AI</span>
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-300 border-none">
                                            <Sparkles className="h-3 w-3 mr-1" />AI
                                        </Badge>
                                    </div>
                                )}

                                <div className={`${msg.role === "user"
                                    ? "bg-blue-600 text-foreground rounded-2xl rounded-tr-sm ml-auto shadow-lg shadow-blue-500/20"
                                    : "bg-foreground/5 border border-border text-foreground/90 rounded-2xl rounded-tl-sm"
                                    } p-4 text-[13px] leading-relaxed backdrop-blur-sm`}
                                >
                                    <RichContent content={msg.content} />
                                </div>

                                {msg.role === "assistant" && msg.id !== "1" && (
                                    <div className="flex items-center gap-3 pl-1 mt-1">
                                        <CopyButton text={msg.content} />
                                        <button onClick={() => pinToNotes(msg.content)}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <BookOpen className="h-3 w-3" />Pin to notes
                                        </button>
                                        {msg.agentAction === "tool_used" && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 ml-auto">
                                                <Search className="h-2.5 w-2.5" />
                                                searched course files
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {msg.role === "user" && (
                                <div className="shrink-0 w-8 h-8 rounded-xl bg-foreground/10 flex items-center justify-center border border-border/20">
                                    <User className="h-4 w-4 text-foreground/80" />
                                </div>
                            )}
                        </div>
                    ))}

                    {showChips && (
                        <div className="flex flex-wrap gap-2 pt-2 pb-1">
                            {SUGGESTED_PROMPTS.map((p) => (
                                <button key={p} onClick={() => sendMsg(p)}
                                    className="text-[11px] px-3.5 py-1.5 rounded-full border border-border/50 bg-foreground/5 hover:bg-foreground/10 hover:border-border/80 text-foreground/60 hover:text-foreground transition-all"
                                >{p}</button>
                            ))}
                        </div>
                    )}

                    {isTyping && (
                        <div className="flex gap-3">
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-foreground" />
                            </div>
                            <div className="bg-foreground/5 border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:0ms]" />
                                <span className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:150ms]" />
                                <span className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:300ms]" />
                            </div>
                        </div>
                    )}

                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="p-4 border-t border-border bg-foreground/5 shrink-0">
                <div className="relative">
                    <Textarea
                        placeholder="Ask about this file..."
                        maxLength={2000}
                        className="min-h-[80px] resize-none pr-14 bg-foreground/5 border border-border
                                   focus-visible:ring-1 focus-visible:ring-blue-500/50
                                   rounded-2xl text-[13px] text-foreground placeholder:text-muted-foreground/50 transition-all"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={onChatKey}
                        disabled={isTyping}
                    />
                    <Button
                        size="icon"
                        className="absolute right-2.5 bottom-2.5 h-9 w-9 rounded-xl
                                   bg-blue-600
                                   hover:opacity-90 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                        onClick={() => sendMsg()}
                        disabled={!inputValue.trim() || isTyping}
                    >
                        {isTyping
                            ? <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                            : <Send className="h-4 w-4 text-foreground" />
                        }
                    </Button>
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 text-muted-foreground/50">
                    <FileText className="h-3.5 w-3.5" />
                    <p className="text-[11px] truncate uppercase tracking-widest font-medium">
                        Answering from <span className="font-bold text-muted-foreground">{fileTitle}</span>
                    </p>
                </div>
            </div>

            <SelectionPopup
                containerRef={containerRef}
                onPinToNotes={pinToNotes}
                onAskAI={(text) => setInputValue(`Explain this: "${text}"`)}
            />
        </div>
    );
}
