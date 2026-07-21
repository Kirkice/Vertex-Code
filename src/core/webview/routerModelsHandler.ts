import { getVsCodeLmModels } from "../../api/providers/vscode-lm"
import { getOpenAiModels } from "../../api/providers/openai"
import { flushModels, getModels } from "../../api/providers/fetchers/modelCache"
import { getLMStudioModels } from "../../api/providers/fetchers/lmstudio"
import { getRouterRemovalMessage } from "../config/routerRemoval"
import { toRouterName } from "../../shared/api"
import type { GetModelsOptions, RouterName } from "../../shared/api"
import type { ModelRecord, RouterModels } from "@roo-code/types"

import type { WebviewHandlerContext } from "./ports"

/**
 * Handle aggregated router-model requests.
 *
 * 说明 / Notes:
 * - This module isolates provider/model-fetch orchestration from the monolithic
 *   [`webviewMessageHandler()`](src/core/webview/webviewMessageHandler.ts:98).
 * - 该模块把“模型拉取编排”从超大消息路由器中拆出，作为第一阶段边界收敛。
 */
export async function handleRouterModelsRequest(context: WebviewHandlerContext): Promise<void> {
	const { provider, message } = context
	const { apiConfiguration } = await provider.getState()

	const requestedProvider = message?.values?.provider
	const providerFilter = requestedProvider ? toRouterName(requestedProvider) : undefined
	const shouldRefresh = message?.values?.refresh === true

	const routerModels: Partial<RouterModels> = providerFilter
		? {}
		: {
				openrouter: {},
				"vercel-ai-gateway": {},
				"vertex-gateway": {},
				litellm: {},
				requesty: {},
				unbound: {},
				ollama: {},
				lmstudio: {},
				poe: {},
				deepseek: {},
				"opencode-go": {},
			}

	const safeGetModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
		try {
			return await getModels(options)
		} catch (error) {
			console.error(`Failed to fetch models for ${options.provider}:`, error)
			throw error
		}
	}

	const candidates: { key: RouterName; options: GetModelsOptions }[] = [
		{ key: "openrouter", options: { provider: "openrouter" } },
		{
			key: "requesty",
			options: {
				provider: "requesty",
				apiKey: apiConfiguration.requestyApiKey,
				baseUrl: apiConfiguration.requestyBaseUrl,
			},
		},
		{
			key: "unbound",
			options: {
				provider: "unbound",
				apiKey: apiConfiguration.unboundApiKey,
			},
		},
		{ key: "vercel-ai-gateway", options: { provider: "vercel-ai-gateway" } },
		{
			key: "vertex-gateway",
			options: {
				provider: "vertex-gateway",
				baseUrl: apiConfiguration.vertexGatewayBaseUrl,
			},
		},
	]

	const litellmApiKey = apiConfiguration.litellmApiKey || message?.values?.litellmApiKey
	const litellmBaseUrl = apiConfiguration.litellmBaseUrl || message?.values?.litellmBaseUrl
	if (litellmApiKey && litellmBaseUrl) {
		if (message?.values?.litellmApiKey || message?.values?.litellmBaseUrl) {
			await flushModels({ provider: "litellm", apiKey: litellmApiKey, baseUrl: litellmBaseUrl }, true)
		}
		candidates.push({
			key: "litellm",
			options: { provider: "litellm", apiKey: litellmApiKey, baseUrl: litellmBaseUrl },
		})
	}

	const poeApiKey = apiConfiguration.poeApiKey || message?.values?.poeApiKey
	const poeBaseUrl = apiConfiguration.poeBaseUrl || message?.values?.poeBaseUrl
	if (poeApiKey) {
		if (message?.values?.poeApiKey || message?.values?.poeBaseUrl) {
			await flushModels({ provider: "poe", apiKey: poeApiKey, baseUrl: poeBaseUrl }, true)
		}
		candidates.push({ key: "poe", options: { provider: "poe", apiKey: poeApiKey, baseUrl: poeBaseUrl } })
	}

	const deepSeekApiKey = message?.values?.deepSeekApiKey ?? apiConfiguration.deepSeekApiKey
	const deepSeekBaseUrl = message?.values?.deepSeekBaseUrl ?? apiConfiguration.deepSeekBaseUrl
	if (deepSeekApiKey) {
		if (message?.values?.deepSeekApiKey || message?.values?.deepSeekBaseUrl) {
			await flushModels({ provider: "deepseek", apiKey: deepSeekApiKey, baseUrl: deepSeekBaseUrl }, true)
		}
		candidates.push({
			key: "deepseek",
			options: { provider: "deepseek", apiKey: deepSeekApiKey, baseUrl: deepSeekBaseUrl },
		})
	}

	const opencodeGoApiKey = message?.values?.opencodeGoApiKey ?? apiConfiguration.opencodeGoApiKey
	if (opencodeGoApiKey) {
		if (message?.values?.opencodeGoApiKey) {
			await flushModels({ provider: "opencode-go", apiKey: opencodeGoApiKey }, true)
		}
		candidates.push({ key: "opencode-go", options: { provider: "opencode-go", apiKey: opencodeGoApiKey } })
	}

	const modelFetchCandidates = providerFilter ? candidates.filter(({ key }) => key === providerFilter) : candidates
	if (shouldRefresh && providerFilter && modelFetchCandidates.length > 0) {
		await flushModels(modelFetchCandidates[0].options, true)
	}

	const results = await Promise.allSettled(
		modelFetchCandidates.map(async ({ key, options }) => ({ key, models: await safeGetModels(options) })),
	)

	results.forEach((result, index) => {
		const routerName = modelFetchCandidates[index].key
		if (result.status === "fulfilled") {
			routerModels[routerName] = result.value.models
			return
		}

		const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason)
		console.error(`Error fetching models for ${routerName}:`, result.reason)
		routerModels[routerName] = {}
		void context.postWebviewMessage({
			type: "singleRouterModelFetchResponse",
			success: false,
			error: errorMessage,
			values: { provider: routerName },
		})
	})

	await context.postWebviewMessage({
		type: "routerModels",
		routerModels: routerModels as RouterModels,
		values: providerFilter ? { provider: requestedProvider } : undefined,
	})
}

