import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, AlertCircle, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { getNotes, saveNotes } from "@/features/assistant/api/assistantService";
import type { AssistantMessage } from "@/features/assistant/api/assistantService";
import { useDebounce } from "@/shared/hooks/useDebounce";

const ROTATIONS = [-2, -1, 0, 1, 2, -1.5, 1.5, -0.5, 0.5, 2];

// Notes are persisted as the JSON-serialized card array; the backend caps that
// payload (NotePayload.content) at 50,000 chars, so guard before adding.
const MAX_NOTES_CONTENT = 50_000;

export interface StickyNoteCard {
    id: string;
    text: string;
    rotation: number;
    createdAt: string;
}

export const makeWelcome = (fileTitle: string): AssistantMessage => ({
    id: "1",
    role: "assistant",
    content: `I've loaded **${fileTitle}**. Ask me anything about it — I can summarize key concepts, explain difficult topics, or quiz you on the material.`,
    timestamp: new Date(),
});

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
            <p className="mt-3 text-[12px] leading-relaxed break-words font-medium text-yellow-900 font-sans max-h-[200px] overflow-y-auto pr-1">
                {note.text}
            </p>
        </div>
    );
}

export interface NotesBoardRef {
    pinNote: (content: string) => void;
}

interface NotesBoardProps {
    fileId: string;
    fileTitle: string;
    onCountChange: (count: number) => void;
}

export const NotesBoard = forwardRef<NotesBoardRef, NotesBoardProps>(
    ({ fileId, fileTitle, onCountChange }, ref) => {
        const [cards, setCards] = useState<StickyNoteCard[]>([]);
        const [noteInput, setNoteInput] = useState("");
        const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
        
        const debouncedCards = useDebounce(cards, 600);
        const lastSavedJSON = useRef<string | null>(null);

        useImperativeHandle(ref, () => ({
            pinNote: (content: string) => {
                setCards((prev) => {
                    const card: StickyNoteCard = {
                        id: Date.now().toString(),
                        text: content,
                        rotation: ROTATIONS[prev.length % ROTATIONS.length],
                        createdAt: new Date().toISOString(),
                    };
                    const next = [...prev, card];
                    if (JSON.stringify(next).length > MAX_NOTES_CONTENT) {
                        toast.error("Notes board is full. Remove some notes before pinning more.");
                        return prev;
                    }
                    return next;
                });
            }
        }));

        useEffect(() => {
            onCountChange(cards.length);
        }, [cards.length, onCountChange]);

        useEffect(() => {
            if (!fileId) return;
            let cancelled = false;
            getNotes(fileId).then((raw) => {
                if (cancelled || !raw) return;
                let parsedCards: StickyNoteCard[] = [];
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) parsedCards = parsed;
                } catch {
                    if (raw.trim()) {
                        parsedCards = [{ id: "legacy", text: raw.trim(), rotation: 0, createdAt: new Date().toISOString() }];
                    }
                }
                setCards(parsedCards);
                lastSavedJSON.current = JSON.stringify(parsedCards);
            });
            return () => { cancelled = true; };
        }, [fileId]);

        useEffect(() => {
            if (!fileId) return;
            const currentJSON = JSON.stringify(debouncedCards);
            if (currentJSON === lastSavedJSON.current) return;
            
            setSaveStatus("saving");
            saveNotes(fileId, currentJSON)
                .then(() => {
                    setSaveStatus("saved");
                    lastSavedJSON.current = currentJSON;
                })
                .catch(() => {
                    setSaveStatus("error");
                });
        }, [debouncedCards, fileId]);

        useEffect(() => {
            if (saveStatus === "saved") {
                const timer = setTimeout(() => setSaveStatus("idle"), 2000);
                return () => clearTimeout(timer);
            }
        }, [saveStatus]);

        function addCard() {
            const text = noteInput.trim();
            if (!text) return;
            const card: StickyNoteCard = {
                id: Date.now().toString(),
                text,
                rotation: ROTATIONS[cards.length % ROTATIONS.length],
                createdAt: new Date().toISOString(),
            };
            if (JSON.stringify([...cards, card]).length > MAX_NOTES_CONTENT) {
                toast.error("Notes board is full. Remove some notes before adding more.");
                return;
            }
            setCards(prev => [...prev, card]);
            setNoteInput("");
        }

        function deleteCard(id: string) {
            setCards(prev => prev.filter(c => c.id !== id));
        }

        function onNoteKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCard(); }
        }

        return (
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
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
                                    <p className="text-[13px] font-semibold text-foreground/70 tracking-wide uppercase">Board is empty</p>
                                    <p className="text-[12px] text-muted-foreground">
                                        Write below and press <strong className="text-foreground/60">+</strong> to pin a note
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

                <div className="shrink-0 border-t border-border bg-foreground/5 p-4">
                    {saveStatus !== "idle" && (
                        <div className="flex justify-end mb-2">
                            {saveStatus === "saving" && (
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
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
                            maxLength={500}
                            className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-foreground/5 border border-border
                                       focus-visible:ring-1 focus-visible:ring-yellow-500/50
                                       rounded-2xl text-[13px] text-foreground placeholder:text-muted-foreground/50 transition-all"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            onKeyDown={onNoteKey}
                        />
                        <button
                            onClick={addCard}
                            disabled={!noteInput.trim()}
                            className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center
                                       shadow-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed
                                       hover:scale-105 active:scale-95 border ${noteInput.trim() ? "bg-gradient-to-br from-yellow-100 to-yellow-500 border-yellow-600 dark:from-yellow-200/90 dark:to-yellow-500/90" : "border-border/50"}`}
                            title="Pin note"
                        >
                            <Plus className={`h-5 w-5 ${noteInput.trim() ? "text-yellow-900" : "text-muted-foreground/50"}`} />
                        </button>
                    </div>

                    <p className="text-[10px] text-muted-foreground/50 mt-3 text-center uppercase tracking-widest font-medium">
                        Notes for <span className="font-bold text-muted-foreground">{fileTitle}</span>
                    </p>
                </div>
            </div>
        );
    }
);

NotesBoard.displayName = "NotesBoard";
