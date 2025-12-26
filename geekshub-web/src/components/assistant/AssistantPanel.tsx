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

        // Simulate AI response
        setTimeout(() => {
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I understand you're asking about "${userMessage.content}". As an AI study assistant, I can help explain this concept based on the document content.`,
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
