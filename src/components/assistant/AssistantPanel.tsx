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

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Bot, Send, Sparkles, FileText, MessageCircle,
    StickyNote, User, Loader2, CheckCircle, AlertCircle,
    Copy, Trash2, BookOpen, ChevronLeft, ChevronRight, Plus, X,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { sendMessage, getNotes, saveNotes } from "@/services/assistantService";
import type { AssistantMessage } from "@/services/assistantService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssistantPanelProps {
    fileId?: string;
    fileTitle?: string;
    selectedText?: string;
    /** Controlled by FileShell via ResizablePanel callbacks */
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
}

interface StickyNoteCard {
    id: string;
    text: string;
    rotation: number;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
    "Summarize the key concepts",
    "Quiz me on this material",
    "Explain the hardest topic here",
    "What are the main takeaways?",
];

const ROTATIONS = [-2, -1, 0, 1, 2, -1.5, 1.5, -0.5, 0.5, 2];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWelcomeMessage(fileTitle: string) {
    return `I've loaded **${fileTitle}**. Ask me anything about it — I can summarize key concepts, explain difficult topics, or quiz you on the material.`;
}

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

// ---------------------------------------------------------------------------
// StickyCard
// ---------------------------------------------------------------------------

function StickyCard({ note, onDelete }: { note: StickyNoteCard; onDelete: (id: string) => void }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            className="group relative p-3 rounded-sm shadow-md cursor-default bg-gradient-to-br from-yellow-100 to-yellow-300 dark:from-yellow-200/90 dark:to-yellow-500/90"
            style={{
                transform: hovered ? "rotate(0deg) scale(1.05)" : `rotate(${note.rotation}deg)`,
                minHeight: "90px",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.22)" : "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-yellow-600/50" />
            <button
                onClick={() => onDelete(note.id)}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100
                           w-5 h-5 flex items-center justify-center rounded-full
                           bg-black/10 hover:bg-red-400/40 transition-all"
                title="Remove note"
            >
                <X className="h-2.5 w-2.5 text-yellow-900" />
            </button>
            <p className="mt-3 text-[12px] leading-relaxed break-words font-medium text-yellow-900 font-sans"
            >
                {note.text}
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    async function handleCopy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    return (
        <button onClick={handleCopy}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40 hover:text-white transition-colors"
        >
            {copied
                ? <><CheckCircle className="h-3 w-3 text-emerald-400" />Copied</>
                : <><Copy className="h-3 w-3" />Copy</>
            }
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AssistantPanel({
    fileId = "",
    fileTitle = "this file",
    selectedText = "",
    isOpen = true,
    onOpen,
    onClose,
}: AssistantPanelProps) {

    // ── Chat ─────────────────────────────────────────────────────────────────

    const makeWelcome = (): AssistantMessage => ({
        id: "1",
        role: "assistant",
        content: buildWelcomeMessage(fileTitle),
        timestamp: new Date(),
    });

    const [messages, setMessages] = useState<AssistantMessage[]>([makeWelcome()]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [showChips, setShowChips] = useState(true);
    const [activeTab, setActiveTab] = useState("chat");
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── Notes ─────────────────────────────────────────────────────────────────

    const [cards, setCards] = useState<StickyNoteCard[]>([]);
    const [noteInput, setNoteInput] = useState("");
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Effects ───────────────────────────────────────────────────────────────

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    useEffect(() => {
        if (!fileId) return;
        let cancelled = false;
        getNotes(fileId).then((raw) => {
            if (cancelled || !raw) return;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setCards(parsed);
            } catch {
                if (raw.trim()) {
                    setCards([{ id: "legacy", text: raw.trim(), rotation: 0, createdAt: new Date().toISOString() }]);
                }
            }
        });
        return () => { cancelled = true; };
    }, [fileId]);

    useEffect(() => {
        setMessages(prev => [
            { ...prev[0], content: buildWelcomeMessage(fileTitle) },
            ...prev.slice(1),
        ]);
    }, [fileTitle]);

    useEffect(() => {
        if (!selectedText) return;
        setInputValue(`Explain this: "${selectedText}"`);
        setActiveTab("chat");
    }, [selectedText]);

    // ── Note persistence ──────────────────────────────────────────────────────

    const persist = useCallback((updated: StickyNoteCard[]) => {
        if (!fileId) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        if (statusTimer.current) clearTimeout(statusTimer.current);
        saveTimer.current = setTimeout(async () => {
            setSaveStatus("saving");
            try {
                await saveNotes(fileId, JSON.stringify(updated));
                setSaveStatus("saved");
                statusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
            } catch {
                setSaveStatus("error");
            }
        }, 600);
    }, [fileId]);

    function addCard() {
        const text = noteInput.trim();
        if (!text) return;
        const card: StickyNoteCard = {
            id: Date.now().toString(),
            text,
            rotation: ROTATIONS[cards.length % ROTATIONS.length],
            createdAt: new Date().toISOString(),
        };
        const updated = [...cards, card];
        setCards(updated);
        setNoteInput("");
        persist(updated);
    }

    function deleteCard(id: string) {
        const updated = cards.filter(c => c.id !== id);
        setCards(updated);
        persist(updated);
    }

    function pinToNotes(content: string) {
        const card: StickyNoteCard = {
            id: Date.now().toString(),
            text: content.length > 220 ? content.slice(0, 217) + "…" : content,
            rotation: ROTATIONS[cards.length % ROTATIONS.length],
            createdAt: new Date().toISOString(),
        };
        const updated = [...cards, card];
        setCards(updated);
        persist(updated);
        setActiveTab("notes");
    }

    // ── Chat handlers ─────────────────────────────────────────────────────────

    function clearChat() {
        setMessages([makeWelcome()]);
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
            const response = await sendMessage(fileId, text, messages);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: "assistant", content: response, timestamp: new Date(),
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

    function onNoteKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCard(); }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        // h-full w-full — sizing is entirely owned by the ResizablePanel wrapper.
        // We just show either the collapsed strip or the full UI based on isOpen.
        <div className="relative h-full w-full overflow-hidden border-l border-white/5 bg-black/40 backdrop-blur-2xl">

            {/* ── Collapsed strip ───────────────────────────────────────────
                Shown when ResizablePanel has been collapsed.
                Full-height button calls onOpen → panel.expand().
            ──────────────────────────────────────────────────────────────── */}
            {!isOpen && (
                <button
                    onClick={onOpen}
                    className="absolute inset-0 w-full flex flex-col items-center justify-center gap-3
                               bg-transparent hover:bg-white/[0.04] transition-colors"
                    title="Open AI Assistant"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl
                                    bg-blue-600
                                    shadow-lg shadow-blue-500/20">
                        <Bot className="h-4 w-4 text-white" />
                    </div>
                    <span
                        className="text-[11px] font-medium text-white/50 select-none uppercase tracking-widest"
                        style={{ writingMode: "vertical-rl" }}
                    >
                        AI Assistant
                    </span>
                    <ChevronLeft className="h-4 w-4 text-white/40" />
                </button>
            )}

            {/* ── Full panel ────────────────────────────────────────────────
                opacity transition so content doesn't crunch during resize.
            ──────────────────────────────────────────────────────────────── */}
            <div
                className="flex h-full w-full flex-col transition-opacity duration-150"
                style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full overflow-hidden">

                    {/* Tab bar + collapse button */}
                    <div className="flex items-center gap-2 px-3 py-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
                        <TabsList className="flex-1 grid grid-cols-2 p-1">
                            <TabsTrigger value="chat"
                                className="gap-1.5 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 rounded-lg transition-all"
                            >
                                <MessageCircle className="h-3.5 w-3.5" />Chat
                            </TabsTrigger>
                            <TabsTrigger value="notes"
                                className="gap-1.5 text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 rounded-lg transition-all"
                            >
                                <StickyNote className="h-3.5 w-3.5" />Notes
                                {cards.length > 0 && (
                                    <span className="ml-1 text-[10px] bg-yellow-400/80 text-yellow-900 rounded-full px-1.5 font-semibold">
                                        {cards.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* Collapse → calls onClose → panel.collapse() */}
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl
                                       text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                            title="Collapse assistant"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {/* ── CHAT ─────────────────────────────────────────────── */}
                    <TabsContent value="chat" className="data-[state=active]:flex hidden flex-1 flex-col m-0 p-0 overflow-hidden min-h-0">

                        {messages.length > 1 && (
                            <div className="flex justify-end px-4 pt-3 shrink-0">
                                <button onClick={clearChat}
                                    className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white transition-colors uppercase tracking-wider"
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
                                                <Bot className="h-4 w-4 text-white" />
                                            </div>
                                        )}

                                        <div className={`flex-1 space-y-1.5 max-w-[85%] ${msg.role === "user" ? "min-w-0" : ""}`}>
                                            {msg.role === "assistant" && (
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-[13px] text-white/90">GeeksHub AI</span>
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-300 border-none">
                                                        <Sparkles className="h-3 w-3 mr-1" />AI
                                                    </Badge>
                                                </div>
                                            )}

                                            <div className={`${msg.role === "user"
                                                ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm ml-auto shadow-lg shadow-blue-500/20"
                                                : "bg-white/[0.04] border border-white/[0.02] text-white/90 rounded-2xl rounded-tl-sm"
                                                } p-4 text-[13px] leading-relaxed backdrop-blur-sm`}
                                            >
                                                <RichContent content={msg.content} />
                                            </div>

                                            {msg.role === "assistant" && msg.id !== "1" && (
                                                <div className="flex items-center gap-3 pl-1 mt-1">
                                                    <CopyButton text={msg.content} />
                                                    <button onClick={() => pinToNotes(msg.content)}
                                                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white transition-colors"
                                                    >
                                                        <BookOpen className="h-3 w-3" />Pin to notes
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {msg.role === "user" && (
                                            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/5">
                                                <User className="h-4 w-4 text-white/80" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {showChips && (
                                    <div className="flex flex-wrap gap-2 pt-2 pb-1">
                                        {SUGGESTED_PROMPTS.map((p) => (
                                            <button key={p} onClick={() => sendMsg(p)}
                                                className="text-[11px] px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:border-white/20 text-white/60 hover:text-white transition-all"
                                            >{p}</button>
                                        ))}
                                    </div>
                                )}

                                {isTyping && (
                                    <div className="flex gap-3">
                                        <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                                            <Bot className="h-4 w-4 text-white" />
                                        </div>
                                        <div className="bg-white/[0.04] border border-white/[0.02] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
                                            <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
                                            <span className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
                                        </div>
                                    </div>
                                )}

                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t border-white/[0.06] bg-black/20 shrink-0">
                            <div className="relative">
                                <Textarea
                                    placeholder="Ask about this file..."
                                    className="min-h-[80px] resize-none pr-14 bg-white/[0.03] border border-white/[0.05]
                                               focus-visible:ring-1 focus-visible:ring-blue-500/50
                                               rounded-2xl text-[13px] text-white placeholder:text-white/30 transition-all"
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
                                        ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        : <Send className="h-4 w-4 text-white" />
                                    }
                                </Button>
                            </div>
                            <div className="flex items-center justify-center gap-2 mt-3 text-white/30">
                                <FileText className="h-3.5 w-3.5" />
                                <p className="text-[11px] truncate uppercase tracking-widest font-medium">
                                    Answering from <span className="font-bold text-white/50">{fileTitle}</span>
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── NOTES BOARD ──────────────────────────────────────── */}
                    <TabsContent value="notes" className="data-[state=active]:flex hidden flex-1 flex-col m-0 p-0 overflow-hidden min-h-0">

                        <ScrollArea className="flex-1 min-h-0">
                            <div
                                className="min-h-full p-6"
                                style={{
                                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
                                    backgroundSize: "24px 24px",
                                }}
                            >
                                {cards.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                                        <div className="w-14 h-14 rounded-sm flex items-center justify-center text-2xl shadow-md bg-gradient-to-br from-yellow-100 to-yellow-300 dark:from-yellow-200/90 dark:to-yellow-500/90"
                                        >📝</div>
                                        <div className="space-y-1">
                                            <p className="text-[13px] font-semibold text-white/70 tracking-wide uppercase">Board is empty</p>
                                            <p className="text-[12px] text-white/40">
                                                Write below and press <strong className="text-white/60">+</strong> to pin a note
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-4"
                                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}
                                    >
                                        {cards.map((card) => (
                                            <StickyCard key={card.id} note={card} onDelete={deleteCard} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Write bar */}
                        <div className="shrink-0 border-t border-white/[0.06] bg-black/20 p-4">
                            {saveStatus !== "idle" && (
                                <div className="flex justify-end mb-2">
                                    {saveStatus === "saving" && (
                                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold flex items-center gap-1">
                                            <Loader2 className="h-3 w-3 animate-spin" />Saving…
                                        </span>
                                    )}
                                    {saveStatus === "saved" && (
                                        <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3" />Saved
                                        </span>
                                    )}
                                    {saveStatus === "error" && (
                                        <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />Failed
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="flex items-end gap-2.5">
                                <Textarea
                                    placeholder="Write a note… Enter or + to pin"
                                    className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-white/[0.03] border border-white/[0.05]
                                               focus-visible:ring-1 focus-visible:ring-yellow-500/50
                                               rounded-2xl text-[13px] text-white placeholder:text-white/30 transition-all"
                                    value={noteInput}
                                    onChange={(e) => setNoteInput(e.target.value)}
                                    onKeyDown={onNoteKey}
                                />
                                <button
                                    onClick={addCard}
                                    disabled={!noteInput.trim()}
                                    className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center
                                               shadow-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed
                                               hover:scale-105 active:scale-95 border ${noteInput.trim() ? "bg-gradient-to-br from-yellow-100 to-yellow-500 border-yellow-600 dark:from-yellow-200/90 dark:to-yellow-500/90" : "border-white/10"}`}
                                    title="Pin note"
                                >
                                    <Plus className={`h-5 w-5 ${noteInput.trim() ? "text-yellow-900" : "text-white/30"}`} />
                                </button>
                            </div>

                            <p className="text-[10px] text-white/30 mt-3 text-center uppercase tracking-widest font-medium">
                                Notes for <span className="font-bold text-white/50">{fileTitle}</span>
                            </p>
                        </div>
                    </TabsContent>

                </Tabs>
            </div>
        </div>
    );
}