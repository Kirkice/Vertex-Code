import * as path from "path"
import { ShadowCheckpointService } from "./ShadowCheckpointService"
import { CheckpointServiceOptions } from "./types"

/**
 * RepoPerTaskCheckpointService
 * 
 * Each task gets its own shadow git repository.
 * This provides complete isolation between tasks and allows
 * concurrent checkpoint operations without conflicts.
 */
export class RepoPerTaskCheckpointService extends ShadowCheckpointService {
	private constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void) {
		super(taskId, checkpointsDir, workspaceDir, log)
	}

	/**
	 * Compute the checkpoints directory for a given task
	 */
	static taskRepoDir(opts: { taskId: string; globalStorageDir: string }): string {
		return path.join(opts.globalStorageDir, "tasks", opts.taskId, "checkpoints")
	}

	/**
	 * Factory method to create a new checkpoint service instance
	 */
	public static create(options: CheckpointServiceOptions): RepoPerTaskCheckpointService {
		const { taskId, workspaceDir, shadowDir, log = console.log } = options

		const checkpointsDir = RepoPerTaskCheckpointService.taskRepoDir({ taskId, globalStorageDir: shadowDir })

		return new RepoPerTaskCheckpointService(taskId, checkpointsDir, workspaceDir, log)
	}
}
