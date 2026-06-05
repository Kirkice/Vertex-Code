"use strict";
/**
 * PromptsService - Manages custom prompt templates
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptsService = exports.DEFAULT_PROMPTS = void 0;
exports.DEFAULT_PROMPTS = [
    {
        id: "code-review",
        name: "Code Review",
        description: "Review code for best practices and potential issues",
        content: "Please review the following code and provide feedback on:\n1. Code quality and readability\n2. Best practices adherence\n3. Potential bugs or issues\n4. Performance considerations",
        category: "user",
        isCustom: false,
    },
    {
        id: "refactor",
        name: "Refactor Code",
        description: "Refactor code for better maintainability",
        content: "Please refactor the following code to improve:\n1. Readability\n2. Maintainability\n3. Performance\n4. Adherence to DRY principles",
        category: "user",
        isCustom: false,
    },
    {
        id: "explain",
        name: "Explain Code",
        description: "Explain what the code does",
        content: "Please explain the following code in detail:\n1. What it does\n2. How it works\n3. Key components and their purposes\n4. Any important patterns or techniques used",
        category: "user",
        isCustom: false,
    },
];
class PromptsService {
    constructor(customPrompts) {
        this.prompts = [...exports.DEFAULT_PROMPTS, ...(customPrompts || [])];
    }
    getAllPrompts() {
        return [...this.prompts];
    }
    getCustomPrompts() {
        return this.prompts.filter((p) => p.isCustom);
    }
    getPrompt(id) {
        return this.prompts.find((p) => p.id === id);
    }
    getPromptsByCategory(category) {
        return this.prompts.filter((p) => p.category === category);
    }
    addPrompt(prompt) {
        const existing = this.prompts.findIndex((p) => p.id === prompt.id);
        if (existing >= 0) {
            this.prompts[existing] = { ...prompt, isCustom: true };
        }
        else {
            this.prompts.push({ ...prompt, isCustom: true });
        }
    }
    removePrompt(id) {
        const index = this.prompts.findIndex((p) => p.id === id && p.isCustom);
        if (index >= 0) {
            this.prompts.splice(index, 1);
            return true;
        }
        return false;
    }
    updatePrompt(id, updates) {
        const index = this.prompts.findIndex((p) => p.id === id && p.isCustom);
        if (index >= 0) {
            this.prompts[index] = { ...this.prompts[index], ...updates };
            return true;
        }
        return false;
    }
    toJSON() {
        return this.getCustomPrompts();
    }
    static fromJSON(data) {
        return new PromptsService(data);
    }
}
exports.PromptsService = PromptsService;
//# sourceMappingURL=index.js.map