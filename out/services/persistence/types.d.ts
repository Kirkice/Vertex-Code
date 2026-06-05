/**
 * Persistence Service Types
 * Task history, conversation storage, and state persistence
 */
export interface ConversationMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
}
export interface Conversation {
    id: string;
    title: string;
    mode: string;
    messages: ConversationMessage[];
    createdAt: number;
    updatedAt: number;
    tags?: string[];
    isArchived?: boolean;
}
export interface ConversationSummary {
    id: string;
    title: string;
    mode: string;
    messageCount: number;
    createdAt: number;
    updatedAt: number;
    tags?: string[];
}
export interface TaskRecord {
    taskId: string;
    conversationId: string;
    parentTaskId?: string;
    mode: string;
    status: "completed" | "failed" | "cancelled";
    result?: string;
    error?: string;
    createdAt: number;
    completedAt: number;
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface PersistedState {
    conversations: Conversation[];
    taskHistory: TaskRecord[];
    lastActiveConversationId?: string;
    settings: Record<string, any>;
}
//# sourceMappingURL=types.d.ts.map