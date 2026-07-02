/**
 * Graphics Mode Manager
 *
 * Coordinates Graphics Mode switching based on user intent detection.
 * Integrates GraphicsIntentRouter with the mode system to provide:
 * - Automatic mode suggestions for graphics-related queries
 * - Temporary mode switching for high-confidence intents
 * - Mode state tracking and persistence
 *
 * @module graphics-agent/GraphicsModeManager
 */

import { detectGraphicsIntent, type IntentDetectionResult } from "./GraphicsIntentRouter"
import { GRAPHICS_MODE_SLUG } from "./GraphicsModeDefinition"

/**
 * Mode switching decision result.
 */
export interface ModeSwitchDecision {
	/** Whether to switch modes */
	shouldSwitch: boolean
	/** Target mode slug */
	targetMode?: string
	/** Reason for the decision */
	reason: string
	/** Whether this is a temporary switch (revert after response) */
	isTemporary: boolean
	/** Whether to ask user for confirmation */
	requiresConfirmation: boolean
}

/**
 * Graphics Mode state tracking.
 */
export interface GraphicsModeState {
	/** Current active mode */
	currentMode: string
	/** Whether we're in a temporary graphics mode */
	isTemporaryGraphicsMode: boolean
	/** Mode to revert to after temporary switch */
	previousMode?: string
	/** Last graphics intent detection result */
	lastIntentResult?: IntentDetectionResult
}

/**
 * Manager for Graphics Mode switching logic.
 */
export class GraphicsModeManager {
	private state: GraphicsModeState = {
		currentMode: "code",
		isTemporaryGraphicsMode: false,
	}

	/**
	 * Get current mode state.
	 */
	getState(): Readonly<GraphicsModeState> {
		return { ...this.state }
	}

	/**
	 * Update current mode (called when mode changes).
	 */
	setCurrentMode(mode: string): void {
		// If we're leaving graphics mode, clear temporary state
		if (this.state.currentMode === GRAPHICS_MODE_SLUG && mode !== GRAPHICS_MODE_SLUG) {
			this.state.isTemporaryGraphicsMode = false
			this.state.previousMode = undefined
		}
		this.state.currentMode = mode
	}

	/**
	 * Analyze a user message and decide whether to switch to Graphics Mode.
	 *
	 * @param message - User's message text
	 * @returns Mode switch decision
	 */
	analyzeMessage(message: string): ModeSwitchDecision {
		// Already in graphics mode, no switch needed
		if (this.state.currentMode === GRAPHICS_MODE_SLUG) {
			return {
				shouldSwitch: false,
				reason: "Already in Graphics Mode",
				isTemporary: false,
				requiresConfirmation: false,
			}
		}

		// Detect graphics intent
		const intentResult = detectGraphicsIntent(message)
		this.state.lastIntentResult = intentResult

		// No graphics intent detected
		if (!intentResult.isGraphicsIntent) {
			return {
				shouldSwitch: false,
				reason: "No graphics intent detected",
				isTemporary: false,
				requiresConfirmation: false,
			}
		}

		// High confidence intent - suggest temporary switch
		if (intentResult.confidence >= 0.8 && intentResult.autoSwitchMode) {
			return {
				shouldSwitch: true,
				targetMode: GRAPHICS_MODE_SLUG,
				reason: `High-confidence graphics intent detected (${intentResult.intent}, confidence: ${intentResult.confidence})`,
				isTemporary: true,
				requiresConfirmation: false, // Auto-switch for high confidence
			}
		}

		// Medium confidence - suggest with confirmation
		if (intentResult.confidence >= 0.5 && intentResult.suggestModeSwitch) {
			return {
				shouldSwitch: true,
				targetMode: GRAPHICS_MODE_SLUG,
				reason: `Graphics intent detected (${intentResult.intent}, confidence: ${intentResult.confidence})`,
				isTemporary: true,
				requiresConfirmation: true,
			}
		}

		// Low confidence - no switch
		return {
			shouldSwitch: false,
			reason: `Low-confidence graphics intent (${intentResult.confidence}), staying in current mode`,
			isTemporary: false,
			requiresConfirmation: false,
		}
	}

	/**
	 * Execute a mode switch decision.
	 *
	 * @param decision - The mode switch decision to execute
	 * @param switchModeFn - Function to actually switch modes
	 * @returns Promise that resolves when switch is complete
	 */
	async executeSwitch(
		decision: ModeSwitchDecision,
		switchModeFn: (mode: string) => Promise<void>,
	): Promise<void> {
		if (!decision.shouldSwitch || !decision.targetMode) {
			return
		}

		// Save previous mode for temporary switches
		if (decision.isTemporary) {
			this.state.previousMode = this.state.currentMode
			this.state.isTemporaryGraphicsMode = true
		}

		// Perform the switch
		await switchModeFn(decision.targetMode)
		this.state.currentMode = decision.targetMode
	}

	/**
	 * Revert from temporary graphics mode to previous mode.
	 *
	 * @param switchModeFn - Function to actually switch modes
	 * @returns Promise that resolves when revert is complete
	 */
	async revertTemporaryMode(
		switchModeFn: (mode: string) => Promise<void>,
	): Promise<void> {
		if (!this.state.isTemporaryGraphicsMode || !this.state.previousMode) {
			return
		}

		const targetMode = this.state.previousMode
		this.state.isTemporaryGraphicsMode = false
		this.state.previousMode = undefined

		await switchModeFn(targetMode)
		this.state.currentMode = targetMode
	}

	/**
	 * Check if we should revert from temporary graphics mode.
	 * Called after each response to determine if temporary mode should end.
	 *
	 * @param responseMessage - The AI's response message
	 * @returns Whether to revert
	 */
	shouldRevertAfterResponse(responseMessage: string): boolean {
		// Only revert if we're in temporary graphics mode
		if (!this.state.isTemporaryGraphicsMode) {
			return false
		}

		// Check if response indicates graphics analysis is complete
		// Look for completion indicators
		const completionIndicators = [
			"analysis complete",
			"分析完成",
			"recommendation",
			"建议",
			"next steps",
			"下一步",
			"summary",
			"总结",
		]

		const lowerResponse = responseMessage.toLowerCase()
		const hasCompletionIndicator = completionIndicators.some((indicator) =>
			lowerResponse.includes(indicator),
		)

		// If response has completion indicator, revert
		if (hasCompletionIndicator) {
			return true
		}

		// Check if next user message is non-graphics
		// This will be handled by the next analyzeMessage call
		return false
	}

	/**
	 * Get a user-friendly message for mode switch suggestion.
	 */
	getSwitchSuggestionMessage(decision: ModeSwitchDecision): string | null {
		if (!decision.shouldSwitch || !decision.requiresConfirmation) {
			return null
		}

		return `检测到图形相关意图 (${decision.reason})。是否切换到 Graphics Mode 进行专业分析？`
	}
}

/**
 * Singleton instance for global use.
 */
export const graphicsModeManager = new GraphicsModeManager()
