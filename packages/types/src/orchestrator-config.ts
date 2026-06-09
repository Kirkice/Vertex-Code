/**
 * Orchestrator Provider Configuration
 *
 * Defines how orchestrator components (planner, reviewer, worker)
 * map to provider profiles in the existing profile system.
 */

/**
 * Routing policy for orchestrator tasks
 */
export interface OrchestratorRoutingPolicy {
	/** Route high-risk tasks to planner model instead of worker */
	highRiskToPlanner: boolean
	/** Budget pressure level affects model selection */
	budgetPressure: "low" | "medium" | "high"
	/** Maximum repair rounds before giving up */
	maxRepairRounds: number
}

/**
 * Worker profiles configuration
 */
export interface OrchestratorWorkerProfiles {
	/** Primary worker provider profile name */
	primary: string
	/** Fallback worker provider profile name */
	fallback: string
}

/**
 * Orchestrator provider configuration
 *
 * Maps orchestrator components to provider profiles.
 * Integrates with existing ProviderSettingsManager + modeApiConfigs.
 */
export interface OrchestratorProviderConfig {
	/** Provider profile for Planner (task planning) */
	plannerProfile: string
	/** Provider profile for Reviewer (acceptance review) */
	reviewerProfile: string
	/** Provider profiles for Worker execution */
	workerProfiles: OrchestratorWorkerProfiles
	/** Routing policy */
	routingPolicy: OrchestratorRoutingPolicy
	/** Enable orchestrator mode */
	enabled: boolean
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorProviderConfig = {
	plannerProfile: "openai-codex",
	reviewerProfile: "openai-codex",
	workerProfiles: {
		primary: "deepseek",
		fallback: "qwen-code",
	},
	routingPolicy: {
		highRiskToPlanner: true,
		budgetPressure: "medium",
		maxRepairRounds: 2,
	},
	enabled: false,
}
