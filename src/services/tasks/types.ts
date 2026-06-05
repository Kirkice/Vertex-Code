/**
 * Task Management Types
 * Defines task structure, status, and delegation protocol
 */

export type TaskStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled"

export interface TodoItem {
	id: string
	content: string
	status: "pending" | "in-progress" | "completed"
}

export interface TaskMessage {
	role: "user" | "assistant" | "system"
	content: string
	timestamp: number
}

export interface Task {
	id: string
	parentId?: string
	childIds: string[]
	mode: string
	message: string
	status: TaskStatus
	todos: TodoItem[]
	messages: TaskMessage[]
	createdAt: number
	updatedAt: number
	result?: string
	error?: string
}

export interface CreateTaskOptions {
	mode: string
	message: string
	todos?: string // Markdown checklist
	parentId?: string
}

export interface TaskResult {
	taskId: string
	status: TaskStatus
	result?: string
	error?: string
	messages: TaskMessage[]
}

export interface SubTaskRequest {
	parentTaskId: string
	mode: string
	message: string
	todos?: TodoItem[]
}

export interface SubTaskResponse {
	childTaskId: string
	result?: string
	error?: string
}

/**
 * Parse markdown checklist into TodoItem array
 */
export function parseTodos(markdown: string): TodoItem[] {
	const lines = markdown.split("\n")
	const todos: TodoItem[] = []
	let idCounter = 1

	for (const line of lines) {
		const trimmed = line.trim()

		// Match checkbox patterns: - [ ], - [x], * [ ], * [x]
		const match = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)

		if (match) {
			const status = match[1].toLowerCase() === "x" ? "completed" : "pending"
			const content = match[2].trim()

			todos.push({
				id: `todo-${idCounter++}`,
				content,
				status,
			})
		}
	}

	return todos
}

/**
 * Convert TodoItem array back to markdown checklist
 */
export function todosToMarkdown(todos: TodoItem[]): string {
	return todos
		.map((todo) => {
			const checkbox = todo.status === "completed" ? "[x]" : "[ ]"
			return `- ${checkbox} ${todo.content}`
		})
		.join("\n")
}