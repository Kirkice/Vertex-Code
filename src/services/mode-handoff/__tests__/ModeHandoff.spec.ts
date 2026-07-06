import { describe, it, expect } from "vitest"

import type { ClineMessage, ModeHandoffSummary } from "@roo-code/types"

import {
	shouldCreateHandoff,
	isHandoffConsumed,
	determineTrigger,
} from "../ModeHandoffRules"
import { extractHandoffSummary } from "../ModeHandoffExtractor"
import { formatHandoffForInjection, formatHandoffForDisplay } from "../ModeHandoffFormatter"
import {
	createHandoff,
	getLatestPendingHandoff,
	consumePendingHandoff,
	handoffToMessage,
} from "../ModeHandoffService"
import type { ModeHandoffExtractInput } from "../ModeHandoffTypes"

const makeInput = (overrides: Partial<ModeHandoffExtractInput> = {}): ModeHandoffExtractInput => ({
	objective: "修复 bug",
	todos: [
		{ content: "已完成项", status: "completed" },
		{ content: "进行中项", status: "in_progress" },
		{ content: "待办项", status: "pending" },
	],
	recentAssistantTexts: ["assistant 结论 1"],
	touchedFiles: ["src/foo.ts"],
	modeConstraints: [],
	fromMode: "architect",
	toMode: "code",
	fromProfile: "gpt",
	toProfile: "qwen",
	trigger: "user_mode_switch",
	...overrides,
})

const makeHandoff = (overrides: Partial<ModeHandoffSummary> = {}): ModeHandoffSummary => ({
	handoffId: "test-id",
	createdAt: 1000,
	trigger: "user_mode_switch",
	fromMode: "architect",
	toMode: "code",
	fromProfile: "gpt",
	toProfile: "qwen",
	objective: "修复 bug",
	completed: ["已完成项"],
	inProgress: ["进行中项"],
	pending: ["待办项"],
	constraints: [],
	touchedFiles: ["src/foo.ts"],
	openQuestions: [],
	recommendedNextStep: "继续实现代码",
	...overrides,
})

describe("ModeHandoff - Rules", () => {
	describe("shouldCreateHandoff", () => {
		it("mode 变化时返回 true", () => {
			expect(shouldCreateHandoff({ fromMode: "code", toMode: "architect" })).toBe(true)
		})

		it("profile 变化时返回 true", () => {
			expect(shouldCreateHandoff({ fromMode: "code", toMode: "code", fromProfile: "a", toProfile: "b" })).toBe(true)
		})

		it("mode 和 profile 都不变时返回 false", () => {
			expect(shouldCreateHandoff({ fromMode: "code", toMode: "code", fromProfile: "a", toProfile: "a" })).toBe(false)
		})

		it("无 fromMode 和 fromProfile 时返回 false（首次切换前）", () => {
			expect(shouldCreateHandoff({ toMode: "code", toProfile: "a" })).toBe(false)
		})
	})

	describe("isHandoffConsumed", () => {
		it("consumedAt 未设置时返回 false", () => {
			expect(isHandoffConsumed({})).toBe(false)
		})

		it("consumedAt 已设置时返回 true", () => {
			expect(isHandoffConsumed({ consumedAt: 1234 })).toBe(true)
		})
	})

	describe("determineTrigger", () => {
		it("优先使用 explicitTrigger", () => {
			expect(
				determineTrigger({
					fromMode: "code",
					toMode: "architect",
					explicitTrigger: "orchestrator_stage",
				}),
			).toBe("orchestrator_stage")
		})

		it("未指定 explicitTrigger 时按 mode 变化推导", () => {
			expect(determineTrigger({ fromMode: "code", toMode: "architect" })).toBe("user_mode_switch")
		})

		it("未指定 explicitTrigger 且仅 profile 变化时推导为 profile_only_switch", () => {
			expect(
				determineTrigger({ fromMode: "code", toMode: "code", fromProfile: "a", toProfile: "b" }),
			).toBe("profile_only_switch")
		})
	})
})

