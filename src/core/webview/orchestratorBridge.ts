/**
 * Orchestrator Bridge
 * 
 * Bridge between webview message handler and OrchestratorSessionManager.
 * Manages session lifecycle and forwards events to webview.
 */

import type { ClineProvider } from "./ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import {
	OrchestratorSessionManager,
	createSessionManager,
	type SessionManagerConfig,
} from "../../orchestrator/session/OrchestratorSessionManager"

export class OrchestratorBridge {
	private sessionManager: OrchestratorSessionManager | null = null
	private provider: ClineProvider

	constructor(provider: ClineProvider) {
		this.provider = provider
	}

	/**
	 * Initialize session manager with current provider settings
	 */
	async initialize(): Promise<void> {
		if (this.sessionManager) {
			return // Already initialized
		}

		// Get provider settings from global state
		const config = await this.provider.getState()
		const apiConfiguration = config.apiConfiguration

		// Build Codex provider settings (use current API config as planner/reviewer)
		const codexProviderSettings: ProviderSettings = {
			...apiConfiguration,
		}

		const sessionManagerConfig: SessionManagerConfig = {
			codexProviderSettings,
			availableWorkerProviders: [apiConfiguration.apiProvider || "anthropic"],
			defaultMaxRepairRounds: config.orchestratorConfig?.routingPolicy?.maxRepairRounds ?? 2,
		}

		this.sessionManager = createSessionManager(sessionManagerConfig)

		// Forward events to webview
		this.setupEventForwarding()
	}

	/**
	 * Setup event forwarding from session manager to webview
	 */
	private setupEventForwarding(): void {
		if (!this.sessionManager) return

		// Forward session state changes
		this.sessionManager.on("sessionStateChanged", async (sessionId: string, state: string) => {
			const session = this.sessionManager?.getSession(sessionId)
			if (!session) return

			await this.pushSessionToWebview(session)
		})

		// Forward session completion
		this.sessionManager.on("sessionCompleted", async (sessionId: string, summary: string) => {
			const session = this.sessionManager?.getSession(sessionId)
			if (!session) return

			await this.pushSessionToWebview(session)
			this.provider.log(`Orchestrator session completed: ${sessionId} - ${summary}`)
		})

		// Forward session failure
		this.sessionManager.on("sessionFailed", async (sessionId: string, reason: string) => {
			const session = this.sessionManager?.getSession(sessionId)
			if (!session) return

			await this.pushSessionToWebview(session)
			this.provider.log(`Orchestrator session failed: ${sessionId} - ${reason}`)
		})

		// Forward session cancellation
		this.sessionManager.on("sessionCancelled", async (sessionId: string) => {
			const session = this.sessionManager?.getSession(sessionId)
			if (!session) return

			await this.pushSessionToWebview(session)
			this.provider.log(`Orchestrator session cancelled: ${sessionId}`)
		})

		// Forward planner direct response → push to webview as completed with directResponse
		this.sessionManager.on("plannerDirectResponse", async (sessionId: string, text: string) => {
			const session = this.sessionManager?.getSession(sessionId)
			if (!session) return

			await this.provider.postMessageToWebview({
				type: "orchestratorSessionUpdate",
				payload: {
					orchestratorSession: {
						sessionId,
						state: "completed",
						currentPhase: "planner_direct",
						directResponse: text,
						tasks: [],
						repairRound: 0,
					maxRepairRounds: session.userSettings?.maxRepairRounds ?? 2,
					costStats: (session as any).costStats ?? {
						totalTokens: 0,
						tokensByProvider: {},
						estimatedCostUsd: 0,
					},
					planSummary: null,
					},
				},
			})

			this.provider.log(`Orchestrator planner direct response: ${sessionId}`)
		})
	}

	/**
	 * Push current session state to webview
	 */
	private async pushSessionToWebview(session: any): Promise<void> {
		const plan = session.getPlan?.() || session.plan
		const snapshot = {
			sessionId: session.sessionId,
			state: session.state,
			currentPhase: session.state,
			directResponse: session.getDirectResponse?.(),
			tasks: session.getTasks().map((t: any) => ({
				taskId: t.taskId,
				kind: t.kind,
				status: t.status,
				title: t.title || t.taskId,
				patch: t.patch,
				error: t.error,
			})),
			repairRound: session.repairRound,
			maxRepairRounds: session.userSettings?.maxRepairRounds ?? 2,
			costStats: (session as any).costStats ?? {
				totalTokens: 0,
				tokensByProvider: {},
				estimatedCostUsd: 0,
			},
			planSummary: plan?.planSummary || plan?.summary,
		}

		await this.provider.postMessageToWebview({
			type: "orchestratorSessionUpdate",
			payload: {
				orchestratorSession: snapshot,
			},
		})
	}

