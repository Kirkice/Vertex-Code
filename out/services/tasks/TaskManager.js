"use strict";
/**
 * TaskManager - Core task lifecycle management
 * Handles task creation, delegation, pausing, resuming, and completion
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskManager = void 0;
const uuid_1 = require("uuid");
const events_1 = __importDefault(require("events"));
const types_1 = require("./types");
class TaskManager extends events_1.default {
    constructor() {
        super(...arguments);
        this.tasks = new Map();
        this.activeTaskId = null;
        this.taskStack = []; // Stack for parent-child relationships
    }
    /**
     * Get all tasks
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    /**
     * Get a specific task by ID
     */
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    /**
     * Get the currently active task
     */
    getActiveTask() {
        if (!this.activeTaskId)
            return null;
        return this.tasks.get(this.activeTaskId) || null;
    }
    /**
     * Get root tasks (tasks without parents)
     */
    getRootTasks() {
        return Array.from(this.tasks.values()).filter((t) => !t.parentId);
    }
    /**
     * Get child tasks of a parent
     */
    getChildTasks(parentId) {
        const parent = this.tasks.get(parentId);
        if (!parent)
            return [];
        return parent.childIds.map((id) => this.tasks.get(id)).filter(Boolean);
    }
    /**
     * Create a new task
     */
    createTask(options) {
        const now = Date.now();
        const todos = options.todos ? (0, types_1.parseTodos)(options.todos) : [];
        const task = {
            id: (0, uuid_1.v4)(),
            parentId: options.parentId,
            childIds: [],
            mode: options.mode,
            message: options.message,
            status: "pending",
            todos,
            messages: [],
            createdAt: now,
            updatedAt: now,
        };
        this.tasks.set(task.id, task);
        // If this is a subtask, add to parent's childIds
        if (options.parentId) {
            const parent = this.tasks.get(options.parentId);
            if (parent) {
                parent.childIds.push(task.id);
                parent.updatedAt = now;
            }
        }
        this.emit("task-created", task);
        return task;
    }
    /**
     * Start a task (transition from pending to running)
     */
    startTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        if (task.status !== "pending") {
            throw new Error(`Task ${taskId} is not in pending state`);
        }
        // Pause current active task if exists
        if (this.activeTaskId && this.activeTaskId !== taskId) {
            this.pauseTask(this.activeTaskId);
        }
        task.status = "running";
        task.updatedAt = Date.now();
        this.activeTaskId = taskId;
        this.taskStack.push(taskId);
        this.emit("task-started", taskId);
        this.emit("active-task-changed", taskId);
    }
    /**
     * Pause a running task (for delegation)
     */
    pauseTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        if (task.status !== "running") {
            return; // Can only pause running tasks
        }
        task.status = "paused";
        task.updatedAt = Date.now();
        // Remove from active if it was active
        if (this.activeTaskId === taskId) {
            this.activeTaskId = null;
        }
        this.emit("task-paused", taskId);
        this.emit("active-task-changed", null);
    }
    /**
     * Resume a paused task
     */
    resumeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        if (task.status !== "paused") {
            throw new Error(`Task ${taskId} is not paused`);
        }
        // Pause current active task if exists
        if (this.activeTaskId && this.activeTaskId !== taskId) {
            this.pauseTask(this.activeTaskId);
        }
        task.status = "running";
        task.updatedAt = Date.now();
        this.activeTaskId = taskId;
        this.emit("task-resumed", taskId);
        this.emit("active-task-changed", taskId);
    }
    /**
     * Complete a task with a result
     */
    completeTask(taskId, result) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        task.status = "completed";
        task.result = result;
        task.updatedAt = Date.now();
        // Remove from active
        if (this.activeTaskId === taskId) {
            this.activeTaskId = null;
            this.taskStack.pop();
            // Resume parent task if exists
            if (task.parentId) {
                const parent = this.tasks.get(task.parentId);
                if (parent && parent.status === "paused") {
                    this.resumeTask(task.parentId);
                    // Add child result as message to parent
                    this.addMessage(task.parentId, {
                        role: "assistant",
                        content: `Subtask completed:\n${result}`,
                    });
                }
            }
        }
        this.emit("task-completed", taskId, result);
    }
    /**
     * Fail a task with an error
     */
    failTask(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        task.status = "failed";
        task.error = error;
        task.updatedAt = Date.now();
        // Remove from active
        if (this.activeTaskId === taskId) {
            this.activeTaskId = null;
            this.taskStack.pop();
            // Resume parent task if exists
            if (task.parentId) {
                const parent = this.tasks.get(task.parentId);
                if (parent && parent.status === "paused") {
                    this.resumeTask(task.parentId);
                    // Add error as message to parent
                    this.addMessage(task.parentId, {
                        role: "assistant",
                        content: `Subtask failed: ${error}`,
                    });
                }
            }
        }
        this.emit("task-failed", taskId, error);
    }
    /**
     * Cancel a task
     */
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        task.status = "cancelled";
        task.updatedAt = Date.now();
        // Cancel all child tasks
        for (const childId of task.childIds) {
            const child = this.tasks.get(childId);
            if (child && child.status !== "completed" && child.status !== "failed") {
                this.cancelTask(childId);
            }
        }
        // Remove from active
        if (this.activeTaskId === taskId) {
            this.activeTaskId = null;
            this.taskStack.pop();
        }
        this.emit("task-cancelled", taskId);
    }
    /**
     * Add a message to a task
     */
    addMessage(taskId, message) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        const fullMessage = {
            ...message,
            timestamp: Date.now(),
        };
        task.messages.push(fullMessage);
        task.updatedAt = fullMessage.timestamp;
        this.emit("message-added", taskId, fullMessage);
        return fullMessage;
    }
    /**
     * Update todos for a task
     */
    updateTodos(taskId, todos) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        task.todos = todos;
        task.updatedAt = Date.now();
        this.emit("todo-updated", taskId, todos);
    }
    /**
     * Update a single todo item
     */
    updateTodo(taskId, todoId, status) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        const todo = task.todos.find((t) => t.id === todoId);
        if (!todo) {
            throw new Error(`Todo ${todoId} not found in task ${taskId}`);
        }
        todo.status = status;
        task.updatedAt = Date.now();
        this.emit("todo-updated", taskId, task.todos);
    }
    /**
     * Create a subtask (delegate work)
     */
    async createSubTask(request) {
        const parent = this.tasks.get(request.parentTaskId);
        if (!parent) {
            return {
                childTaskId: "",
                error: `Parent task ${request.parentTaskId} not found`,
            };
        }
        // Pause parent
        this.pauseTask(request.parentTaskId);
        // Create child task
        const childTask = this.createTask({
            mode: request.mode,
            message: request.message,
            parentId: request.parentTaskId,
            todos: request.todos ? request.todos.map((t) => `- [${t.status === "completed" ? "x" : " "}] ${t.content}`).join("\n") : undefined,
        });
        // Start child task
        this.startTask(childTask.id);
        return {
            childTaskId: childTask.id,
        };
    }
    /**
     * Get task history for persistence
     */
    getTaskHistory() {
        return Array.from(this.tasks.values()).sort((a, b) => a.createdAt - b.createdAt);
    }
    /**
     * Clear completed/failed tasks older than a certain age
     */
    clearOldTasks(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const cutoff = now - maxAge;
        for (const [id, task] of this.tasks.entries()) {
            if ((task.status === "completed" || task.status === "failed" || task.status === "cancelled") &&
                task.updatedAt < cutoff) {
                this.tasks.delete(id);
            }
        }
    }
    // Typed event emitter methods
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
}
exports.TaskManager = TaskManager;
//# sourceMappingURL=TaskManager.js.map