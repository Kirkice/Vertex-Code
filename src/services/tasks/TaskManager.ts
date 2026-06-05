/**
 * TaskManager - Core task lifecycle management
 * Handles task creation, delegation, pausing, resuming, and completion
 */

import { v4 as uuidv4 } from "uuid"
import EventEmitter from "events"
import type {
	Task,
	TaskStatus,
	TaskMessage,
	TodoItem,
	CreateTaskOptions,
	TaskResult,
	SubTaskRequest,
	SubTaskResponse,
} from "./types"
import { parseTodos } from "./types"

export interface TaskManagerEvents {
	"task-created": (task: Task) => void
	"task-started": (taskId: string) => void
	"task-paused": (taskId: string) => void
	"task-resumed": (taskId: string) => void
	"task-completed": (taskId: string, result: string) => void
	"task-failed": (taskId: string, error: string) => void
	"task-cancelled": (taskId: string) => void
	"message-added": (taskId: string, message: TaskMessage) => void
	"todo-updated": (taskId: string, todos: TodoItem[]) => void
	"active-task-changed": (taskId: string | null) => void
}

export class TaskManager extends EventEmitter {
	private tasks: Map<string, Task> = new Map()
	private activeTaskId: string | null = null
	private taskStack: string[] = [] // Stack for parent-child relationships

	/**
	 * Get all tasks
	 */
	getAllTasks(): Task[] {
		return Array.from(this.tasks.values())
	}

	/**
	 * Get a specific task by ID
	 */
	getTask(taskId: string): Task | undefined {
		return this.tasks.get(taskId)
	}

	/**
	 * Get the currently active task
	 */
	getActiveTask(): Task | null {
		if (!this.activeTaskId) return null
		return this.tasks.get(this.activeTaskId) || null
	}

	/**
	 * Get root tasks (tasks without parents)
	 */
	getRootTasks(): Task[] {
		return Array.from(this.tasks.values()).filter((t) => !t.parentId)
	}

	/**
	 * Get child tasks of a parent
	 */
	getChildTasks(parentId: string): Task[] {
		const parent = this.tasks.get(parentId)
		if (!parent) return []

		return parent.childIds.map((id) => this.tasks.get(id)).filter(Boolean) as Task[]
	}

	/**
	 * Create a new task
	 */
	createTask(options: CreateTaskOptions): Task {
		const now = Date.now()
		const todos = options.todos ? parseTodos(options.todos) : []

		const task: Task = {
			id: uuidv4(),
			parentId: options.parentId,
			childIds: [],
			mode: options.mode,
			message: options.message,
			status: "pending",
			todos,
			messages: [],
			createdAt: now,
			updatedAt: now,
		}

		this.tasks.set(task.id, task)

		// If this is a subtask, add to parent's childIds
		if (options.parentId) {
			const parent = this.tasks.get(options.parentId)
			if (parent) {
				parent.childIds.push(task.id)
				parent.updatedAt = now
			}
		}

		this.emit("task-created", task)
		return task
	}

	/**
	 * Start a task (transition from pending to running)
	 */
	startTask(taskId: string): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		if (task.status !== "pending") {
			throw new Error(`Task ${taskId} is not in pending state`)
		}

		// Pause current active task if exists
		if (this.activeTaskId && this.activeTaskId !== taskId) {
			this.pauseTask(this.activeTaskId)
		}

		task.status = "running"
		task.updatedAt = Date.now()
		this.activeTaskId = taskId
		this.taskStack.push(taskId)

