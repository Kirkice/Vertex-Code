/**
 * PersistenceService - Handles storage of conversations, task history, and state
 * Uses a JSON file in the extension's global storage directory
 */
import type { Conversation, ConversationMessage, ConversationSummary, TaskRecord } from "./types";
export declare class PersistenceService {
    private storagePath;
    private state;
    private saveTimeout;
    constructor(storageDir: string);
    /**
     * Initialize the service and load state from disk
     */
    initialize(): Promise<void>;
    /**
     * Load state from disk
     */
    private loadState;
    /**
     * Save state to disk (debounced)
     */
    private scheduleSave;
    /**
     * Force immediate save
     */
    saveNow(): Promise<void>;
    /**
     * Create a new conversation
     */
    createConversation(title: string, mode: string): Conversation;
    /**
     * Get a conversation by ID
     */
    getConversation(id: string): Conversation | undefined;
    /**
     * Get all conversation summaries
     */
    getConversationSummaries(): ConversationSummary[];
    /**
     * Add a message to a conversation
     */
    addMessage(conversationId: string, message: ConversationMessage): void;
    /**
     * Update conversation title
     */
    updateConversationTitle(conversationId: string, title: string): void;
    /**
     * Delete a conversation
     */
    deleteConversation(conversationId: string): void;
    /**
     * Clear all messages from a conversation
     */
    clearConversationMessages(conversationId: string): void;
    /**
     * Get the last active conversation
     */
    getLastActiveConversation(): Conversation | undefined;
    /**
     * Record a completed task
     */
    addTaskRecord(record: Omit<TaskRecord, "completedAt">): void;
    /**
     * Get task history
     */
    getTaskHistory(limit?: number): TaskRecord[];
    /**
     * Get a specific task by ID
     */
    getTask(taskId: string): TaskRecord | undefined;
    /**
     * Delete a specific task by ID
     */
    deleteTask(taskId: string): void;
    /**
     * Clear task history
     */
    clearTaskHistory(): void;
    /**
     * Get a setting value
     */
    getSetting<T>(key: string, defaultValue: T): T;
    /**
     * Set a setting value
     */
    setSetting(key: string, value: any): void;
    /**
     * Get all settings
     */
    getAllSettings(): Record<string, any>;
    /**
     * Clear all data (for testing or reset)
     */
    clearAll(): Promise<void>;
    /**
     * Export state as JSON string
     */
    exportState(): string;
    /**
     * Import state from JSON string
     */
    importState(json: string): void;
}
//# sourceMappingURL=PersistenceService.d.ts.map