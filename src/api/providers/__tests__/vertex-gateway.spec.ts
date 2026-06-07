// npx vitest run src/api/providers/__tests__/vertex-gateway.spec.ts

const { showErrorMessage, openExternal } = vitest.hoisted(() => ({
	showErrorMessage: vitest.fn(async () => undefined as string | undefined),
	openExternal: vitest.fn(async () => true),
}))

vitest.mock("vscode", () => ({
	window: { showErrorMessage },
	env: { openExternal, uriScheme: "vscode", appName: "VS Code" },
	Uri: { parse: (value: string) => ({ toString: () => value }) },
}))

vitest.mock("../../../i18n", () => ({
	t: (key: string) => key,
}))

import OpenAI from "openai"

import { vertexGatewayDefaultModelId, VERTEX_GATEWAY_DEFAULT_TEMPERATURE } from "@roo-code/types"

import { VertexGatewayHandler, classifyGatewayApiError } from "../vertex-gateway"
import { ApiHandlerOptions } from "../../../shared/api"
import { Package } from "../../../shared/package"
import { clearVertexToken } from "../../../services/vertex-auth"

vitest.mock("openai")
vitest.mock("delay", () => ({ default: vitest.fn(() => Promise.resolve()) }))
vitest.mock("../fetchers/modelCache", () => ({
	getModels: vitest.fn().mockImplementation(() => {
		return Promise.resolve({
			"anthropic/claude-sonnet-4": {
				maxTokens: 64000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude Sonnet 4",
			},
			"anthropic/claude-3.5-haiku": {
				maxTokens: 32000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 1,
				outputPrice: 5,
				cacheWritesPrice: 1.25,
				cacheReadsPrice: 0.1,
				description: "Claude 3.5 Haiku",
			},
		})
	}),
	getModelsFromCache: vitest.fn().mockReturnValue(undefined),
}))

const mockGetCachedVertexToken = vitest.hoisted(() => vitest.fn<() => string | undefined>(() => undefined))
const mockSessionCleared = vitest.hoisted(() => ({ value: false }))

vitest.mock("../../../services/vertex-auth", () => ({
	getVertexBaseUrl: vitest.fn(() => "https://www.vertex.dev"),
	getCachedVertexToken: () => mockGetCachedVertexToken() ?? "",
	resolveVertexGatewaySessionToken: (profileToken?: string) => {
		const cached = mockGetCachedVertexToken()
		if (cached) return cached
		if (mockSessionCleared.value) return undefined
		return profileToken
	},
	clearVertexToken: vitest.fn(async () => {
		mockSessionCleared.value = true
		mockGetCachedVertexToken.mockReturnValue(undefined)
	}),
}))

vitest.mock("../../transform/caching/vercel-ai-gateway", () => ({
	addCacheBreakpoints: vitest.fn(),
}))

const mockCreate = vitest.fn()

function mockOpenAIClient() {
	vitest.mocked(OpenAI).mockImplementation(
		() =>
			({
				chat: {
					completions: {
						create: mockCreate,
					},
				},
			}) as unknown as OpenAI,
	)
}

mockOpenAIClient()

