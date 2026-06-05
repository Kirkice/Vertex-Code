/**
 * WorktreesService - Manages Git worktree settings
 * Ported from Zoo-Code with VertexAI naming
 */

export interface WorktreesConfig {
	showWorktreesInHomeScreen: boolean
}

export const DEFAULT_WORKTREES_CONFIG: WorktreesConfig = {
	showWorktreesInHomeScreen: true,
}

export class WorktreesService {
	private config: WorktreesConfig

	constructor(config?: Partial<WorktreesConfig>) {
		this.config = { ...DEFAULT_WORKTREES_CONFIG, ...config }
	}

	getConfig(): WorktreesConfig {
		return { ...this.config }
	}

	updateConfig(updates: Partial<WorktreesConfig>): void {
		this.config = { ...this.config, ...updates }
	}

	shouldShowInHomeScreen(): boolean {
		return this.config.showWorktreesInHomeScreen
	}
}