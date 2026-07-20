import { describe, expect, it } from "vitest"

import type { CheckpointTaskPort, TaskHistoryPort, TaskStatePort, WorktreeHostPort } from "../ports"

describe("webview ports", () => {
	it("documents the narrow capability contracts without runtime coupling", async () => {
		const task: CheckpointTaskPort = {
			checkpointDiff: async () => undefined,
			checkpointRestore: async () => undefined,
		}
		const worktree: WorktreeHostPort = {
			cwd: "workspace",
			contextProxy: {} as WorktreeHostPort["contextProxy"],
			log: () => undefined,
		}
		const history: TaskHistoryPort = {
			getCurrentTask: () => undefined,
			clearTask: async () => undefined,
			exportTaskWithId: async () => undefined,
			showTaskWithId: async () => undefined,
			condenseTaskContext: async () => undefined,
			deleteTaskWithId: async () => undefined,
			getTaskWithAggregatedCosts: async () => ({}),
			log: () => undefined,
		}
		const state: TaskStatePort = { getState: async () => ({}), log: () => undefined }

		expect(task).toBeDefined()
		expect(worktree.cwd).toBe("workspace")
		expect(history.getCurrentTask()).toBeUndefined()
		expect(await state.getState()).toEqual({})
	})
})
