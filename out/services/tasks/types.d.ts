/**
 * Task Management Types
 * Defines task structure, status, and delegation protocol
 */
export type TaskStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
export interface TodoItem {
    id: string;
    content: string;
    status: "pending" | "in-progress" | "completed";
}
export interface TaskMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
}
export interface Task {
    id: string;
    parentId?: string;
    childIds: string[];
    mode: string;
    message: string;
    status: TaskStatus;
    todos: TodoItem[];
    messages: TaskMessage[];
    createdAt: number;
    updatedAt: number;
    result?: string;
    error?: string;
}
export interface CreateTaskOptions {
    mode: string;
    message: string;
    todos?: string;
    parentId?: string;
}
export interface TaskResult {
    taskId: string;
    status: TaskStatus;
    result?: string;
    error?: string;
    messages: TaskMessage[];
}
export interface SubTaskRequest {
    parentTaskId: string;
    mode: string;
    message: string;
    todos?: TodoItem[];
}
export interface SubTaskResponse {
    childTaskId: string;
    result?: string;
    error?: string;
}
/**
 * Parse markdown checklist into TodoItem array
 */
export declare function parseTodos(markdown: string): TodoItem[];
/**
 * Convert TodoItem array back to markdown checklist
 */
export declare function todosToMarkdown(todos: TodoItem[]): string;
//# sourceMappingURL=types.d.ts.map