import * as vscode from "vscode"

import { t } from "../../i18n"
import type { WebviewHandlerContext } from "./ports"

/**
 * Handle provider-profile lifecycle and profile-selection messages.
 *
 * Provider 配置档案的生命周期与选择消息处理器；保持旧协议行为不变，先隔离边界。
 */
export async function handleProfileMessage(context: WebviewHandlerContext): Promise<boolean> {
	const { provider, message } = context

	switch (message.type) {
		case "toggleApiConfigPin": {
			if (!message.text) return true
			const currentPinned = context.getGlobalState("pinnedApiConfigs") ?? {}
			const updatedPinned: Record<string, boolean> = { ...currentPinned }
			if (currentPinned[message.text]) delete updatedPinned[message.text]
			else updatedPinned[message.text] = true
			await context.updateGlobalState("pinnedApiConfigs", updatedPinned)
			await context.postWebviewState()
			return true
		}
		case "enhancementApiConfigId":
			await context.updateGlobalState("enhancementApiConfigId", message.text)
			await context.postWebviewState()
			return true
		case "saveApiConfiguration":
			if (message.text && message.apiConfiguration) {
				try {
					await provider.providerSettingsManager.saveConfig(message.text, message.apiConfiguration)
					await context.updateGlobalState(
						"listApiConfigMeta",
						await provider.providerSettingsManager.listConfig(),
					)
				} catch (error) {
					provider.log(`Error save api configuration: ${String(error)}`)
					vscode.window.showErrorMessage(t("common:errors.save_api_config"))
				}
			}
			return true
		case "upsertApiConfiguration":
			if (message.text && message.apiConfiguration) {
				await provider.upsertProviderProfile(message.text, message.apiConfiguration)
			}
			return true
		case "renameApiConfiguration":
			if (message.values && message.apiConfiguration) {
				try {
					const { oldName, newName } = message.values
					if (oldName !== newName) {
						const { id } = await provider.providerSettingsManager.getProfile({ name: oldName })
						await provider.providerSettingsManager.saveConfig(newName, { ...message.apiConfiguration, id })
						await provider.providerSettingsManager.deleteConfig(oldName)
						await provider.activateProviderProfile({ name: newName })
					}
				} catch (error) {
					provider.log(`Error rename api configuration: ${String(error)}`)
					vscode.window.showErrorMessage(t("common:errors.rename_api_config"))
				}
			}
			return true
		case "loadApiConfiguration":
			if (message.text) await activateProfile(provider, { name: message.text })
			return true
		case "loadApiConfigurationById":
			if (message.text) await activateProfile(provider, { id: message.text })
			return true
		case "deleteApiConfiguration":
			if (message.text) await deleteProfile(context, message.text)
			return true
		case "getListApiConfiguration":
			try {
				const listApiConfig = await provider.providerSettingsManager.listConfig()
				await context.updateGlobalState("listApiConfigMeta", listApiConfig)
				await context.postWebviewMessage({ type: "listApiConfig", listApiConfig })
			} catch (error) {
				provider.log(`Error get list api configuration: ${String(error)}`)
				vscode.window.showErrorMessage(t("common:errors.list_api_config"))
			}
			return true
		default:
			return false
	}
}

async function activateProfile(
	provider: WebviewHandlerContext["provider"],
	profile: { name: string } | { id: string },
) {
	try {
		await provider.activateProviderProfile(profile)
	} catch (error) {
		provider.log(`Error loading api configuration: ${String(error)}`)
		vscode.window.showErrorMessage(t("common:errors.load_api_config"))
	}
}

async function deleteProfile(context: WebviewHandlerContext, oldName: string): Promise<void> {
	const { provider } = context
	const answer = await vscode.window.showInformationMessage(
		t("common:confirmation.delete_config_profile"),
		{ modal: true },
		t("common:answers.yes"),
	)
	if (answer !== t("common:answers.yes")) return

	const newName = (await provider.providerSettingsManager.listConfig()).find(
		(config) => config.name !== oldName,
	)?.name
	if (!newName) {
		vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
		return
	}
	try {
		await provider.providerSettingsManager.deleteConfig(oldName)
		await provider.activateProviderProfile({ name: newName })
	} catch (error) {
		provider.log(`Error delete api configuration: ${String(error)}`)
		vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
	}
}
