import { beforeEach, describe, expect, it, vi } from "vitest"

import { handleWorktreeCheckpointMessage } from "../worktreeCheckpointMessageHandler"

const worktree = vi.hoisted(() => ({
	handleListWorktrees: vi.fn(async () => ({ worktrees: [], currentWorktree: undefined })),
	handleCreateWorktree: vi.fn(async () => ({ success: true, message: "created" })),
	handleDeleteWorktree: vi.fn(async () => ({ success: true, message: "deleted" })),
	handleSwitchWorktree: vi.fn(async () => ({ success: true, message: "switched" })),
	handleGetAvailableBranches: vi.fn(async () => ({ branches: [] })),
	handleGetWorktreeDefaults: vi.fn(async () => ({ path: "", branch: "main" })),
	handleGetWorktreeIncludeStatus: vi.fn(async () => true),
	handleCheckBranchWorktreeInclude: vi.fn(async () => false),
	handleCreateWorktreeInclude: vi.fn(async () => ({ success: true, message: "saved" })),
	handleCheckoutBranch: vi.fn(async () => ({ success: true, message: "checked out" })),
}))
vi.mock("../worktree", () => worktree)
vi.mock("../checkpointRestoreHandler", () => ({ handleCheckpointRestoreOperation: vi.fn() }))

const createContext = (message: unknown) => ({
	message,
	provider: { getCurrentTask: vi.fn(() => undefined), cancelTask: vi.fn(), log: vi.fn() },
	postWebviewMessage: vi.fn(),
})

describe("handleWorktreeCheckpointMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("lists worktrees and posts the response", async () => {
		const context = createContext({ type: "listWorktrees" })
		await handleWorktreeCheckpointMessage(context as never)
		expect(worktree.handleListWorktrees).toHaveBeenCalledOnce()
		expect(context.postWebviewMessage).toHaveBeenCalledWith({
			type: "worktreeList",
			worktrees: [],
			currentWorktree: undefined,
		})
	})

	it("creates a worktree and emits the result", async () => {
		const context = createContext({ type: "createWorktree", worktreePath: "C:/worktree" })
		await handleWorktreeCheckpointMessage(context as never)
		expect(worktree.handleCreateWorktree).toHaveBeenCalled()
		expect(context.postWebviewMessage).toHaveBeenCalledWith({
			type: "worktreeResult",
			success: true,
			text: "created",
		})
	})

	it("returns false for messages outside its boundary", async () => {
		expect(await handleWorktreeCheckpointMessage(createContext({ type: "newTask" }) as never)).toBe(false)
	})

	it("rejects invalid checkpoint payloads without invoking the task", async () => {
		const context = createContext({ type: "checkpointRestore", payload: { invalid: true } })
		await handleWorktreeCheckpointMessage(context as never)
		expect(context.provider.cancelTask).not.toHaveBeenCalled()
		expect(context.provider.getCurrentTask).not.toHaveBeenCalled()
	})

	it("logs handler failures and consumes the message", async () => {
		worktree.handleListWorktrees.mockRejectedValueOnce(new Error("git failure"))
		const context = createContext({ type: "listWorktrees" })
		await handleWorktreeCheckpointMessage(context as never)
		expect(context.provider.log).toHaveBeenCalledWith(expect.stringContaining("git failure"))
	})
})