describe("VertexGatewayHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		vertexSessionToken: "vertex_ext_test_token",
		vertexGatewayModelId: "anthropic/claude-sonnet-4",
	}

	beforeEach(() => {
		vitest.clearAllMocks()
		mockSessionCleared.value = false
		mockGetCachedVertexToken.mockReturnValue(undefined)
		mockCreate.mockClear()
		showErrorMessage.mockReset()
		showErrorMessage.mockResolvedValue(undefined)
		openExternal.mockReset()
		openExternal.mockResolvedValue(true)
		mockOpenAIClient()
	})

	function makeApiError(status: number, options: { code?: string; message?: string } = {}) {
		const err = new Error(options.message ?? `HTTP ${status}`) as Error & {
			status: number
			code?: string
		}
		err.status = status
		if (options.code) err.code = options.code
		return err
	}

	async function drainCreateMessage(handler: VertexGatewayHandler) {
		const stream = handler.createMessage("system", [{ role: "user", content: "hi" }])
		const out: unknown[] = []
		for await (const chunk of stream) {
			out.push(chunk)
		}
		return out
	}

	describe("constructor", () => {
		it("allows construction without a session token (auth is enforced at request time)", () => {
			expect(() => new VertexGatewayHandler({})).not.toThrow()
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "not-provided",
				}),
			)
		})

		it("prefers the secret-storage cache over a persisted profile token", () => {
			mockGetCachedVertexToken.mockReturnValue("vertex_ext_cached_token")

			new VertexGatewayHandler({
				vertexSessionToken: "vertex_ext_stale_profile_token",
				vertexGatewayModelId: mockOptions.vertexGatewayModelId,
			})

			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "vertex_ext_cached_token",
				}),
			)
		})

		it("initializes OpenAI with Vertex enrichment headers and session token", () => {
			const handler = new VertexGatewayHandler({
				...mockOptions,
				vertexGatewayBaseUrl: "https://staging.vertex.dev/api/gateway/v1",
			})

			expect(handler).toBeInstanceOf(VertexGatewayHandler)
			expect(OpenAI).toHaveBeenCalledWith({
				baseURL: "https://staging.vertex.dev/api/gateway/v1",
				apiKey: mockOptions.vertexSessionToken,
				defaultHeaders: expect.objectContaining({
					"HTTP-Referer": "https://github.com/Kirkice/Vertex-Code",
					"X-Title": "Vertex",
					"X-Vertex-Editor": "vscode",
					"X-Vertex-Extension-Version": Package.version,
				}),
			})
		})

		it("defaults the gateway base URL from getVertexBaseUrl", () => {
			new VertexGatewayHandler(mockOptions)

			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://www.vertex.dev/api/gateway/v1",
				}),
			)
		})
	})

	describe("fetchModel", () => {
		it("returns configured model info", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result.id).toBe(mockOptions.vertexGatewayModelId)
			expect(result.info.maxTokens).toBe(64000)
			expect(result.info.supportsPromptCache).toBe(true)
		})

		it("falls back to the default model when none is configured", async () => {
			const handler = new VertexGatewayHandler({ vertexSessionToken: "vertex_ext_test_token" })
			const result = await handler.fetchModel()

			expect(result.id).toBe(vertexGatewayDefaultModelId)
		})
	})

	describe("createMessage", () => {
		it("requires authentication at request time when no session token is available", async () => {
			const handler = new VertexGatewayHandler({})
			await expect(drainCreateMessage(handler)).rejects.toThrow(
				"Vertex Gateway requires authentication. Please sign in to Vertex first.",
			)
		})

		beforeEach(() => {
			mockCreate.mockImplementation(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Test response" }, index: 0 }],
						usage: null,
					}
					yield {
						choices: [{ delta: {}, index: 0 }],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
							total_tokens: 15,
							cache_creation_input_tokens: 2,
							prompt_tokens_details: { cached_tokens: 3 },
							cost: 0.005,
						},
					}
				},
			}))
		})

		it("requires authentication at request time when no session token is available", async () => {
			const handler = new VertexGatewayHandler({})
			const stream = handler.createMessage("You are helpful.", [{ role: "user", content: "Hello" }])

			await expect(async () => {
				for await (const _chunk of stream) {
					// drain
				}
			}).rejects.toThrow("Vertex Gateway requires authentication. Please sign in to Vertex first.")
		})

		it("streams text and usage chunks", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			const stream = handler.createMessage("You are helpful.", [{ role: "user", content: "Hello" }])

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Test response" },
				{
					type: "usage",
					inputTokens: 10,
					outputTokens: 5,
					cacheWriteTokens: 2,
					cacheReadTokens: 3,
					totalCost: 0.005,
				},
			])
		})

		it("forwards task and mode metadata as request headers", async () => {
			const handler = new VertexGatewayHandler(mockOptions)

			await handler.createMessage("prompt", [], { taskId: "task-123", mode: "code" }).next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.any(Object),
				expect.objectContaining({
					headers: {
						"X-Vertex-Task-ID": "task-123",
						"X-Vertex-Mode": "code",
					},
				}),
			)
		})

		it("uses custom temperature when provided", async () => {
			const handler = new VertexGatewayHandler({
				...mockOptions,
				modelTemperature: 0.5,
			})

			await handler.createMessage("prompt", [{ role: "user", content: "Hi" }]).next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.5,
				}),
				expect.any(Object),
			)
		})

		it("uses the default temperature when none is provided", async () => {
			const handler = new VertexGatewayHandler(mockOptions)

			await handler.createMessage("prompt", [{ role: "user", content: "Hi" }]).next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: VERTEX_GATEWAY_DEFAULT_TEMPERATURE,
				}),
				expect.any(Object),
			)
		})

		it("adds cache breakpoints for supported models", async () => {
			const { addCacheBreakpoints } = await import("../../transform/caching/vercel-ai-gateway")
			const handler = new VertexGatewayHandler({
				...mockOptions,
				vertexGatewayModelId: "anthropic/claude-3.5-haiku",
			})

			await handler.createMessage("prompt", [{ role: "user", content: "Hi" }]).next()

			expect(addCacheBreakpoints).toHaveBeenCalled()
		})

		it("yields tool_call_partial chunks when streaming tool calls", async () => {
			mockCreate.mockImplementation(async () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [
							{
								delta: {
									tool_calls: [
										{
											index: 0,
											id: "call_123",
											function: { name: "test_tool", arguments: '{"arg1":' },
										},
									],
								},
								index: 0,
							},
						],
					}
				},
			}))

			const handler = new VertexGatewayHandler(mockOptions)
			const chunks = []
			for await (const chunk of handler.createMessage("prompt", [])) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{
					type: "tool_call_partial",
					index: 0,
					id: "call_123",
					name: "test_tool",
					arguments: '{"arg1":',
				},
			])
		})
	})

	describe("completePrompt", () => {
		beforeEach(() => {
			mockCreate.mockImplementation(async () => ({
				choices: [{ message: { role: "assistant", content: "Test completion response" } }],
			}))
		})

		it("returns completion text from the gateway", async () => {
			const handler = new VertexGatewayHandler(mockOptions)

			const result = await handler.completePrompt("Complete this: Hello")

			expect(result).toBe("Test completion response")
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "anthropic/claude-sonnet-4",
					messages: [{ role: "user", content: "Complete this: Hello" }],
					stream: false,
					temperature: VERTEX_GATEWAY_DEFAULT_TEMPERATURE,
					max_completion_tokens: 64000,
				}),
			)
		})

		it("wraps errors with a Vertex Gateway prefix", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw new Error("upstream failure")
			})

			await expect(handler.completePrompt("Test")).rejects.toThrow(
				"Vertex Gateway completion error: upstream failure",
			)
		})

		it("returns an empty string when the model returns no content", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(async () => ({
				choices: [{ message: { role: "assistant", content: null } }],
			}))

			await expect(handler.completePrompt("Test")).resolves.toBe("")
		})
	})

	describe("classifyGatewayApiError", () => {
		it("returns sign_in on 401", () => {
			expect(classifyGatewayApiError(makeApiError(401))).toEqual({ kind: "sign_in" })
		})

		it("returns add_credits (not budget) on 402", () => {
			expect(classifyGatewayApiError(makeApiError(402))).toEqual({ kind: "add_credits", budgetExceeded: false })
		})

		it("returns add_credits with budgetExceeded on 429 budget codes", () => {
			expect(classifyGatewayApiError(makeApiError(429, { code: "monthly_budget_exceeded" }))).toEqual({
				kind: "add_credits",
				budgetExceeded: true,
			})
			expect(classifyGatewayApiError(makeApiError(429, { code: "daily_budget_exceeded" }))).toEqual({
				kind: "add_credits",
				budgetExceeded: true,
			})
		})

		it("returns none on 429 without a budget code", () => {
			expect(classifyGatewayApiError(makeApiError(429, { code: "rate_limited" }))).toEqual({ kind: "none" })
		})

		it("returns contact_support on 403", () => {
			expect(classifyGatewayApiError(makeApiError(403))).toEqual({ kind: "contact_support" })
		})

		it("returns none for errors without an HTTP status", () => {
			expect(classifyGatewayApiError(new Error("network down"))).toEqual({ kind: "none" })
		})
	})

	describe("surfaceGatewayApiError", () => {
		it("clears the cached token and offers re-sign-in on 401", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw makeApiError(401)
			})
			showErrorMessage.mockResolvedValueOnce("common:vertexAuth.buttons.sign_in")

			await expect(drainCreateMessage(handler)).rejects.toThrow()
			expect(clearVertexToken).toHaveBeenCalledTimes(1)
			expect(showErrorMessage).toHaveBeenCalledWith(
				"common:vertexAuth.errors.session_expired",
				"common:vertexAuth.buttons.sign_in",
			)
			expect(openExternal).toHaveBeenCalledTimes(1)
		})

		it("does not open a URL on 401 when the user dismisses the prompt", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw makeApiError(401)
			})
			showErrorMessage.mockResolvedValueOnce(undefined)

			await expect(drainCreateMessage(handler)).rejects.toThrow()
			expect(clearVertexToken).toHaveBeenCalledTimes(1)
			expect(openExternal).not.toHaveBeenCalled()
		})

		it("prompts to add credits on 402", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw makeApiError(402)
			})
			showErrorMessage.mockResolvedValueOnce("common:vertexAuth.buttons.add_credits")

			await expect(drainCreateMessage(handler)).rejects.toThrow()
			expect(clearVertexToken).not.toHaveBeenCalled()
			expect(showErrorMessage).toHaveBeenCalledWith(
				"common:vertexAuth.errors.out_of_credits",
				"common:vertexAuth.buttons.add_credits",
			)
			expect(openExternal).toHaveBeenCalledTimes(1)
		})

		it("shows the budget message on 429 with a budget code", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw makeApiError(429, { code: "monthly_budget_exceeded" })
			})

			await expect(drainCreateMessage(handler)).rejects.toThrow()
			expect(showErrorMessage).toHaveBeenCalledWith(
				"common:vertexAuth.errors.budget_exceeded",
				"common:vertexAuth.buttons.add_credits",
			)
		})

		it("does not surface a notification on 429 without a budget code", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw makeApiError(429, { code: "rate_limited" })
			})

			await expect(drainCreateMessage(handler)).rejects.toThrow()
			expect(showErrorMessage).not.toHaveBeenCalled()
		})

		it("offers contact support on 403", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw makeApiError(403)
			})
			showErrorMessage.mockResolvedValueOnce("common:vertexAuth.buttons.contact_support")

			await expect(drainCreateMessage(handler)).rejects.toThrow()
			expect(showErrorMessage).toHaveBeenCalledWith(
				"common:vertexAuth.errors.account_unavailable",
				"common:vertexAuth.buttons.contact_support",
			)
			expect(openExternal).toHaveBeenCalledTimes(1)
		})

		it("ignores errors without an HTTP status", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw new Error("network down")
			})

			await expect(drainCreateMessage(handler)).rejects.toThrow("network down")
			expect(showErrorMessage).not.toHaveBeenCalled()
			expect(clearVertexToken).not.toHaveBeenCalled()
		})

		it("surfaces the gateway error then wraps the message in completePrompt", async () => {
			const handler = new VertexGatewayHandler(mockOptions)
			mockCreate.mockImplementation(() => {
				throw makeApiError(402, { message: "out of credits" })
			})

			await expect(handler.completePrompt("ping")).rejects.toThrow("Vertex Gateway completion error: out of credits")
			expect(showErrorMessage).toHaveBeenCalledWith(
				"common:vertexAuth.errors.out_of_credits",
				"common:vertexAuth.buttons.add_credits",
			)
		})
	})
})