describe("ModeHandoff - Extractor", () => {
	it("从 todo 提取 completed/inProgress/pending", () => {
		const result = extractHandoffSummary(makeInput())
		expect(result.completed).toEqual(["已完成项"])
		expect(result.inProgress).toEqual(["进行中项"])
		expect(result.pending).toEqual(["待办项"])
	})

	it("无 todo 时从 assistant 文本兜底提取 completed", () => {
		const result = extractHandoffSummary(makeInput({ todos: [] }))
		expect(result.completed.length).toBeGreaterThan(0)
		expect(result.completed[0]).toContain("assistant 结论")
	})

	it("透传 explicitTrigger", () => {
		const result = extractHandoffSummary(makeInput({ trigger: "orchestrator_stage" }))
		expect(result.trigger).toBe("orchestrator_stage")
	})

	it("生成 handoffId 和 createdAt", () => {
		const result = extractHandoffSummary(makeInput())
		expect(result.handoffId).toBeTruthy()
		expect(result.createdAt).toBeGreaterThan(0)
	})

	it("根据 toMode 生成 recommendedNextStep", () => {
		const result = extractHandoffSummary(makeInput({ toMode: "code", todos: [] }))
		expect(result.recommendedNextStep).toContain("代码")
	})
})

describe("ModeHandoff - Formatter", () => {
	it("formatHandoffForInjection 生成 XML 块", () => {
		const result = formatHandoffForInjection(makeHandoff())
		expect(result.text).toContain("<mode_handoff>")
		expect(result.text).toContain("</mode_handoff>")
		expect(result.text).toContain("from_mode: architect")
		expect(result.text).toContain("to_mode: code")
		expect(result.text).toContain("objective: 修复 bug")
		expect(result.handoffId).toBe("test-id")
	})

	it("formatHandoffForDisplay 生成可读文本", () => {
		const result = formatHandoffForDisplay(makeHandoff())
		expect(result).toContain("Mode Handoff")
		expect(result).toContain("architect")
		expect(result).toContain("code")
	})
})

describe("ModeHandoff - Service", () => {
	describe("createHandoff", () => {
		it("应该生成时返回 handoff", () => {
			const result = createHandoff(makeInput())
			expect(result).toBeDefined()
			expect(result!.toMode).toBe("code")
		})

		it("不应该生成时返回 undefined", () => {
			const result = createHandoff(makeInput({ fromMode: "code", toMode: "code", fromProfile: "a", toProfile: "a" }))
			expect(result).toBeUndefined()
		})
	})

	describe("getLatestPendingHandoff", () => {
		it("返回最新未消费的 handoff", () => {
			const messages: ClineMessage[] = [
				handoffToMessage(makeHandoff({ handoffId: "old", consumedAt: 500 })),
				handoffToMessage(makeHandoff({ handoffId: "new" })),
			]
			const result = getLatestPendingHandoff(messages)
			expect(result?.handoffId).toBe("new")
		})

		it("无 handoff 时返回 undefined", () => {
			expect(getLatestPendingHandoff([])).toBeUndefined()
		})

		it("最新 handoff 已消费时返回 undefined", () => {
			const messages: ClineMessage[] = [
				handoffToMessage(makeHandoff({ consumedAt: 1000 })),
			]
			expect(getLatestPendingHandoff(messages)).toBeUndefined()
		})
	})

	describe("consumePendingHandoff", () => {
		it("返回注入文本块并标记 consumedAt", () => {
			const messages: ClineMessage[] = [handoffToMessage(makeHandoff())]
			const result = consumePendingHandoff(messages)
			expect(result).toBeDefined()
			expect(result!.text).toContain("<mode_handoff>")
			// 验证 consumedAt 已标记
			expect(messages[0]?.modeHandoff?.consumedAt).toBeDefined()
		})

		it("无 pending handoff 时返回 undefined", () => {
			expect(consumePendingHandoff([])).toBeUndefined()
		})

		it("已消费的 handoff 不会被再次消费", () => {
			const messages: ClineMessage[] = [
				handoffToMessage(makeHandoff({ consumedAt: 1000 })),
			]
			const result = consumePendingHandoff(messages)
			expect(result).toBeUndefined()
		})
	})

	describe("handoffToMessage", () => {
		it("生成 say: mode_handoff 的 ClineMessage", () => {
			const msg = handoffToMessage(makeHandoff())
			expect(msg.type).toBe("say")
			expect(msg.say).toBe("mode_handoff")
			expect(msg.modeHandoff).toBeDefined()
			expect(msg.modeHandoff?.handoffId).toBe("test-id")
		})
	})
})
