import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Sparkles, FileText, MessageCircle, StickyNote } from "lucide-react";

export default function AssistantPanel() {
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
                            {/* AI Message */}
                            <div className="flex gap-3 animate-fade-in">
                                <div className="shrink-0 w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
                                    <Bot className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">GeeksHub AI</span>
                                        <Badge variant="secondary" className="text-xs">
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            GPT-4
                                        </Badge>
                                    </div>
                                    <div className="bg-muted/50 p-4 rounded-2xl rounded-tl-md text-sm leading-relaxed">
                                        <p>Hello! 👋 I can help you study this file. Here's what I can do:</p>
                                        <ul className="mt-2 space-y-1 text-muted-foreground">
                                            <li>• Summarize key concepts</li>
                                            <li>• Explain complex topics</li>
                                            <li>• Quiz you on the material</li>
                                            <li>• Answer specific questions</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* User Message */}
                            <div className="flex gap-3 justify-end animate-fade-in">
                                <div className="max-w-[80%]">
                                    <div className="bg-primary text-primary-foreground p-4 rounded-2xl rounded-tr-md text-sm">
                                        <p>What is the main topic of page 3?</p>
                                    </div>
                                </div>
                            </div>

                            {/* AI Response */}
                            <div className="flex gap-3 animate-fade-in">
                                <div className="shrink-0 w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
                                    <Bot className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="bg-muted/50 p-4 rounded-2xl rounded-tl-md text-sm leading-relaxed">
                                        <p>Page 3 covers <strong>Asymptotic Notation</strong>, specifically:</p>
                                        <ul className="mt-2 space-y-1 text-muted-foreground">
                                            <li>• Big-O notation (O)</li>
                                            <li>• Big-Omega notation (Ω)</li>
                                            <li>• Big-Theta notation (Θ)</li>
                                        </ul>
                                        <p className="mt-3">It explains how these notations help describe algorithm efficiency.</p>
                                        <div className="mt-3 p-2 bg-background rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
                                            <FileText className="h-3 w-3" />
                                            Source: Page 3, Lines 15-42
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
                        <div className="relative">
                            <Textarea
                                placeholder="Ask about this file..."
                                className="min-h-[80px] resize-none pr-14 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                            />
                            <Button
                                size="icon"
                                className="absolute right-2 bottom-2 h-10 w-10 rounded-full gradient-bg hover:opacity-90 transition-opacity"
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
