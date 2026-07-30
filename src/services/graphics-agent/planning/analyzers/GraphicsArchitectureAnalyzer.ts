import type { GraphicsArchitectureCategory, GraphicsArchitectureFinding } from "@roo-code/types"

export interface GraphicsArchitectureAnalysisInput {
	path: string
	content: string
}

export interface GraphicsArchitectureAnalyzer {
	readonly id: string
	analyze(input: GraphicsArchitectureAnalysisInput): GraphicsArchitectureFinding[]
}

export interface GraphicsArchitectureRule {
	category: GraphicsArchitectureCategory
	kind: string
	pattern: RegExp
	detail: (match: RegExpMatchArray, input: GraphicsArchitectureAnalysisInput) => string
	symbol?: (match: RegExpMatchArray, input: GraphicsArchitectureAnalysisInput) => string | undefined
}

export function createRuleAnalyzer(
	id: string,
	rules: readonly GraphicsArchitectureRule[],
): GraphicsArchitectureAnalyzer {
	return {
		id,
		analyze(input) {
			const searchableText = `${input.path}\n${input.content}`
			return rules.flatMap((rule) => {
				const match = searchableText.match(rule.pattern)
				if (!match) return []
				return [
					{
						category: rule.category,
						path: input.path,
						kind: rule.kind,
						symbol: rule.symbol?.(match, input),
						detail: rule.detail(match, input),
					},
				]
			})
		},
	}
}
