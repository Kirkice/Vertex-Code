/**
 * PromptsService - Manages custom prompt templates
 * Ported from Zoo-Code with VertexAI naming
 */

export interface PromptTemplate {
	id: string
	name: string
	description: string
	content: string
	category: "system" | "user" | "assistant"
	isCustom: boolean
}

export const DEFAULT_PROMPTS: PromptTemplate[] = [
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
]

export class PromptsService {
	private prompts: PromptTemplate[]

	constructor(customPrompts?: PromptTemplate[]) {
		this.prompts = [...DEFAULT_PROMPTS, ...(customPrompts || [])]
	}

	getAllPrompts(): PromptTemplate[] {
		return [...this.prompts]
	}

	getCustomPrompts(): PromptTemplate[] {
		return this.prompts.filter((p) => p.isCustom)
	}

	getPrompt(id: string): PromptTemplate | undefined {
		return this.prompts.find((p) => p.id === id)
	}

	getPromptsByCategory(category: "system" | "user" | "assistant"): PromptTemplate[] {
		return this.prompts.filter((p) => p.category === category)
	}

	addPrompt(prompt: Omit<PromptTemplate, "isCustom">): void {
		const existing = this.prompts.findIndex((p) => p.id === prompt.id)
		if (existing >= 0) {
			this.prompts[existing] = { ...prompt, isCustom: true }
		} else {
			this.prompts.push({ ...prompt, isCustom: true })
		}
	}

	removePrompt(id: string): boolean {
		const index = this.prompts.findIndex((p) => p.id === id && p.isCustom)
		if (index >= 0) {
			this.prompts.splice(index, 1)
			return true
		}
		return false
	}

	updatePrompt(id: string, updates: Partial<Omit<PromptTemplate, "id" | "isCustom">>): boolean {
		const index = this.prompts.findIndex((p) => p.id === id && p.isCustom)
		if (index >= 0) {
			this.prompts[index] = { ...this.prompts[index], ...updates }
			return true
		}
		return false
	}

	toJSON(): PromptTemplate[] {
		return this.getCustomPrompts()
	}

	static fromJSON(data: PromptTemplate[]): PromptsService {
		return new PromptsService(data)
	}
}