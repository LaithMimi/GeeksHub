/**
 * ============================================================================
 * AI ASSISTANT PANEL – Mock Implementation
 * ============================================================================
 *
 * Provides a chat interface for asking questions about the current file,
 * and a (coming soon) notes tab. Currently uses a simulated AI response.
 *
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 *
 * 1. Required Backend Endpoints:
 *
 *    POST   /api/assistant/chat
 *      → Sends a message to the AI and receives a response.
 *      → Request body:
 *        {
 *          fileId: string,           // The file the user is viewing
 *          message: string,          // The user's question
 *          conversationHistory: Message[]  // Previous messages for context
 *        }
 *      → Response: { content: string, sources?: { page: number, title: string }[] }
 *      → For streaming, use Server-Sent Events (SSE):
 *        ```ts
 *        const response = await fetch("/api/assistant/chat", {
 *            method: "POST",
 *            headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
 *            body: JSON.stringify({ fileId, message, conversationHistory }),
 *        });
 *        const reader = response.body!.getReader();
 *        // Read chunks and append to assistant message in real-time
 *        ```
 *
 *    GET    /api/me/notes?fileId=:fileId
 *      → Fetches the user's notes for the current file.
 *      → Response: { id: string, content: string, updatedAt: string }[]
 *
 *    POST   /api/me/notes
 *      → Creates/updates a note for the current file.
 *      → Request body: { fileId: string, content: string }
 *      → Response: { id: string, content: string, updatedAt: string }
 *
 * 2. SQL Schema:
 *    ```sql
 *    -- Chat history (optional – can be session-only)
 *    CREATE TABLE chat_sessions (
 *        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *        user_id    UUID NOT NULL REFERENCES users(id),
 *        file_id    UUID NOT NULL REFERENCES files(id),
 *        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *    );
 *    CREATE TABLE chat_messages (
 *        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *        session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
 *        role        VARCHAR(10) NOT NULL,  -- 'user' | 'assistant'
 *        content     TEXT NOT NULL,
 *        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *    );
 *
 *    -- Notes
 *    CREATE TABLE user_notes (
 *        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *        file_id    UUID NOT NULL REFERENCES files(id),
 *        content    TEXT NOT NULL,
 *        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *    );
 *    CREATE UNIQUE INDEX idx_notes_user_file ON user_notes(user_id, file_id);
 *    ```
 *
 * 3. AI Provider Integration:
 *    The backend should call an LLM API (OpenAI, Gemini, etc.):
 *    ```python
 *    # Example FastAPI endpoint
 *    @app.post("/api/assistant/chat")
 *    async def chat(request: ChatRequest, user = Depends(get_current_user)):
 *        # 1. Fetch the file content / embeddings for RAG context
 *        file_context = await get_file_context(request.file_id)
 *        # 2. Build prompt with file context + conversation history
 *        # 3. Call LLM API (stream response for better UX)
 *        # 4. Return response with source citations
 *    ```
 * ============================================================================
 */

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Sparkles, FileText, MessageCircle, StickyNote, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function AssistantPanel() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hello! 👋 I can help you study this file. Here's what I can do:\n\n• Summarize key concepts\n• Explain complex topics\n• Quiz you on the material\n• Answer specific questions",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    /**
     * Sends a message and receives an AI response.
     * @backend REPLACE the setTimeout mock with a real API call:
     *
     *   const response = await fetch("/api/assistant/chat", {
     *       method: "POST",
     *       headers: { "Content-Type": "application/json" },
     *       body: JSON.stringify({
     *           fileId: currentFileId,       // from route params or context
     *           message: inputValue,
     *           conversationHistory: messages,
     *       }),
     *   });
     *   const data = await response.json();
     *   // data.content = AI response text
     *   // data.sources = [{ page: 12, title: "Algorithm Complexity" }, ...]
     *
     *   For streaming (recommended for better UX):
     *   Use EventSource or ReadableStream to append tokens as they arrive.
     */
    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue("");

        // @backend REPLACE: This setTimeout simulates the AI response.
        // See the @backend comment above for the real implementation.
        setTimeout(() => {
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I understand you're asking about "${userMessage.content}". As an AI study assistant, I can help explain this concept based on the document content.\n\nHere is the explanation...\n\n**Sources:**\n• Page 12: "Algorithm Complexity"\n• Page 45: "Big O Notation Examples"`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);
        }, 1000);
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
                                                    GPT-4
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
                            />
                            <Button
                                size="icon"
                                className="absolute right-2 bottom-2 h-10 w-10 rounded-full gradient-bg hover:opacity-90 transition-opacity"
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim()}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-3">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                                Answering from <span className="font-medium text-foreground">Introduction to Algorithms.pdf</span>
                            </p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="notes" className="flex-1 p-6 m-0">
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <StickyNote className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-2">Smart Notes</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">
                            Take notes while studying. AI will help organize and summarize them.
                        </p>
                        <Button variant="outline" className="mt-4">
                            <Sparkles className="mr-2 h-4 w-4" />
                            Coming Soon
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
