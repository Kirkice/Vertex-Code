"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoPerTaskCheckpointService = void 0;
const path = __importStar(require("path"));
const ShadowCheckpointService_1 = require("./ShadowCheckpointService");
/**
 * RepoPerTaskCheckpointService
 *
 * Each task gets its own shadow git repository.
 * This provides complete isolation between tasks and allows
 * concurrent checkpoint operations without conflicts.
 */
class RepoPerTaskCheckpointService extends ShadowCheckpointService_1.ShadowCheckpointService {
    constructor(taskId, checkpointsDir, workspaceDir, log) {
        super(taskId, checkpointsDir, workspaceDir, log);
    }
    /**
     * Compute the checkpoints directory for a given task
     */
    static taskRepoDir(opts) {
        return path.join(opts.globalStorageDir, "tasks", opts.taskId, "checkpoints");
    }
    /**
     * Factory method to create a new checkpoint service instance
     */
    static create(options) {
        const { taskId, workspaceDir, shadowDir, log = console.log } = options;
        const checkpointsDir = RepoPerTaskCheckpointService.taskRepoDir({ taskId, globalStorageDir: shadowDir });
        return new RepoPerTaskCheckpointService(taskId, checkpointsDir, workspaceDir, log);
    }
}
exports.RepoPerTaskCheckpointService = RepoPerTaskCheckpointService;
//# sourceMappingURL=RepoPerTaskCheckpointService.js.map