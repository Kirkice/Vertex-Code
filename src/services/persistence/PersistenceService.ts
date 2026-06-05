/**
 * PersistenceService - Handles storage of conversations, task history, and state
 * Uses a JSON file in the extension's global storage directory
 */

import * as fs from "fs/promises"
import * as path from "path"
import { v4 as uuidv4 } from "uuid"
import type { Conversation, ConversationMessage, ConversationSummary, TaskRecord, PersistedState } from "./types"

const STATE_FILE = "vertex-state.json"

export class PersistenceService {
	private storagePath: string
	private state: PersistedState
	private saveTimeout: NodeJS.Timeout | null = null

	constructor(storageDir: string) {
		this.storagePath = path.join(storageDir, STATE_FILE)
		this.state = {
			conversations: [],
			taskHistory: [],
			settings: {},
		}
	}

	/**
	 * Initialize the service and load state from disk
	 */
	async initialize(): Promise<void> {
		await this.loadState()
	}

	/**
	 * Load state from disk
	 */
	private async loadState(): Promise<void> {
		try {
			const content = await fs.readFile(this.storagePath, "utf-8")
			this.state = JSON.parse(content)
			
			// Ensure arrays exist
			if (!Array.isArray(this.state.conversations)) this.state.conversations = []
			if (!Array.isArray(this.state.taskHistory)) this.state.taskHistory = []
			if (!this.state.settings) this.state.settings = {}
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				console.error("[PersistenceService] Failed to load state:", error)
			}
			// Use default empty state
		}
	}

	/**
	 * Save state to disk (debounced)
	 */
	private scheduleSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout)
		}

		this.saveTimeout = setTimeout(async () => {
			try {
				const dir = path.dirname(this.storagePath)
				await fs.mkdir(dir, { recursive: true })
				await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2), "utf-8")
			} catch (error) {
				console.error("[PersistenceService] Failed to save state:", error)
			}
		}, 500) // Debounce for 500ms
	}

	/**
	 * Force immediate save
	 */
	async saveNow(): Promise<void> {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout)
			this.saveTimeout = null
		}

		try {
			const dir = path.dirname(this.storagePath)
			await fs.mkdir(dir, { recursive: true })
			await fs.writeFile(this.storagePath, JSON.stringify(this.state, null, 2), "utf-8")
		} catch (error) {
			console.error("[PersistenceService] Failed to save state:", error)
		}
	}

	// ─── Conversations ─────────────────────────────────────

	/**
	 * Create a new conversation
	 */
	createConversation(title: string, mode: string): Conversation {
		const now = Date.now()
		const conversation: Conversation = {
			id: uuidv4(),
			title,
			mode,
			messages: [],
			createdAt: now,
			updatedAt: now,
			tags: [],
		}

		this.state.conversations.push(conversation)
		this.state.lastActiveConversationId = conversation.id
		this.scheduleSave()

		return conversation
	}

	/**
	 * Get a conversation by ID
	 */
	getConversation(id: string): Conversation | undefined {
		return this.state.conversations.find((c) => c.id === id)
	}

	/**
	 * Get all conversation summaries
	 */
	getConversationSummaries(): ConversationSummary[] {
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
			.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	/**
	 * Add a message to a conversation
	 */
	addMessage(conversationId: string, message: ConversationMessage): void {
		const conversation = this.getConversation(conversationId)
		if (!conversation) {
			throw new Error(`Conversation ${conversationId} not found`)
		}

		conversation.messages.push(message)
		conversation.updatedAt = Date.now()

		// Auto-update title if it's the first user message and title is "New Conversation"
		if (
			conversation.title === "New Conversation" &&
			message.role === "user" &&
			conversation.messages.filter((m) => m.role === "user").length === 1
		) {
			conversation.title = message.content.slice(0, 50).trim() + (message.content.length > 50 ? "..." : "")
		}

		this.state.lastActiveConversationId = conversationId
		this.scheduleSave()
	}

	/**
	 * Update conversation title
	 */
	updateConversationTitle(conversationId: string, title: string): void {
		const conversation = this.getConversation(conversationId)
		if (!conversation) {
			throw new Error(`Conversation ${conversationId} not found`)
		}

		conversation.title = title
		conversation.updatedAt = Date.now()
		this.scheduleSave()
	}

	/**
	 * Delete a conversation
	 */
	deleteConversation(conversationId: string): void {
		this.state.conversations = this.state.conversations.filter((c) => c.id !== conversationId)

		if (this.state.lastActiveConversationId === conversationId) {
			this.state.lastActiveConversationId = undefined
		}

		this.scheduleSave()
	}

	/**
	 * Clear all messages from a conversation
	 */
	clearConversationMessages(conversationId: string): void {
		const conversation = this.getConversation(conversationId)
		if (!conversation) {
			throw new Error(`Conversation ${conversationId} not found`)
		}

		conversation.messages = []
		conversation.updatedAt = Date.now()
		this.scheduleSave()
	}

	/**
	 * Get the last active conversation
	 */
	getLastActiveConversation(): Conversation | undefined {
		if (!this.state.lastActiveConversationId) return undefined
		return this.getConversation(this.state.lastActiveConversationId)
	}

	// ─── Task History ──────────────────────────────────────

	/**
	 * Record a completed task
	 */
	addTaskRecord(record: Omit<TaskRecord, "completedAt">): void {
		const fullRecord: TaskRecord = {
			...record,
			completedAt: Date.now(),
		}

		this.state.taskHistory.push(fullRecord)
		this.scheduleSave()
	}

	/**
	 * Get task history
	 */
	getTaskHistory(limit: number = 50): TaskRecord[] {
		return this.state.taskHistory
			.sort((a, b) => b.completedAt - a.completedAt)
			.slice(0, limit)
	}

	/**
	 * Get a specific task by ID
	 */
	getTask(taskId: string): TaskRecord | undefined {
		return this.state.taskHistory.find((t) => t.taskId === taskId)
	}

	/**
	 * Delete a specific task by ID
	 */
	deleteTask(taskId: string): void {
		this.state.taskHistory = this.state.taskHistory.filter((t) => t.taskId !== taskId)
		this.scheduleSave()
	}

	/**
	 * Clear task history
	 */
	clearTaskHistory(): void {
		this.state.taskHistory = []
		this.scheduleSave()
	}

	// ─── Settings ──────────────────────────────────────────

	/**
	 * Get a setting value
	 */
	getSetting<T>(key: string, defaultValue: T): T {
		return (this.state.settings[key] as T) ?? defaultValue
	}

	/**
	 * Set a setting value
	 */
	setSetting(key: string, value: any): void {
		this.state.settings[key] = value
		this.scheduleSave()
	}

	/**
	 * Get all settings
	 */
	getAllSettings(): Record<string, any> {
		return { ...this.state.settings }
	}

	// ─── Utility ───────────────────────────────────────────

	/**
	 * Clear all data (for testing or reset)
	 */
	async clearAll(): Promise<void> {
		this.state = {
			conversations: [],
			taskHistory: [],
			settings: {},
		}
		await this.saveNow()
	}

	/**
	 * Export state as JSON string
	 */
	exportState(): string {
		return JSON.stringify(this.state, null, 2)
	}

	/**
	 * Import state from JSON string
	 */
	importState(json: string): void {
		try {
			const imported = JSON.parse(json)
			this.state = {
				conversations: imported.conversations || [],
				taskHistory: imported.taskHistory || [],
				lastActiveConversationId: imported.lastActiveConversationId,
				settings: imported.settings || {},
			}
			this.scheduleSave()
		} catch (error) {
			throw new Error(`Failed to import state: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}