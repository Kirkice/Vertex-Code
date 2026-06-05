/**
 * TaskManager - Core task lifecycle management
 * Handles task creation, delegation, pausing, resuming, and completion
 */
import EventEmitter from "events";
import type { Task, TaskMessage, TodoItem, CreateTaskOptions, SubTaskRequest, SubTaskResponse } from "./types";
export interface TaskManagerEvents {
    "task-created": (task: Task) => void;
    "task-started": (taskId: string) => void;
    "task-paused": (taskId: string) => void;
    "task-resumed": (taskId: string) => void;
    "task-completed": (taskId: string, result: string) => void;
    "task-failed": (taskId: string, error: string) => void;
    "task-cancelled": (taskId: string) => void;
    "message-added": (taskId: string, message: TaskMessage) => void;
    "todo-updated": (taskId: string, todos: TodoItem[]) => void;
    "active-task-changed": (taskId: string | null) => void;
}
export declare class TaskManager extends EventEmitter {
    private tasks;
    private activeTaskId;
    private taskStack;
    /**
     * Get all tasks
     */
    getAllTasks(): Task[];
    /**
     * Get a specific task by ID
     */
    getTask(taskId: string): Task | undefined;
    /**
     * Get the currently active task
     */
    getActiveTask(): Task | null;
    /**
     * Get root tasks (tasks without parents)
     */
    getRootTasks(): Task[];
    /**
     * Get child tasks of a parent
     */
    getChildTasks(parentId: string): Task[];
    /**
     * Create a new task
     */
    createTask(options: CreateTaskOptions): Task;
    /**
     * Start a task (transition from pending to running)
     */
    startTask(taskId: string): void;
    /**
     * Pause a running task (for delegation)
     */
    pauseTask(taskId: string): void;
    /**
     * Resume a paused task
     */
    resumeTask(taskId: string): void;
    /**
     * Complete a task with a result
     */
    completeTask(taskId: string, result: string): void;
    /**
     * Fail a task with an error
     */
    failTask(taskId: string, error: string): void;
    /**
     * Cancel a task
     */
    cancelTask(taskId: string): void;
    /**
     * Add a message to a task
     */
    addMessage(taskId: string, message: Omit<TaskMessage, "timestamp">): TaskMessage;
    /**
     * Update todos for a task
     */
    updateTodos(taskId: string, todos: TodoItem[]): void;
    /**
     * Update a single todo item
     */
    updateTodo(taskId: string, todoId: string, status: TodoItem["status"]): void;
    /**
     * Create a subtask (delegate work)
     */
    createSubTask(request: SubTaskRequest): Promise<SubTaskResponse>;
    /**
     * Get task history for persistence
     */
    getTaskHistory(): Task[];
    /**
     * Clear completed/failed tasks older than a certain age
     */
    clearOldTasks(maxAge?: number): void;
    emit<K extends keyof TaskManagerEvents>(event: K, ...args: Parameters<TaskManagerEvents[K]>): boolean;
    on<K extends keyof TaskManagerEvents>(event: K, listener: TaskManagerEvents[K]): this;
    off<K extends keyof TaskManagerEvents>(event: K, listener: TaskManagerEvents[K]): this;
}
//# sourceMappingURL=TaskManager.d.ts.map