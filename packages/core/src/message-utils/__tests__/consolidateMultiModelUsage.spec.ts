// npx vitest run packages/core/src/message-utils/__tests__/consolidateMultiModelUsage.spec.ts

import { describe, it, expect } from "vitest"

import type { ClineMessage, UsageBreakdownItem } from "@roo-code/types"

import { consolidateMultiModelUsage } from "../consolidateTokenUsage.js"

// 构造 api_req_started 消息的辅助函数
const makeApiReqStarted = (
	ts: number,
	parsed: { tokensIn?: number; tokensOut?: number; cost?: number; apiProtocol?: string },
	attribution?: { modeAtRequest?: string; providerProfileAtRequest?: string; modelId?: string },
): ClineMessage => ({
	ts,
	type: "say",
	say: "api_req_started",
	text: JSON.stringify(parsed),
	...attribution,
})

describe("consolidateMultiModelUsage", () => {
	it("空消息数组返回零值 total 和空 breakdown", () => {
		const result = consolidateMultiModelUsage([])
		expect(result.total.totalCost).toBe(0)
		expect(result.total.totalTokensIn).toBe(0)
		expect(result.total.totalTokensOut).toBe(0)
		expect(result.byMode).toEqual([])
		expect(result.byProfile).toEqual([])
		expect(result.currentEffectiveMode).toBeUndefined()
		expect(result.currentEffectiveProfile).toBeUndefined()
		expect(result.currentEffectiveModelId).toBeUndefined()
	})

	it("单条消息正确聚合 total 和 breakdown", () => {
		const messages: ClineMessage[] = [
			makeApiReqStarted(
				1000,
				{ tokensIn: 100, tokensOut: 50, cost: 0.01 },
				{ modeAtRequest: "code", providerProfileAtRequest: "qwen", modelId: "qwen-max" },
			),
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.total.totalTokensIn).toBe(100)
		expect(result.total.totalTokensOut).toBe(50)
		expect(result.total.totalCost).toBe(0.01)
		expect(result.byMode).toHaveLength(1)
		expect(result.byMode[0]).toMatchObject({
			mode: "code",
			requestCount: 1,
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 0.01,
		})
		expect(result.byProfile).toHaveLength(1)
		expect(result.byProfile[0]).toMatchObject({
			profile: "qwen",
			requestCount: 1,
		})
		expect(result.currentEffectiveMode).toBe("code")
		expect(result.currentEffectiveProfile).toBe("qwen")
		expect(result.currentEffectiveModelId).toBe("qwen-max")
	})

	it("多条消息按 Mode 聚合", () => {
		const messages: ClineMessage[] = [
			makeApiReqStarted(1000, { tokensIn: 100, tokensOut: 50, cost: 0.01 }, { modeAtRequest: "code" }),
			makeApiReqStarted(2000, { tokensIn: 200, tokensOut: 100, cost: 0.02 }, { modeAtRequest: "architect" }),
			makeApiReqStarted(3000, { tokensIn: 150, tokensOut: 75, cost: 0.015 }, { modeAtRequest: "code" }),
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.total.totalTokensIn).toBe(450)
		expect(result.total.totalCost).toBe(0.045)
		expect(result.byMode).toHaveLength(2)
		const codeMode = result.byMode.find((m: UsageBreakdownItem) => m.mode === "code")
		expect(codeMode).toMatchObject({
			requestCount: 2,
			tokensIn: 250,
			tokensOut: 125,
			totalCost: 0.025,
		})
		const architectMode = result.byMode.find((m: UsageBreakdownItem) => m.mode === "architect")
		expect(architectMode).toMatchObject({
			requestCount: 1,
			tokensIn: 200,
			totalCost: 0.02,
		})
	})

	it("多条消息按 Profile 聚合", () => {
		const messages: ClineMessage[] = [
			makeApiReqStarted(1000, { tokensIn: 100, cost: 0.01 }, { providerProfileAtRequest: "qwen" }),
			makeApiReqStarted(2000, { tokensIn: 200, cost: 0.02 }, { providerProfileAtRequest: "gpt" }),
			makeApiReqStarted(3000, { tokensIn: 150, cost: 0.015 }, { providerProfileAtRequest: "qwen" }),
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.byProfile).toHaveLength(2)
		const qwenProfile = result.byProfile.find((p: UsageBreakdownItem) => p.profile === "qwen")
		expect(qwenProfile).toMatchObject({
			requestCount: 2,
			tokensIn: 250,
			totalCost: 0.025,
		})
	})

	it("currentEffective 取最后一条 api_req_started 的归因", () => {
		const messages: ClineMessage[] = [
			makeApiReqStarted(1000, { tokensIn: 100 }, { modeAtRequest: "code", providerProfileAtRequest: "qwen", modelId: "qwen-max" }),
			makeApiReqStarted(2000, { tokensIn: 200 }, { modeAtRequest: "architect", providerProfileAtRequest: "gpt", modelId: "gpt-5.5" }),
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.currentEffectiveMode).toBe("architect")
		expect(result.currentEffectiveProfile).toBe("gpt")
		expect(result.currentEffectiveModelId).toBe("gpt-5.5")
	})

	it("无归因字段的历史消息归入 unknown 桶", () => {
		const messages: ClineMessage[] = [
			makeApiReqStarted(1000, { tokensIn: 100, cost: 0.01 }), // 无归因
			makeApiReqStarted(2000, { tokensIn: 200, cost: 0.02 }, { modeAtRequest: "code" }),
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.byMode).toHaveLength(2)
		const unknownMode = result.byMode.find((m: UsageBreakdownItem) => m.mode === "unknown")
		expect(unknownMode).toBeDefined()
		expect(unknownMode?.requestCount).toBe(1)
		expect(unknownMode?.tokensIn).toBe(100)
	})

	it("忽略非 api_req_started 消息", () => {
		const messages: ClineMessage[] = [
			{ ts: 1000, type: "say", say: "text", text: "hello" },
			makeApiReqStarted(2000, { tokensIn: 100, cost: 0.01 }, { modeAtRequest: "code" }),
			{ ts: 3000, type: "say", say: "api_req_finished", text: "done" },
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.total.totalTokensIn).toBe(100)
		expect(result.byMode).toHaveLength(1)
	})

	it("忽略 JSON 解析失败的消息", () => {
		const messages: ClineMessage[] = [
			{ ts: 1000, type: "say", say: "api_req_started", text: "invalid json" },
			makeApiReqStarted(2000, { tokensIn: 100, cost: 0.01 }, { modeAtRequest: "code" }),
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.total.totalTokensIn).toBe(100)
		expect(result.byMode).toHaveLength(1)
	})

	it("byMode 按成本降序排列（调用方排序）", () => {
		const messages: ClineMessage[] = [
			makeApiReqStarted(1000, { cost: 0.01 }, { modeAtRequest: "cheap" }),
			makeApiReqStarted(2000, { cost: 0.05 }, { modeAtRequest: "expensive" }),
			makeApiReqStarted(3000, { cost: 0.02 }, { modeAtRequest: "medium" }),
		]
		const result = consolidateMultiModelUsage(messages)
		// 原始 byMode 不保证顺序，但调用方（MultiModelUsageBreakdown）会排序
		// 这里验证所有 mode 都在
		expect(result.byMode).toHaveLength(3)
		const modes = result.byMode.map((m: UsageBreakdownItem) => m.mode)
		expect(modes).toContain("cheap")
		expect(modes).toContain("expensive")
		expect(modes).toContain("medium")
	})

	it("包含 condense_context 的成本", () => {
		const messages: ClineMessage[] = [
			makeApiReqStarted(1000, { tokensIn: 100, cost: 0.01 }, { modeAtRequest: "code" }),
			{
				ts: 2000,
				type: "say",
				say: "condense_context",
				contextCondense: { cost: 0.005, newContextTokens: 50 } as any,
			},
		]
		const result = consolidateMultiModelUsage(messages)
		expect(result.total.totalCost).toBe(0.015) // 0.01 + 0.005
	})
})
