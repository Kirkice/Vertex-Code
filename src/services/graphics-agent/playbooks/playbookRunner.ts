/**
 * Graphics Playbook Runner
 *
 * Executes predefined graphics debug playbooks for common issues.
 * Playbooks provide structured, repeatable analysis workflows for
 * specific types of graphics problems.
 *
 * @module graphics-agent/playbooks/playbookRunner
 */

import type { GraphicsCaptureProvider } from "../../graphics-provider/GraphicsCaptureProvider"
import type {
	GraphicsPlaybookId,
	GraphicsWorkflowResult,
	EvidenceItem,
	SuspectedIssue,
} from "../../graphics-provider/GraphicsProviderTypes"
import { blackScreenPlaybook } from "./blackScreen"
import { gpuSlowPlaybook } from "./gpuSlow"
import { heavyShaderPlaybook } from "./heavyShader"
import { shadowIssuePlaybook } from "./shadowIssue"

/**
 * Interface for a graphics debug playbook.
 */
export interface GraphicsPlaybook {
	/** Unique identifier for this playbook */
	readonly id: GraphicsPlaybookId
	/** Human-readable name */
	readonly name: string
	/** Description of what this playbook diagnoses */
	readonly description: string
	/** Required provider capabilities */
	readonly requiredCapabilities: string[]

	/**
	 * Execute the playbook with the given provider.
	 *
	 * @param provider - The graphics provider to use
	 * @param userMessage - Optional user message with additional context
	 * @returns Structured workflow result
	 */
	execute(
		provider: GraphicsCaptureProvider,
		userMessage?: string,
	): Promise<GraphicsWorkflowResult>
}

/**
 * Registry of available playbooks.
 */
const playbookRegistry = new Map<GraphicsPlaybookId, GraphicsPlaybook>()

// Register built-in playbooks
playbookRegistry.set("black_screen", blackScreenPlaybook)
playbookRegistry.set("gpu_slow", gpuSlowPlaybook)
playbookRegistry.set("heavy_shader", heavyShaderPlaybook)
playbookRegistry.set("shadow_issue", shadowIssuePlaybook)

/**
 * Get a playbook by ID.
 *
 * @param id - The playbook ID
 * @returns The playbook, or undefined if not found
 */
export function getPlaybook(id: GraphicsPlaybookId): GraphicsPlaybook | undefined {
	return playbookRegistry.get(id)
}

/**
 * Get all available playbooks.
 *
 * @returns Array of all registered playbooks
 */
export function getAllPlaybooks(): GraphicsPlaybook[] {
	return Array.from(playbookRegistry.values())
}

/**
 * Execute a playbook by ID.
 *
 * @param id - The playbook ID to execute
 * @param provider - The graphics provider to use
 * @param userMessage - Optional user message with additional context
 * @returns Structured workflow result
 */
export async function runPlaybook(
	id: GraphicsPlaybookId,
	provider: GraphicsCaptureProvider,
	userMessage?: string,
): Promise<GraphicsWorkflowResult> {
	const playbook = playbookRegistry.get(id)

	if (!playbook) {
		return {
			success: false,
			summary: `Playbook not found: ${id}`,
			evidence: [],
			suspectedIssues: [],
			suggestions: [
				"Available playbooks:",
				...getAllPlaybooks().map((p) => `- ${p.id}: ${p.name} - ${p.description}`),
			],
			error: `Unknown playbook: ${id}`,
		}
	}

	return playbook.execute(provider, userMessage)
}

/**
 * Detect which playbook to run based on user message.
 *
 * @param message - The user's message
 * @returns The detected playbook ID, or null if no match
 */
export function detectPlaybookFromMessage(message: string): GraphicsPlaybookId | null {
	const lowerMessage = message.toLowerCase()

	// Black screen patterns
	if (
		lowerMessage.includes("黑屏") ||
		lowerMessage.includes("black screen") ||
		lowerMessage.includes("nothing rendered") ||
		lowerMessage.includes("blank screen") ||
		lowerMessage.includes("空白")
	) {
		return "black_screen"
	}

	// GPU slow patterns
	if (
		lowerMessage.includes("gpu 慢") ||
		lowerMessage.includes("gpu slow") ||
		lowerMessage.includes("帧慢") ||
		lowerMessage.includes("frame slow") ||
		lowerMessage.includes("性能问题") ||
		lowerMessage.includes("performance issue") ||
		lowerMessage.includes("掉帧") ||
		lowerMessage.includes("frame drop")
	) {
		return "gpu_slow"
	}

	// Heavy shader patterns
	if (
		lowerMessage.includes("shader 重") ||
		lowerMessage.includes("shader 慢") ||
		lowerMessage.includes("heavy shader") ||
		lowerMessage.includes("shader slow") ||
		lowerMessage.includes("着色器性能") ||
		lowerMessage.includes("shader performance")
	) {
		return "heavy_shader"
	}

	return null
}