/**
 * Handle provider-specific model requests that remain separate in the UI contract.
 *
 * 这些请求保留独立消息类型，是为了兼容现有前端状态结构。
 */
export async function handleDedicatedModelRequest(context: WebviewHandlerContext): Promise<boolean> {
	const { provider, message } = context

	switch (message.type) {
		case "requestOllamaModels": {
			const { apiConfiguration } = await provider.getState()
			try {
				const options = {
					provider: "ollama" as const,
					baseUrl: apiConfiguration.ollamaBaseUrl,
					apiKey: apiConfiguration.ollamaApiKey,
				}
				await flushModels(options, true)
				const ollamaModels = await getModels(options)
				if (Object.keys(ollamaModels).length > 0) {
					await context.postWebviewMessage({ type: "ollamaModels", ollamaModels })
				}
			} catch (error) {
				console.debug("Ollama models fetch failed:", error)
			}
			return true
		}
		case "requestLmStudioModels": {
			const { apiConfiguration } = await provider.getState()
			try {
				const requestedBaseUrl = message.values?.baseUrl
				const lmStudioModels =
					typeof requestedBaseUrl === "string"
						? await getLMStudioModels(requestedBaseUrl)
						: await (async () => {
								const options = {
									provider: "lmstudio" as const,
									baseUrl: apiConfiguration.lmStudioBaseUrl,
								}
								await flushModels(options, true)
								return getModels(options)
							})()

				if (Object.keys(lmStudioModels).length > 0) {
					await context.postWebviewMessage({ type: "lmStudioModels", lmStudioModels })
				}
			} catch (error) {
				console.debug("LM Studio models fetch failed:", error)
			}
			return true
		}
		case "requestRooModels": {
			await context.postWebviewMessage({
				type: "singleRouterModelFetchResponse",
				success: false,
				error: getRouterRemovalMessage(),
				values: { provider: "roo" },
			})
			return true
		}
		case "requestOpenAiModels": {
			if (message?.values?.baseUrl && message?.values?.apiKey) {
				const openAiModels = await getOpenAiModels(
					message.values.baseUrl,
					message.values.apiKey,
					message.values.openAiHeaders,
				)
				await context.postWebviewMessage({ type: "openAiModels", openAiModels })
			}
			return true
		}
		case "requestVsCodeLmModels": {
			const vsCodeLmModels = await getVsCodeLmModels()
			await context.postWebviewMessage({ type: "vsCodeLmModels", vsCodeLmModels })
			return true
		}
		default:
			return false
	}
}
