import { beforeEach, describe, expect, it, vi } from "vitest"

import * as vscode from "vscode"

import { handleProfileMessage } from "../profileMessageHandler"

vi.mock("../../../i18n", () => ({ t: (key: string) => key }))

const createContext = (message: unknown) => ({
	message,
	provider: {
		providerSettingsManager: {
			saveConfig: vi.fn(),
			listConfig: vi.fn(async () => [{ name: "primary" }, { name: "secondary" }]),
			getProfile: vi.fn(async () => ({ id: "profile-id" })),
			deleteConfig: vi.fn(),
		},
		upsertProviderProfile: vi.fn(),
		activateProviderProfile: vi.fn(),
		log: vi.fn(),
	},
	getGlobalState: vi.fn(() => ({ old: true })),
	updateGlobalState: vi.fn(),
	postWebviewState: vi.fn(),
	postWebviewMessage: vi.fn(),
})

describe("handleProfileMessage", () => {
	beforeEach(() => vi.clearAllMocks())

	it("toggles pinned profiles and updates state", async () => {
		const context = createContext({ type: "toggleApiConfigPin", text: "old" })
		await handleProfileMessage(context as never)
		expect(context.updateGlobalState).toHaveBeenCalledWith("pinnedApiConfigs", {})
		expect(context.postWebviewState).toHaveBeenCalledOnce()
	})

	it("upserts and activates profiles through the provider port", async () => {
		const context = createContext({
			type: "upsertApiConfiguration",
			text: "primary",
			apiConfiguration: { apiProvider: "openrouter" },
		})
		await handleProfileMessage(context as never)
		expect(context.provider.upsertProviderProfile).toHaveBeenCalledWith("primary", { apiProvider: "openrouter" })

		await handleProfileMessage(createContext({ type: "loadApiConfigurationById", text: "profile-id" }) as never)
		expect(context.provider.activateProviderProfile).not.toHaveBeenCalled()
	})

	it("confirms deletion and activates a remaining profile", async () => {
		vi.spyOn(vscode.window, "showInformationMessage").mockResolvedValue("common:answers.yes" as never)
		const context = createContext({ type: "deleteApiConfiguration", text: "old" })
		await handleProfileMessage(context as never)
		expect(context.provider.providerSettingsManager.deleteConfig).toHaveBeenCalledWith("old")
		expect(context.provider.activateProviderProfile).toHaveBeenCalledWith({ name: "primary" })
	})
})
