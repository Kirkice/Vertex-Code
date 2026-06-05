"use strict";
/**
 * PersistenceService - Handles storage of conversations, task history, and state
 * Uses a JSON file in the extension's global storage directory
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const STATE_FILE = "vertex-state.json";
class PersistenceService {
    constructor(storageDir) {
        this.saveTimeout = null;
        this.storagePath = path.join(storageDir, STATE_FILE);
        this.state = {
            conversations: [],
            taskHistory: [],
            settings: {},
        };
    }
    /**
     * Initialize the service and load state from disk
     */
    async initialize() {
        await this.loadState();
    }
    /**
     * Load state from disk
     */
    async loadState() {
        try {
            const content = await fs.readFile(this.storagePath, "utf-8");
            this.state = JSON.parse(content);
            // Ensure arrays exist
            if (!Array.isArray(this.state.conversations))
                this.state.conversations = [];
            if (!Array.isArray(this.state.taskHistory))
                this.state.taskHistory = [];
            if (!this.state.settings)
                this.state.settings = {};
        }
        catch (error) {
            if (error.code !== "ENOENT") {
                console.error("[PersistenceService] Failed to load state:", error);
            }
            // Use default empty state
        }
    }
    /**
     * Save state to disk (debounced)
     */
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(async () => {
            try {
                const dir = path.dirname(this.storagePath);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2), "utf-8");
            }
            catch (error) {
                console.error("[PersistenceService] Failed to save state:", error);
            }
        }, 500); // Debounce for 500ms
    }
    /**
     * Force immediate save
     */
    async saveNow() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        try {
            const dir = path.dirname(this.storagePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2), "utf-8");
        }
        catch (error) {
            console.error("[PersistenceService] Failed to save state:", error);
        }
    }
    // ─── Conversations ─────────────────────────────────────
    /**
     * Create a new conversation
     */
    createConversation(title, mode) {
        const now = Date.now();
        const conversation = {
            id: (0, uuid_1.v4)(),
            title,
            mode,
            messages: [],
            createdAt: now,
            updatedAt: now,
            tags: [],
        };
        this.state.conversations.push(conversation);
        this.state.lastActiveConversationId = conversation.id;
        this.scheduleSave();
        return conversation;
    }
    /**
     * Get a conversation by ID
     */
    getConversation(id) {
        return this.state.conversations.find((c) => c.id === id);
    }
    /**
     * Get all conversation summaries
     */
    getConversationSummaries() {
        return this.state.conversations
            .map((c) => ({
            id: c.id,
            title: c.title,
            mode: c.mode,
            messageCount: c.messages.length,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            tags: c.tags,
        }))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    /**
     * Add a message to a conversation
     */
    addMessage(conversationId, message) {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        conversation.messages.push(message);
        conversation.updatedAt = Date.now();
        // Auto-update title if it's the first user message and title is "New Conversation"
        if (conversation.title === "New Conversation" &&
            message.role === "user" &&
            conversation.messages.filter((m) => m.role === "user").length === 1) {
            conversation.title = message.content.slice(0, 50).trim() + (message.content.length > 50 ? "..." : "");
        }
        this.state.lastActiveConversationId = conversationId;
        this.scheduleSave();
    }
    /**
     * Update conversation title
     */
    updateConversationTitle(conversationId, title) {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        conversation.title = title;
        conversation.updatedAt = Date.now();
        this.scheduleSave();
    }
    /**
     * Delete a conversation
     */
    deleteConversation(conversationId) {
        this.state.conversations = this.state.conversations.filter((c) => c.id !== conversationId);
        if (this.state.lastActiveConversationId === conversationId) {
            this.state.lastActiveConversationId = undefined;
        }
        this.scheduleSave();
    }
    /**
     * Clear all messages from a conversation
     */
    clearConversationMessages(conversationId) {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        conversation.messages = [];
        conversation.updatedAt = Date.now();
        this.scheduleSave();
    }
    /**
     * Get the last active conversation
     */
    getLastActiveConversation() {
        if (!this.state.lastActiveConversationId)
            return undefined;
        return this.getConversation(this.state.lastActiveConversationId);
    }
    // ─── Task History ──────────────────────────────────────
    /**
     * Record a completed task
     */
    addTaskRecord(record) {
        const fullRecord = {
            ...record,
            completedAt: Date.now(),
        };
        this.state.taskHistory.push(fullRecord);
        this.scheduleSave();
    }
    /**
     * Get task history
     */
    getTaskHistory(limit = 50) {
        return this.state.taskHistory
            .sort((a, b) => b.completedAt - a.completedAt)
            .slice(0, limit);
    }
    /**
     * Get a specific task by ID
     */
    getTask(taskId) {
        return this.state.taskHistory.find((t) => t.taskId === taskId);
    }
    /**
     * Delete a specific task by ID
     */
    deleteTask(taskId) {
        this.state.taskHistory = this.state.taskHistory.filter((t) => t.taskId !== taskId);
        this.scheduleSave();
    }
    /**
     * Clear task history
     */
    clearTaskHistory() {
        this.state.taskHistory = [];
        this.scheduleSave();
    }
    // ─── Settings ──────────────────────────────────────────
    /**
     * Get a setting value
     */
    getSetting(key, defaultValue) {
        return this.state.settings[key] ?? defaultValue;
    }
    /**
     * Set a setting value
     */
    setSetting(key, value) {
        this.state.settings[key] = value;
        this.scheduleSave();
    }
    /**
     * Get all settings
     */
    getAllSettings() {
        return { ...this.state.settings };
    }
    // ─── Utility ───────────────────────────────────────────
    /**
     * Clear all data (for testing or reset)
     */
    async clearAll() {
        this.state = {
            conversations: [],
            taskHistory: [],
            settings: {},
        };
        await this.saveNow();
    }
    /**
     * Export state as JSON string
     */
    exportState() {
        return JSON.stringify(this.state, null, 2);
    }
    /**
     * Import state from JSON string
     */
    importState(json) {
        try {
            const imported = JSON.parse(json);
            this.state = {
                conversations: imported.conversations || [],
                taskHistory: imported.taskHistory || [],
                lastActiveConversationId: imported.lastActiveConversationId,
                settings: imported.settings || {},
            };
            this.scheduleSave();
        }
        catch (error) {
            throw new Error(`Failed to import state: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.PersistenceService = PersistenceService;
//# sourceMappingURL=PersistenceService.js.map