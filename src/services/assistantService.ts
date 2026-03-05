/**
 * ============================================================================
 * ASSISTANT SERVICE - Mock Implementation
 * ============================================================================
 *
 * Handles AI chat and user notes for the file viewer assistant panel.
 * Currently uses mock AI responses and localStorage for notes.
 *
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 *
 * Replace implementations with:
 *   sendMessage()  → POST /api/assistant/chat
 *   getNotes()     → GET  /api/me/notes?fileId=:fileId
 *   saveNotes()    → POST /api/me/notes
 * ============================================================================
 */

import { randomDelay } from "@/mock/mock-db";

/** Shared message type for assistant chat */
export interface AssistantMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

/**
 * Sends a message to the AI assistant and returns a response.
 * @param fileId - The file being viewed
 * @param message - The user's question
 * @param _history - Conversation history for context (unused in mock)
 * @backend POST /api/assistant/chat
 */
export const sendMessage = async (
    _fileId: string,
    message: string,
    _history: AssistantMessage[]
): Promise<string> => {
    await randomDelay(800, 2000);

    // Mock AI responses based on keywords
    const lower = message.toLowerCase();

    if (lower.includes("summarize") || lower.includes("summary")) {
        return "Here's a summary of the key concepts:\n\n1. **Core Concepts** — The document covers fundamental principles with practical examples.\n2. **Applications** — Several real-world use cases are discussed.\n3. **Key Takeaways** — Focus on understanding the underlying theory before moving to implementation.\n\nWould you like me to elaborate on any of these points?";
    }

    if (lower.includes("quiz") || lower.includes("test")) {
        return "Here are some practice questions based on the material:\n\n**Q1:** What is the main difference between the two approaches discussed in Section 2?\n\n**Q2:** Explain the significance of the theorem presented on page 15.\n\n**Q3:** Give an example of how the concept in Chapter 3 applies to a real-world scenario.\n\nWant me to provide answers or more questions?";
    }

    return `That's a great question about "${message}". Based on the document content, here's what I found:\n\nThe material covers this topic in detail. The key insight is that understanding the foundational concepts is essential before applying them.\n\nWould you like me to go deeper into any specific aspect?`;
};

/**
 * Fetches saved notes for a file.
 * @param fileId - The file to get notes for
 * @backend GET /api/me/notes?fileId=:fileId
 */
export const getNotes = async (fileId: string): Promise<string> => {
    await randomDelay(100, 300);
    return localStorage.getItem(`geekshub-notes-${fileId}`) ?? "";
};

/**
 * Saves notes for a file.
 * @param fileId - The file to save notes for
 * @param content - The note content
 * @backend POST /api/me/notes
 */
export const saveNotes = async (fileId: string, content: string): Promise<void> => {
    await randomDelay(200, 400);
    localStorage.setItem(`geekshub-notes-${fileId}`, content);
};
