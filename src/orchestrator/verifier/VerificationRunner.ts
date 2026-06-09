/**
 * Verification Runner
 *
 * Runs verification commands after task execution.
 * Supports different verification profiles (fast/standard/full).
 *
 * Integrates with existing terminal/command infrastructure.
 */

import type {
	VerificationProfile,
	VerificationReport,
	CommandResult,
	VerificationStatus,
	ExecTask,
} from "@roo-code/types"
import { createReportId } from "@roo-code/types"

/**
 * Verification command configuration
 */
export interface VerificationCommand {
	/** Command to execute */
	command: string
	/** Description of what this command verifies */
	description: string
	/** Whether failure is critical (stops verification) */
	critical?: boolean
}

/**
 * Verification profile configuration
 */
export interface VerificationProfileConfig {
	/** Profile name */
	name: VerificationProfile
	/** Commands to run */
	commands: VerificationCommand[]
	/** Timeout per command (ms) */
	timeoutMs?: number
}

/**
 * Default verification profiles
 */
const DEFAULT_PROFILES: Record<VerificationProfile, VerificationProfileConfig> = {
	fast: {
		name: "fast",
		commands: [
			{ command: "npx tsc --noEmit", description: "TypeScript type check", critical: true },
		],
		timeoutMs: 60_000,
	},
	standard: {
		name: "standard",
		commands: [
			{ command: "npx eslint . --ext .ts,.tsx", description: "ESLint check", critical: false },
			{ command: "npx tsc --noEmit", description: "TypeScript type check", critical: true },
			{ command: "npm test", description: "Run tests", critical: true },
		],
		timeoutMs: 120_000,
	},
	full: {
		name: "full",
		commands: [
			{ command: "npx eslint . --ext .ts,.tsx", description: "ESLint check", critical: false },
			{ command: "npx tsc --noEmit", description: "TypeScript type check", critical: true },
			{ command: "npm test", description: "Run tests", critical: true },
			{ command: "npm run build", description: "Build project", critical: true },
		],
		timeoutMs: 300_000,
	},
}

/**
 * Command executor interface (for dependency injection)
 */
export interface CommandExecutor {
	execute(command: string, cwd: string, timeoutMs: number): Promise<{
		exitCode: number
		stdout: string
		stderr: string
		durationMs: number
	}>
}

/**
 * Default command executor (placeholder - real implementation would use existing terminal infrastructure)
 */
const defaultExecutor: CommandExecutor = {
	async execute(command: string, cwd: string, timeoutMs: number) {
		// In real implementation, this would call the existing terminal/command infrastructure
		// For now, return a placeholder result
		console.log(`[VerificationRunner] Would execute: ${command} in ${cwd}`)
		return {
			exitCode: 0,
			stdout: "Placeholder - real implementation pending",
			stderr: "",
			durationMs: 0,
		}
	},
}

/**
 * Determine verification profile based on task characteristics
 */
export function determineVerificationProfile(task: ExecTask): VerificationProfile {
	// High risk or multi-file changes -> full verification
	if (task.riskLevel === "high" || task.allowedWritePaths.length >= 3) {
		return "full"
	}

	// Single file, low risk -> fast verification
	if (task.allowedWritePaths.length === 1 && task.riskLevel === "low") {
		return "fast"
	}

	// Default -> standard
	return "standard"
}

/**
 * Verification Runner
 *
 * Executes verification commands and produces reports.
 */
export class VerificationRunner {
	private profiles: Map<VerificationProfile, VerificationProfileConfig>
	private executor: CommandExecutor
	private workspacePath: string

	constructor(
		workspacePath: string,
		executor?: CommandExecutor,
		customProfiles?: Partial<Record<VerificationProfile, VerificationProfileConfig>>,
	) {
		this.workspacePath = workspacePath
		this.executor = executor ?? defaultExecutor
		this.profiles = new Map()

		// Load default profiles
		for (const [key, config] of Object.entries(DEFAULT_PROFILES)) {
			this.profiles.set(key as VerificationProfile, config)
		}

		// Override with custom profiles
		if (customProfiles) {
			for (const [key, config] of Object.entries(customProfiles)) {
				if (config) {
					this.profiles.set(key as VerificationProfile, config)
				}
			}
		}
	}

	/**
	 * Run verification for a task
	 */
	async verify(
		taskId: string,
		sessionId: string,
		changedFiles: string[],
		profile?: VerificationProfile,
	): Promise<VerificationReport> {
		const selectedProfile = profile ?? "standard"
		const profileConfig = this.profiles.get(selectedProfile)

		if (!profileConfig) {
			throw new Error(`Unknown verification profile: ${selectedProfile}`)
		}

		const commandResults: CommandResult[] = []
		const failedCriteriaIds: string[] = []
		let overallStatus: VerificationStatus = "passed"

		for (const cmd of profileConfig.commands) {
			try {
				const result = await this.executor.execute(
					cmd.command,
					this.workspacePath,
					profileConfig.timeoutMs ?? 60_000,
				)

				const commandResult: CommandResult = {
					command: cmd.command,
					exitCode: result.exitCode,
					summary: result.exitCode === 0 ? "Passed" : `Failed with exit code ${result.exitCode}`,
					stdout: result.stdout.slice(0, 5000), // Truncate large outputs
					stderr: result.stderr.slice(0, 5000),
					durationMs: result.durationMs,
				}

				commandResults.push(commandResult)

				if (result.exitCode !== 0) {
					if (cmd.critical) {
						overallStatus = "failed"
						// Stop on critical failure
						break
					} else {
						overallStatus = "partial"
					}
				}
			} catch (error) {
				commandResults.push({
					command: cmd.command,
					exitCode: -1,
					summary: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
					stdout: "",
					stderr: error instanceof Error ? error.message : String(error),
				})
				overallStatus = "failed"
				if (cmd.critical) break
			}
		}

		return {
			reportId: createReportId(),
			sessionId,
			status: overallStatus,
			profile: selectedProfile,
			commandResults,
			failedCriteriaIds,
			generatedAt: new Date().toISOString(),
		}
	}

	/**
	 * Add or update a verification profile
	 */
	setProfile(config: VerificationProfileConfig): void {
		this.profiles.set(config.name, config)
	}

	/**
	 * Get available profiles
	 */
	getAvailableProfiles(): VerificationProfile[] {
		return Array.from(this.profiles.keys())
	}
}

/**
 * Create a verification runner with default configuration
 */
export function createVerificationRunner(workspacePath: string): VerificationRunner {
	return new VerificationRunner(workspacePath)
}