	/**
	 * Approve a plan for a session
	 * 
	 * This method approves the plan and triggers the execution loop.
	 * If the session doesn't exist, it returns an error to the webview.
	 */
	async approvePlan(sessionId: string): Promise<void> {
		if (!this.sessionManager) {
			await this.initialize()
		}

		if (!this.sessionManager) {
			const errorMsg = "Session manager not initialized"
			this.provider.log(`[Orchestrator] Error: ${errorMsg}`)
			await this.sendErrorToWebview(sessionId, errorMsg)
			return
		}

		const session = this.sessionManager.getSession(sessionId)
		if (!session) {
			// Real error handling: session not found
			const errorMsg = `Orchestrator session not found: ${sessionId}. Please retry the request.`
			this.provider.log(`[Orchestrator] Error: ${errorMsg}`)
			await this.sendErrorToWebview(sessionId, errorMsg)
			return
		}

		this.provider.log(`[Orchestrator] Approving plan for session: ${sessionId}`)

		try {
			// Approve all tasks (no specific task IDs means approve all)
			await this.sessionManager.approvePlan(sessionId)
			this.provider.log(`[Orchestrator] Plan approved for session: ${sessionId}`)
		} catch (error) {
			const errorMsg = `Failed to approve plan: ${error instanceof Error ? error.message : String(error)}`
			this.provider.log(`[Orchestrator] Error: ${errorMsg}`)
			await this.sendErrorToWebview(sessionId, errorMsg)
		}
	}

	/**
	 * Send error message to webview
	 */
	private async sendErrorToWebview(sessionId: string, errorMessage: string): Promise<void> {
		await this.provider.postMessageToWebview({
			type: "orchestratorSessionUpdate",
			payload: {
				orchestratorSession: {
					sessionId,
					state: "failed",
					currentPhase: "error",
					tasks: [],
					repairRound: 0,
					maxRepairRounds: 2,
					costStats: {
						totalTokens: 0,
						tokensByProvider: {},
						estimatedCostUsd: 0,
					},
					planSummary: null,
					error: errorMessage,
				},
			},
		})
	}

	/**
	 * Cancel a session
	 */
	async cancelSession(sessionId: string): Promise<void> {
		if (!this.sessionManager) {
			await this.initialize()
		}

		if (!this.sessionManager) {
			throw new Error("Session manager not initialized")
		}

		const session = this.sessionManager.getSession(sessionId)
		if (!session) {
			// For skeleton version: session doesn't exist, just acknowledge
			this.provider.log(`Orchestrator: Cancel requested for non-existent session ${sessionId}. Ignoring.`)
			return
		}

		this.sessionManager.cancelSession(sessionId, "User cancelled")

		this.provider.log(`Orchestrator session cancelled: ${sessionId}`)
	}

	/**
	 * Start a new orchestrated session
	 */
	async startSession(userRequest: string, activeFile?: string, selectedText?: string): Promise<string> {
		if (!this.sessionManager) {
			await this.initialize()
		}

		if (!this.sessionManager) {
			throw new Error("Session manager not initialized")
		}

		const session = await this.sessionManager.startSession({
			userRequest,
			activeFile,
			selectedText,
		})

		// Push initial state to webview
		await this.pushSessionToWebview(session)

		return session.sessionId
	}

	/**
	 * Get current active session
	 */
	getActiveSession(): any | null {
		if (!this.sessionManager) return null

		const activeSessions = this.sessionManager.getActiveSessions()
		return activeSessions.length > 0 ? activeSessions[0] : null
	}

	/**
	 * Dispose and cleanup
	 */
	dispose(): void {
		if (this.sessionManager) {
			// Cancel all active sessions
			const activeSessions = this.sessionManager.getActiveSessions()
			for (const session of activeSessions) {
				this.sessionManager.cancelSession(session.sessionId, "Provider disposed")
			}
			this.sessionManager = null
		}
	}
}
