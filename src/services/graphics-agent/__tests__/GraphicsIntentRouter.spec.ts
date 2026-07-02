/**
 * GraphicsIntentRouter Unit Tests
 *
 * @module graphics-agent/__tests__/GraphicsIntentRouter.spec.ts
 */

import { describe, it, expect } from "vitest"
import { detectGraphicsIntent, containsGraphicsKeywords } from "../GraphicsIntentRouter"

describe("GraphicsIntentRouter", () => {
	describe("detectGraphicsIntent", () => {
		it("should detect frame_summary intent from Chinese", () => {
			const result = detectGraphicsIntent("分析当前帧")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("frame_summary")
			expect(result.confidence).toBeGreaterThanOrEqual(0.8)
		})

		it("should detect frame_summary intent from English", () => {
			const result = detectGraphicsIntent("frame summary please")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("frame_summary")
		})

		it("should detect frame_performance intent", () => {
			const result = detectGraphicsIntent("为什么这一帧这么慢")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("frame_performance")
		})

		it("should detect selected_draw_explain intent", () => {
			const result = detectGraphicsIntent("解释当前 draw")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("selected_draw_explain")
		})

		it("should detect shader_analysis intent", () => {
			const result = detectGraphicsIntent("shader 分析")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("shader_analysis")
		})

		it("should detect pipeline_analysis intent", () => {
			const result = detectGraphicsIntent("pipeline 分析")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("pipeline_analysis")
		})

		it("should detect project_mapping intent", () => {
			const result = detectGraphicsIntent("对应哪段代码")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("project_mapping")
		})

		it("should detect regression_compare intent", () => {
			const result = detectGraphicsIntent("对比 capture")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("regression_compare")
		})

		it("should detect graphics_playbook intent with black screen", () => {
			const result = detectGraphicsIntent("黑屏排查")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("graphics_playbook")
			expect(result.playbookId).toBe("black_screen")
		})

		it("should detect graphics_playbook intent with GPU slow", () => {
			const result = detectGraphicsIntent("gpu slow")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.intent).toBe("graphics_playbook")
			expect(result.playbookId).toBe("gpu_slow")
		})

		it("should not detect graphics intent for unrelated messages", () => {
			const result = detectGraphicsIntent("帮我写一个 React 组件")
			expect(result.isGraphicsIntent).toBe(false)
			expect(result.confidence).toBe(0)
		})

		it("should not detect graphics intent for empty messages", () => {
			const result = detectGraphicsIntent("")
			expect(result.isGraphicsIntent).toBe(false)
		})

		it("should suggest mode switch when not in graphics mode", () => {
			const result = detectGraphicsIntent("分析当前帧", "code")
			expect(result.suggestModeSwitch).toBe(true)
		})

		it("should not suggest mode switch when already in graphics mode", () => {
			const result = detectGraphicsIntent("分析当前帧", "graphics")
			expect(result.suggestModeSwitch).toBe(false)
		})

		it("should detect low-confidence graphics intent from single keyword", () => {
			const result = detectGraphicsIntent("看看这个 shader")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.confidence).toBeLessThanOrEqual(0.5)
		})

		it("should detect medium-confidence from multiple keywords", () => {
			const result = detectGraphicsIntent("capture 里的 draw call 很慢")
			expect(result.isGraphicsIntent).toBe(true)
			expect(result.confidence).toBeGreaterThanOrEqual(0.4)
		})
	})

	describe("containsGraphicsKeywords", () => {
		it("should return true for messages with graphics keywords", () => {
			expect(containsGraphicsKeywords("这个 shader 很慢")).toBe(true)
			expect(containsGraphicsKeywords("frame analysis")).toBe(true)
			expect(containsGraphicsKeywords("黑屏问题")).toBe(true)
		})

		it("should return false for messages without graphics keywords", () => {
			expect(containsGraphicsKeywords("帮我写一个函数")).toBe(false)
			expect(containsGraphicsKeywords("hello world")).toBe(false)
		})

		it("should be case insensitive", () => {
			expect(containsGraphicsKeywords("SHADER analysis")).toBe(true)
			expect(containsGraphicsKeywords("Shader")).toBe(true)
		})
	})
})
