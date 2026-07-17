import * as vscode from "vscode"

import type { ExperimentId, RooCodeSettings } from "@roo-code/types"

import { changeLanguage } from "../../i18n"
import { Package } from "../../shared/package"
import { experimentDefault } from "../../shared/experiments"
import { Terminal } from "../../integrations/terminal/Terminal"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { setTtsEnabled, setTtsSpeed } from "../../utils/tts"
import { exportSettings, importSettingsWithFeedback } from "../config/importExport"
import type { WebviewHandlerContext } from "./ports"

/**
 * Handle general settings persistence and settings import/export.
 *
 * 通用设置持久化与导入导出处理器；先收敛副作用边界，再逐步细化端口接口。
 */
export async function handleSettingsMessage(context: WebviewHandlerContext): Promise<boolean> {
	const { provider, message } = context

	if (message.type === "updateSettings") {
		if (message.updatedSettings) {
			for (const [key, value] of Object.entries(message.updatedSettings)) {
				let newValue = value

				if (key === "language") {
					newValue = value ?? "en"
					changeLanguage(newValue as Parameters<typeof changeLanguage>[0])
				} else if (key === "allowedCommands" || key === "deniedCommands") {
					newValue = Array.isArray(value)
						? value.filter((command) => typeof command === "string" && command.trim().length > 0)
						: []
					await vscode.workspace
						.getConfiguration(Package.name)
						.update(key, newValue, vscode.ConfigurationTarget.Global)
				} else if (key === "ttsEnabled") {
					newValue = value ?? true
					setTtsEnabled(newValue as boolean)
				} else if (key === "ttsSpeed") {
					newValue = value ?? 1.0
					setTtsSpeed(newValue as number)
				} else if (value !== undefined) {
					applyTerminalSetting(key, value)
					if (key === "terminalProfile") {
						newValue = Terminal.getTerminalProfile()
					}
					if (key === "mcpEnabled") {
						newValue = value ?? true
						await provider.getMcpHub()?.handleMcpEnabledChange(newValue as boolean)
					}
					if (key === "experiments") {
						newValue = {
							...(context.getGlobalState("experiments") ?? experimentDefault),
							...(value as Record<ExperimentId, boolean>),
						}
					}
					if (key === "customSupportPrompts" && !value) {
						continue
					}
				}

				await context.setSetting(key as keyof RooCodeSettings, newValue)
			}
			await context.postWebviewState()
		}
		return true
	}

	if (message.type === "importSettings") {
		await importSettingsWithFeedback({
			providerSettingsManager: provider.providerSettingsManager,
			contextProxy: provider.contextProxy,
			customModesManager: provider.customModesManager,
			provider,
		})
		return true
	}

	if (message.type === "exportSettings") {
		await exportSettings({
			providerSettingsManager: provider.providerSettingsManager,
			contextProxy: provider.contextProxy,
		})
		return true
	}

	return false
}

function applyTerminalSetting(key: string, value: unknown): void {
	switch (key) {
		case "terminalShellIntegrationTimeout":
			Terminal.setShellIntegrationTimeout(value as number)
			break
		case "terminalShellIntegrationDisabled":
			Terminal.setShellIntegrationDisabled(value as boolean)
			break
		case "terminalCommandDelay":
			Terminal.setCommandDelay(value as number)
			break
		case "terminalPowershellCounter":
			Terminal.setPowershellCounter(value as boolean)
			break
		case "terminalZshClearEolMark":
			Terminal.setTerminalZshClearEolMark(value as boolean)
			break
		case "terminalZshOhMy":
			Terminal.setTerminalZshOhMy(value as boolean)
			break
		case "terminalZshP10k":
			Terminal.setTerminalZshP10k(value as boolean)
			break
		case "terminalZdotdir":
			Terminal.setTerminalZdotdir(value as boolean)
			break
		case "terminalProfile": {
			const previousProfile = Terminal.getTerminalProfile()
			Terminal.setTerminalProfile(typeof value === "string" ? value : undefined)
			if (Terminal.getTerminalProfile() !== previousProfile) {
				TerminalRegistry.closeIdleTerminals()
			}
			break
		}
		case "execaShellPath":
			Terminal.setExecaShellPath(value as string | undefined)
			break
	}
}
