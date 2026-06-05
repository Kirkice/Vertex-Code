import { ShadowCheckpointService } from "./ShadowCheckpointService";
import { CheckpointServiceOptions } from "./types";
/**
 * RepoPerTaskCheckpointService
 *
 * Each task gets its own shadow git repository.
 * This provides complete isolation between tasks and allows
 * concurrent checkpoint operations without conflicts.
 */
export declare class RepoPerTaskCheckpointService extends ShadowCheckpointService {
    private constructor();
    /**
     * Compute the checkpoints directory for a given task
     */
    static taskRepoDir(opts: {
        taskId: string;
        globalStorageDir: string;
    }): string;
    /**
     * Factory method to create a new checkpoint service instance
     */
    static create(options: CheckpointServiceOptions): RepoPerTaskCheckpointService;
}
//# sourceMappingURL=RepoPerTaskCheckpointService.d.ts.map