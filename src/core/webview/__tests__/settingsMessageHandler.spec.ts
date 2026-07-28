import { beforeEach, describe, expect, it, vi } from "vitest"

import * as vscode from "vscode"

import { handleSettingsMessage } from "../settingsMessageHandler"

vi.mock("../../../i18n", () => ({ changeLanguage: vi.fn() }))
vi.mock("../../../utils/tts", () => ({ setTtsEnabled: vi.fn(), setTtsSpeed: vi.fn() }))
vi.mock("../../../integrations/terminal/Terminal", () => ({
	Terminal: {
		getTerminalProfile: vi.fn(() => "default"),
		setTerminalProfile: vi.fn(),
		setShellIntegrationTimeout: vi.fn(),
		setShellIntegrationDisabled: vi.fn(),
		setCommandDelay: vi.fn(),
		setPowershellCounter: vi.fn(),
		setTerminalZshClearEolMark: vi.fn(),
		setTerminalZshOhMy: vi.fn(),
		setTerminalZshP10k: vi.fn(),
		setTerminalZdotdir: vi.fn(),
		setExecaShellPath: vi.fn(),
	},
}))
vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: { closeIdleTerminals: vi.fn() },
}))
vi.mock("../../config/importExport", () => ({
	importSettingsWithFeedback: vi.fn(),
	exportSettings: vi.fn(),
}))

const createContext = (message: unknown) => ({
	message,
	provider: {
		contextProxy: {},
		customModesManager: {},
		providerSettingsManager: {},
		getMcpHub: vi.fn(() => ({ handleMcpEnabledChange: vi.fn() })),
	},
	mcp: {
		getMcpHub: vi.fn(() => ({ handleMcpEnabledChange: vi.fn() })),
	},
	getGlobalState: vi.fn(() => undefined),
	setSetting: vi.fn(),
	postWebviewState: vi.fn(),
	postWebviewMessage: vi.fn(),
})

describe("handleSettingsMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("sanitizes command lists and persists settings", async () => {
		const context = createContext({
			type: "updateSettings",
			updatedSettings: { allowedCommands: [" npm ", "", 42, "git"] },
		})

		await handleSettingsMessage(context as never)

		expect(context.setSetting).toHaveBeenCalledWith("allowedCommands", [" npm ", "git"])
		expect(context.postWebviewState).toHaveBeenCalledOnce()
	})

	it("updates MCP enabled state and ignores unsupported messages", async () => {
		const mcpChange = vi.fn()
		const context = createContext({ type: "updateSettings", updatedSettings: { mcpEnabled: false } })
		context.mcp.getMcpHub = vi.fn(() => ({ handleMcpEnabledChange: mcpChange }))

		expect(await handleSettingsMessage(context as never)).toBe(true)
		expect(mcpChange).toHaveBeenCalledWith(false)
		expect(await handleSettingsMessage(createContext({ type: "newTask" }) as never)).toBe(false)
	})

	it("routes settings import and export to their services", async () => {
		const importExport = await import("../../config/importExport")
		await handleSettingsMessage(createContext({ type: "importSettings" }) as never)
		await handleSettingsMessage(createContext({ type: "exportSettings" }) as never)
		expect(importExport.importSettingsWithFeedback).toHaveBeenCalledOnce()
		expect(importExport.exportSettings).toHaveBeenCalledOnce()
	})

	it("uses the configured VS Code global target for command settings", async () => {
		const update = vi.fn()
		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({ update } as never)
		await handleSettingsMessage(
			createContext({ type: "updateSettings", updatedSettings: { deniedCommands: ["rm"] } }) as never,
		)
		expect(update).toHaveBeenCalledWith("deniedCommands", ["rm"], vscode.ConfigurationTarget.Global)
	})

	it("closes idle terminals when the terminal profile changes", async () => {
		const { Terminal } = await import("../../../integrations/terminal/Terminal")
		const { TerminalRegistry } = await import("../../../integrations/terminal/TerminalRegistry")
		vi.mocked(Terminal.getTerminalProfile).mockReturnValueOnce("default").mockReturnValueOnce("bash")

		await handleSettingsMessage(
			createContext({ type: "updateSettings", updatedSettings: { terminalProfile: "bash" } }) as never,
		)

		expect(Terminal.setTerminalProfile).toHaveBeenCalledWith("bash")
		expect(TerminalRegistry.closeIdleTerminals).toHaveBeenCalledOnce()
	})

	it("does not close idle terminals when the terminal profile is unchanged", async () => {
		const { Terminal } = await import("../../../integrations/terminal/Terminal")
		const { TerminalRegistry } = await import("../../../integrations/terminal/TerminalRegistry")
		vi.mocked(Terminal.getTerminalProfile).mockReturnValue("default")

		await handleSettingsMessage(
			createContext({ type: "updateSettings", updatedSettings: { terminalProfile: "default" } }) as never,
		)

		expect(TerminalRegistry.closeIdleTerminals).not.toHaveBeenCalled()
	})
})
