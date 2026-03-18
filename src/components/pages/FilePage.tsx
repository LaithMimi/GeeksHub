import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useFile } from "@/queries/useFiles";
import FileViewer from "@/components/viewer/FileViewer";
import AssistantPanel from "@/components/assistant/AssistantPanel";

export default function FilePage() {
    const { fileId } = useParams();
    const { data: file } = useFile(fileId ?? "");

    // ── Bridge: PDF text selection → AI assistant ────────────────────────────
    // FileViewer sets this when the user clicks "Ask AI" on selected text.
    // AssistantPanel consumes it to pre-fill the input.
    // We reset to "" after one render cycle so AssistantPanel's useEffect
    // fires again on the next selection even if the text is identical.
    const [selectedText, setSelectedText] = useState("");

    const handleTextSelect = useCallback((text: string) => {
        setSelectedText(text);
        // Reset on next tick so repeated selections of the same phrase still trigger
        setTimeout(() => setSelectedText(""), 0);
    }, []);

    const [isAssistantOpen, setIsAssistantOpen] = useState(true);

    return (
        <div className="flex h-full w-full overflow-hidden">

            {/* File viewer — takes remaining width after assistant panel */}
            <div className="flex-1 min-w-0 overflow-hidden">
                <FileViewer onTextSelect={handleTextSelect} />
            </div>

            {/* AI assistant — manages its own open/collapsed width internally */}
            <div className={`transition-all duration-300 ease-in-out border-l border-white/5 bg-black/40 backdrop-blur-2xl ${isAssistantOpen ? 'w-[360px]' : 'w-12'}`}>
                <AssistantPanel
                    fileId={fileId}
                    fileTitle={file?.title ?? "this file"}
                    selectedText={selectedText}
                    isOpen={isAssistantOpen}
                    onOpen={() => setIsAssistantOpen(true)}
                    onClose={() => setIsAssistantOpen(false)}
                />
            </div>
        </div>
    );
}
