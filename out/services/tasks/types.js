"use strict";
/**
 * Task Management Types
 * Defines task structure, status, and delegation protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTodos = parseTodos;
exports.todosToMarkdown = todosToMarkdown;
/**
 * Parse markdown checklist into TodoItem array
 */
function parseTodos(markdown) {
    const lines = markdown.split("\n");
    const todos = [];
    let idCounter = 1;
    for (const line of lines) {
        const trimmed = line.trim();
        // Match checkbox patterns: - [ ], - [x], * [ ], * [x]
        const match = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
        if (match) {
            const status = match[1].toLowerCase() === "x" ? "completed" : "pending";
            const content = match[2].trim();
            todos.push({
                id: `todo-${idCounter++}`,
                content,
                status,
            });
        }
    }
    return todos;
}
/**
 * Convert TodoItem array back to markdown checklist
 */
function todosToMarkdown(todos) {
    return todos
        .map((todo) => {
        const checkbox = todo.status === "completed" ? "[x]" : "[ ]";
        return `- ${checkbox} ${todo.content}`;
    })
        .join("\n");
}
//# sourceMappingURL=types.js.map