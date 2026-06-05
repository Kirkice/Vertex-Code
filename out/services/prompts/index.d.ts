/**
 * PromptsService - Manages custom prompt templates
 * Ported from Zoo-Code with VertexAI naming
 */
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    content: string;
    category: "system" | "user" | "assistant";
    isCustom: boolean;
}
export declare const DEFAULT_PROMPTS: PromptTemplate[];
export declare class PromptsService {
    private prompts;
    constructor(customPrompts?: PromptTemplate[]);
    getAllPrompts(): PromptTemplate[];
    getCustomPrompts(): PromptTemplate[];
    getPrompt(id: string): PromptTemplate | undefined;
    getPromptsByCategory(category: "system" | "user" | "assistant"): PromptTemplate[];
    addPrompt(prompt: Omit<PromptTemplate, "isCustom">): void;
    removePrompt(id: string): boolean;
    updatePrompt(id: string, updates: Partial<Omit<PromptTemplate, "id" | "isCustom">>): boolean;
    toJSON(): PromptTemplate[];
    static fromJSON(data: PromptTemplate[]): PromptsService;
}
//# sourceMappingURL=index.d.ts.map