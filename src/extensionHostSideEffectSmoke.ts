import fs from "fs/promises"
import path from "path"

import type { ToolResponse, ToolUse } from "./shared/tools"
import { ClineProvider } from "./core/webview/ClineProvider"
import type { Task } from "./core/task/Task"

export interface ExtensionHostSideEffectSmokeReport {
	workspacePath: string
	fileWrite: { path: string; content: string }
	command: { output: string }
	mcp: { output: string }
	checkpoint: { initialized: boolean; enabled: boolean }
	subtask: { parentTaskId: string; childTaskId: string; created: boolean }
}

type SmokeCallbacks = {
	results: ToolResponse[]
	errors: string[]
}

const callbacks = (): SmokeCallbacks => ({ results: [], errors: [] })

function makeToolCallbacks(state: SmokeCallbacks) {
	return {
		askApproval: async () => true,
		askFinishSubTaskApproval: async () => true,
		toolDescription: () => "extension host smoke test",
		checkpointSaveAndMark: async () => undefined,
		callbacks: {
			askApproval: async () => true,
			askFinishSubTaskApproval: async () => true,
			handleError: async (action: string, error: Error) => {
				state.errors.push(`${action}: ${error.message}`)
			},
			pushToolResult: (result: ToolResponse) => state.results.push(result),
		},
	}
}

function assertSmoke(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(`[extension-host-smoke] ${message}`)
	}
}

async function waitForProvider(): Promise<ClineProvider> {
	const deadline = Date.now() + 30_000
	while (Date.now() < deadline) {
		const provider = ClineProvider.getAllInstances()[0]
		if (provider) {
			return provider
		}
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	throw new Error("ClineProvider was not created during extension activation")
}

async function waitForMcpHub(provider: ClineProvider) {
	const deadline = Date.now() + 30_000
	while (Date.now() < deadline) {
		const hub = provider.getMcpHub()
		if (hub) {
			await hub.waitUntilReady()
			return hub
		}
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	throw new Error("MCP hub was not initialized during extension activation")
}

async function runTool(task: Task, block: ToolUse, state: SmokeCallbacks, checkpointSaveAndMark = false) {
	const toolCallbacks = makeToolCallbacks(state)
	await task.executeNativeToolThroughRuntime({
		task,
		block,
		stateExperiments: { customTools: false },
		mode: "code",
		askFinishSubTaskApproval: toolCallbacks.askFinishSubTaskApproval,
		toolDescription: toolCallbacks.toolDescription,
		checkpointSaveAndMark: checkpointSaveAndMark
			? async () => {
					await task.checkpointSave(true, true)
				}
			: toolCallbacks.checkpointSaveAndMark,
		callbacks: toolCallbacks.callbacks,
	})
	assertSmoke(state.errors.length === 0, state.errors.join("; "))
	assertSmoke(state.results.length > 0, `tool ${block.name} returned no result`)
	return state.results.at(-1)
}

/**
 * Runs side-effecting production paths inside the VS Code Extension Host.
 * This is intentionally not registered as a normal user command; extension.ts
 * exposes it only when VERTEX_EXTENSION_HOST_SMOKE=1 is set by the test runner.
 */
export async function runExtensionHostSideEffectSmoke(): Promise<ExtensionHostSideEffectSmokeReport> {
	const provider = await waitForProvider()
	const hub = await waitForMcpHub(provider)
	const task = await provider.createTask(
		"Extension Host side-effect smoke task",
		undefined,
		undefined,
		{ startTask: false },
		{
			experiments: { preventFocusDisruption: true },
			writeDelayMs: 0,
			diagnosticsEnabled: false,
			terminalShellIntegrationDisabled: true,
		} as any,
	)

	const smokeState = callbacks()
	const filePath = "extension-host-smoke/side-effect.txt"
	const fileContent = `extension-host-file-write:${Date.now()}`
	await runTool(
		task,
		{
			type: "tool_use",
			id: "extension-host-write",
			name: "write_to_file",
			params: {},
			partial: false,
			nativeArgs: { path: filePath, content: fileContent },
		} as ToolUse,
		smokeState,
		true,
	)
	const absoluteFilePath = path.join(task.cwd, filePath)
	const writtenContent = await fs.readFile(absoluteFilePath, "utf8")
	assertSmoke(writtenContent === fileContent, `file write mismatch at ${absoluteFilePath}`)

	const commandState = callbacks()
	await runTool(
		task,
		{
			type: "tool_use",
			id: "extension-host-command",
			name: "execute_command",
			params: {},
			partial: false,
			nativeArgs: { command: "node -e \"process.stdout.write('extension-host-command-ok')\"" },
		} as ToolUse,
		commandState,
	)
	const commandOutput = commandState.results.map(String).join("\n")
	assertSmoke(commandOutput.includes("extension-host-command-ok"), "command output marker was not returned")

	const mcpState = callbacks()
	await runTool(
		task,
		{
			type: "tool_use",
			id: "extension-host-mcp",
			name: "use_mcp_tool",
			params: {},
			partial: false,
			nativeArgs: { server_name: "host-smoke", tool_name: "echo", arguments: { value: "mcp-ok" } },
		} as ToolUse,
		mcpState,
	)
	const mcpOutput = mcpState.results.map(String).join("\n")
	assertSmoke(mcpOutput.includes("mcp-ok"), "MCP tool result marker was not returned")
	assertSmoke(
		hub.getAllServers().some((server) => server.name === "host-smoke"),
		"smoke MCP server was not connected",
	)

	await task.checkpointSave(true, true)
	assertSmoke(task.enableCheckpoints, "checkpoints were disabled by the production service")
	assertSmoke(!!task.checkpointService?.isInitialized, "checkpoint service did not initialize")

	const parentTaskId = task.taskId
	const child = await task.startSubtask("Extension Host child task", [], "code")
	assertSmoke(child.parentTaskId === parentTaskId, "child task parent linkage is incorrect")
	const childTaskId = child.taskId
	await provider.removeClineFromStack({ skipDelegationRepair: true })

	return {
		workspacePath: task.cwd,
		fileWrite: { path: absoluteFilePath, content: writtenContent },
		command: { output: commandOutput },
		mcp: { output: mcpOutput },
		checkpoint: { initialized: !!task.checkpointService?.isInitialized, enabled: task.enableCheckpoints },
		subtask: { parentTaskId, childTaskId, created: true },
	}
}
