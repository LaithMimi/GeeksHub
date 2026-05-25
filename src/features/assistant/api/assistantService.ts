import { api } from "@/lib/apiClient";

/** Shared message type for assistant chat */
export interface AssistantMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    agentAction?: 'tool_used' | 'direct_answer';
}

type AIChatResponse = { reply: string; agentAction: 'tool_used' | 'direct_answer' };

/** Cap how much conversation history we replay to the backend each turn. */
const MAX_HISTORY_MESSAGES = 10;

/**
 * Sends a message to the AI assistant and returns a response.
 * @param fileId - The file being viewed
 * @param message - The user's question
 * @param history - Conversation history for context
 * @backend POST /api/v1/assistant/chat
 */
export const sendMessage = async (
    fileId: string,
    message: string,
    history: AssistantMessage[]
): Promise<AIChatResponse> => {
    const response = await api<AIChatResponse>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ fileId, message, history: history.slice(-MAX_HISTORY_MESSAGES) }),
    });
    return { reply: response.reply, agentAction: response.agentAction };
};

/**
 * Fetches saved notes for a file.
 * @param fileId - The file to get notes for
 * @backend GET /api/v1/me/notes?fileId=:fileId
 */
export const getNotes = async (fileId: string): Promise<string> => {
    const params = new URLSearchParams({ fileId });
    const response = await api<{ content: string }>(`/me/notes?${params}`);
    return response.content ?? "";
};

/**
 * Saves notes for a file.
 * @param fileId - The file to save notes for
 * @param content - The note content
 * @backend POST /api/v1/me/notes
 */
export const saveNotes = async (fileId: string, content: string): Promise<void> => {
    const params = new URLSearchParams({ fileId });
    await api(`/me/notes?${params}`, {
        method: "POST",
        body: JSON.stringify({ content }),
    });
};
