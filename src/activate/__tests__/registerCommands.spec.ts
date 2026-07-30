import * as vscode from "vscode"

import { getCommandsMap } from "../registerCommands"
import { CodeIndexManager } from "../../services/code-index/manager"

vi.mock("../../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn(),
	},
}))

vi.mock("../../core/webview/ClineProvider", () => ({
	ClineProvider: {
		getVisibleInstance: vi.fn(),
	},
}))

vi.mock("../../core/config/importExport", () => ({
	importSettingsWithFeedback: vi.fn(),
}))

vi.mock("../handleTask", () => ({
	handleNewTask: vi.fn(),
}))

describe("RAG command handlers", () => {
	const context = { subscriptions: [] } as unknown as vscode.ExtensionContext
	const outputChannel = { appendLine: vi.fn() } as unknown as vscode.OutputChannel
	const provider = {} as any

	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue(undefined)
		vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined)
		vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined)
	})

	it.each(["ragRebuild", "ragClear", "ragStatus"] as const)(
		"warns when %s has no workspace manager",
		async (command) => {
			vi.mocked(CodeIndexManager.getInstance).mockReturnValue(undefined)
			const commands = getCommandsMap({ context, outputChannel, provider })

			await commands[command]()

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
				"RAG index is not available for this workspace.",
			)
		},
	)

	it("rebuilds RAG and reports background progress", async () => {
		const manager = { rebuildRag: vi.fn().mockResolvedValue(undefined) }
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(manager as any)
		const commands = getCommandsMap({ context, outputChannel, provider })

		await commands.ragRebuild()

		expect(manager.rebuildRag).toHaveBeenCalledOnce()
		expect(outputChannel.appendLine).toHaveBeenNthCalledWith(1, "[RAG] Rebuilding index...")
		expect(outputChannel.appendLine).toHaveBeenNthCalledWith(2, "[RAG] Rebuild started.")
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			"RAG: Rebuilding index in the background.",
		)
	})

	it("reports rebuild failures", async () => {
		const manager = { rebuildRag: vi.fn().mockRejectedValue(new Error("rebuild unavailable")) }
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(manager as any)
		const commands = getCommandsMap({ context, outputChannel, provider })

		await commands.ragRebuild()

		expect(outputChannel.appendLine).toHaveBeenCalledWith("[RAG] Rebuild failed: Error: rebuild unavailable")
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
			"RAG rebuild failed: Error: rebuild unavailable",
		)
	})

	it("clears RAG and reports completion", async () => {
		const manager = { clearRagData: vi.fn().mockResolvedValue(undefined) }
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(manager as any)
		const commands = getCommandsMap({ context, outputChannel, provider })

		await commands.ragClear()

		expect(manager.clearRagData).toHaveBeenCalledOnce()
		expect(outputChannel.appendLine).toHaveBeenNthCalledWith(1, "[RAG] Clearing index data...")
		expect(outputChannel.appendLine).toHaveBeenNthCalledWith(2, "[RAG] Index cleared.")
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("RAG: Index cleared.")
	})

	it("reports clear failures", async () => {
		const manager = { clearRagData: vi.fn().mockRejectedValue(new Error("clear unavailable")) }
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(manager as any)
		const commands = getCommandsMap({ context, outputChannel, provider })

		await commands.ragClear()

		expect(outputChannel.appendLine).toHaveBeenCalledWith("[RAG] Clear failed: Error: clear unavailable")
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("RAG clear failed: Error: clear unavailable")
	})

	it("formats and returns RAG status", () => {
		const status = { enabled: true, running: true, workspacePath: "C:\\workspace" }
		const manager = { getRagStatus: vi.fn().mockReturnValue(status) }
		vi.mocked(CodeIndexManager.getInstance).mockReturnValue(manager as any)
		const commands = getCommandsMap({ context, outputChannel, provider })

		const result = commands.ragStatus()

		expect(result).toEqual(status)
		expect(outputChannel.appendLine).toHaveBeenCalledWith(
			"[RAG] RAG: enabled | indexing | C:\\workspace",
		)
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			"RAG: enabled | indexing | C:\\workspace",
		)
	})
})
