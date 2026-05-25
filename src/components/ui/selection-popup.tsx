import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Bot } from "lucide-react";

interface SelectionPopupProps {
    containerRef: React.RefObject<HTMLElement | null>;
    onPinToNotes: (text: string) => void;
    onAskAI: (text: string) => void;
}

export function SelectionPopup({ containerRef, onPinToNotes, onAskAI }: SelectionPopupProps) {
    const [menu, setMenu] = useState<{ text: string; top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onMouseUp() {
            setTimeout(() => {
                const sel = window.getSelection();
                const text = sel?.toString().trim();
                if (!text || !sel || sel.isCollapsed) return;
                const anchor = sel.anchorNode;
                if (!anchor || !containerRef.current?.contains(anchor as Node)) return;
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setMenu({ text, top: rect.top, left: rect.left + rect.width / 2 });
            }, 10);
        }
        function onMouseDown(e: MouseEvent) {
            if (menuRef.current?.contains(e.target as Node)) return;
            setMenu(null);
        }
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("mousedown", onMouseDown);
        return () => {
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("mousedown", onMouseDown);
        };
    }, []);

    if (!menu) return null;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] flex items-center gap-1 p-1 rounded-lg bg-foreground/90 text-background shadow-xl backdrop-blur-md animate-fade-in"
            style={{ top: menu.top - 8, left: menu.left, transform: "translate(-50%, -100%)" }}
        >
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    onPinToNotes(menu.text);
                    setMenu(null);
                    window.getSelection()?.removeAllRanges();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-background/20 text-[11px] font-medium transition-colors"
            >
                <BookOpen className="h-3 w-3" /> Add to notes
            </button>
            <div className="w-[1px] h-4 bg-background/20" />
            <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    onAskAI(menu.text);
                    setMenu(null);
                    window.getSelection()?.removeAllRanges();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-background/20 text-[11px] font-medium transition-colors"
            >
                <Bot className="h-3 w-3" /> Ask AI
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground/90" />
        </div>,
        document.body
    );
}