		this.emit("task-started", taskId)
		this.emit("active-task-changed", taskId)
	}

	/**
	 * Pause a running task (for delegation)
	 */
	pauseTask(taskId: string): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		if (task.status !== "running") {
			return // Can only pause running tasks
		}

		task.status = "paused"
		task.updatedAt = Date.now()

		// Remove from active if it was active
		if (this.activeTaskId === taskId) {
			this.activeTaskId = null
		}

		this.emit("task-paused", taskId)
		this.emit("active-task-changed", null)
	}

	/**
	 * Resume a paused task
	 */
	resumeTask(taskId: string): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		if (task.status !== "paused") {
			throw new Error(`Task ${taskId} is not paused`)
		}

		// Pause current active task if exists
		if (this.activeTaskId && this.activeTaskId !== taskId) {
			this.pauseTask(this.activeTaskId)
		}

		task.status = "running"
		task.updatedAt = Date.now()
		this.activeTaskId = taskId

		this.emit("task-resumed", taskId)
		this.emit("active-task-changed", taskId)
	}

	/**
	 * Complete a task with a result
	 */
	completeTask(taskId: string, result: string): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		task.status = "completed"
		task.result = result
		task.updatedAt = Date.now()

		// Remove from active
		if (this.activeTaskId === taskId) {
			this.activeTaskId = null
			this.taskStack.pop()

			// Resume parent task if exists
			if (task.parentId) {
				const parent = this.tasks.get(task.parentId)
				if (parent && parent.status === "paused") {
					this.resumeTask(task.parentId)

					// Add child result as message to parent
					this.addMessage(task.parentId, {
						role: "assistant",
						content: `Subtask completed:\n${result}`,
					})
				}
			}
		}

		this.emit("task-completed", taskId, result)
	}

	/**
	 * Fail a task with an error
	 */
	failTask(taskId: string, error: string): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		task.status = "failed"
		task.error = error
		task.updatedAt = Date.now()

		// Remove from active
		if (this.activeTaskId === taskId) {
			this.activeTaskId = null
			this.taskStack.pop()

			// Resume parent task if exists
			if (task.parentId) {
				const parent = this.tasks.get(task.parentId)
				if (parent && parent.status === "paused") {
					this.resumeTask(task.parentId)

					// Add error as message to parent
					this.addMessage(task.parentId, {
						role: "assistant",
						content: `Subtask failed: ${error}`,
					})
				}
			}
		}

		this.emit("task-failed", taskId, error)
	}

	/**
	 * Cancel a task
	 */
	cancelTask(taskId: string): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		task.status = "cancelled"
		task.updatedAt = Date.now()

		// Cancel all child tasks
		for (const childId of task.childIds) {
			const child = this.tasks.get(childId)
			if (child && child.status !== "completed" && child.status !== "failed") {
				this.cancelTask(childId)
			}
		}

		// Remove from active
		if (this.activeTaskId === taskId) {
			this.activeTaskId = null
			this.taskStack.pop()
		}

		this.emit("task-cancelled", taskId)
	}

	/**
	 * Add a message to a task
	 */
	addMessage(taskId: string, message: Omit<TaskMessage, "timestamp">): TaskMessage {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		const fullMessage: TaskMessage = {
			...message,
			timestamp: Date.now(),
		}

		task.messages.push(fullMessage)
		task.updatedAt = fullMessage.timestamp

		this.emit("message-added", taskId, fullMessage)
		return fullMessage
	}

	/**
	 * Update todos for a task
	 */
	updateTodos(taskId: string, todos: TodoItem[]): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		task.todos = todos
		task.updatedAt = Date.now()

		this.emit("todo-updated", taskId, todos)
	}

	/**
	 * Update a single todo item
	 */
	updateTodo(taskId: string, todoId: string, status: TodoItem["status"]): void {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Task ${taskId} not found`)
		}

		const todo = task.todos.find((t) => t.id === todoId)
		if (!todo) {
			throw new Error(`Todo ${todoId} not found in task ${taskId}`)
		}

		todo.status = status
		task.updatedAt = Date.now()

		this.emit("todo-updated", taskId, task.todos)
	}

	/**
	 * Create a subtask (delegate work)
	 */
	async createSubTask(request: SubTaskRequest): Promise<SubTaskResponse> {
		const parent = this.tasks.get(request.parentTaskId)
		if (!parent) {
			return {
				childTaskId: "",
				error: `Parent task ${request.parentTaskId} not found`,
			}
		}

		// Pause parent
		this.pauseTask(request.parentTaskId)

		// Create child task
		const childTask = this.createTask({
			mode: request.mode,
			message: request.message,
			parentId: request.parentTaskId,
			todos: request.todos ? request.todos.map((t) => `- [${t.status === "completed" ? "x" : " "}] ${t.content}`).join("\n") : undefined,
		})

		// Start child task
		this.startTask(childTask.id)

		return {
			childTaskId: childTask.id,
		}
	}

	/**
	 * Get task history for persistence
	 */
	getTaskHistory(): Task[] {
		return Array.from(this.tasks.values()).sort((a, b) => a.createdAt - b.createdAt)
	}

	/**
	 * Clear completed/failed tasks older than a certain age
	 */
	clearOldTasks(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
		const now = Date.now()
		const cutoff = now - maxAge

		for (const [id, task] of this.tasks.entries()) {
			if (
				(task.status === "completed" || task.status === "failed" || task.status === "cancelled") &&
				task.updatedAt < cutoff
			) {
				this.tasks.delete(id)
			}
		}
	}

	// Typed event emitter methods
	override emit<K extends keyof TaskManagerEvents>(event: K, ...args: Parameters<TaskManagerEvents[K]>): boolean {
		return super.emit(event, ...args)
	}

	override on<K extends keyof TaskManagerEvents>(event: K, listener: TaskManagerEvents[K]): this {
		return super.on(event, listener)
	}

	override off<K extends keyof TaskManagerEvents>(event: K, listener: TaskManagerEvents[K]): this {
		return super.off(event, listener)
	}
}