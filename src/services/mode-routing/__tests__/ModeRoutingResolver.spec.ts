import { describe, it, expect } from "vitest"

import {
	resolveProfileForMode,
	resolveRoutingEnabled,
	shouldAutoSwitchProfile,
	describeRoutingSource,
} from "../ModeRoutingResolver"
import type { ResolveModeProfileInput } from "../ModeRoutingTypes"

// 构造测试输入的辅助函数
const baseInput = (overrides: Partial<ResolveModeProfileInput> = {}): ResolveModeProfileInput => ({
	mode: "code",
	...overrides,
})

describe("ModeRoutingResolver", () => {
	describe("resolveRoutingEnabled", () => {
		it("新开关 modeLevelLlmRoutingEnabled=true 时返回 true", () => {
			expect(resolveRoutingEnabled({ modeLevelLlmRoutingEnabled: true })).toBe(true)
		})

		it("新开关 modeLevelLlmRoutingEnabled=false 时返回 false", () => {
			expect(resolveRoutingEnabled({ modeLevelLlmRoutingEnabled: false })).toBe(false)
		})

		it("新开关未设置且 lockApiConfigAcrossModes=true 时返回 false（反义）", () => {
			expect(resolveRoutingEnabled({ lockApiConfigAcrossModes: true })).toBe(false)
		})

		it("新开关未设置且 lockApiConfigAcrossModes=false 时返回 true（反义）", () => {
			expect(resolveRoutingEnabled({ lockApiConfigAcrossModes: false })).toBe(true)
		})

		it("两个开关都未设置时返回 true（兼容现有默认：lockApiConfigAcrossModes 默认 false = 不锁定 = routing enabled）", () => {
			// 现有代码 lockApiConfigAcrossModes 默认 false（ClineProvider.ts:981），
			// 即默认不锁定 = 允许按 Mode 切换 profile。
			// 新开关未设置时回退到旧开关默认值的反义，保持行为一致。
			expect(resolveRoutingEnabled({})).toBe(true)
		})

		it("新开关优先于旧开关（新开关=true，旧开关=true 应返回 true）", () => {
			// 新开关优先，旧开关的反义被忽略
			expect(resolveRoutingEnabled({ modeLevelLlmRoutingEnabled: true, lockApiConfigAcrossModes: true })).toBe(true)
		})

		it("新开关优先于旧开关（新开关=false，旧开关=false 应返回 false）", () => {
			expect(resolveRoutingEnabled({ modeLevelLlmRoutingEnabled: false, lockApiConfigAcrossModes: false })).toBe(false)
		})
	})

	describe("resolveProfileForMode - routing disabled", () => {
		it("routing disabled 时总是走全局 profile，不应用 modeApiConfigs", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "architect",
					modeLevelLlmRoutingEnabled: false,
					modeApiConfigs: { architect: "architect-config-id" },
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("global-config")
			expect(result.source).toBe("global")
			expect(result.routingEnabled).toBe(false)
		})

		it("routing disabled 时 explicitProviderProfile 仍然优先", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					modeLevelLlmRoutingEnabled: false,
					explicitProviderProfile: "explicit-config",
					modeApiConfigs: { code: "code-config-id" },
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("explicit-config")
			expect(result.source).toBe("explicit")
		})

		it("routing disabled 时 task 级 sticky 优先于全局", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					modeLevelLlmRoutingEnabled: false,
					currentTaskApiConfigName: "task-config",
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("task-config")
			expect(result.source).toBe("task")
		})
	})

	describe("resolveProfileForMode - routing enabled", () => {
		it("routing enabled 时按 modeApiConfigs[mode] 走", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "architect",
					modeLevelLlmRoutingEnabled: true,
					modeApiConfigs: { architect: "architect-config-id", code: "code-config-id" },
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("architect-config-id")
			expect(result.source).toBe("mode-binding")
			expect(result.routingEnabled).toBe(true)
		})

		it("explicitProviderProfile 优先级最高，覆盖 mode-binding", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "architect",
					modeLevelLlmRoutingEnabled: true,
					explicitProviderProfile: "explicit-config",
					modeApiConfigs: { architect: "architect-config-id" },
				}),
			)
			expect(result.configId).toBe("explicit-config")
			expect(result.source).toBe("explicit")
		})

		it("mode 未配置时回退到 task 级 sticky", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "graphics",
					modeLevelLlmRoutingEnabled: true,
					modeApiConfigs: { code: "code-config-id", architect: "architect-config-id" },
					currentTaskApiConfigName: "task-config",
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("task-config")
			expect(result.source).toBe("task")
		})

		it("mode 未配置且无 task sticky 时回退到全局", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "graphics",
					modeLevelLlmRoutingEnabled: true,
					modeApiConfigs: { code: "code-config-id" },
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("global-config")
			expect(result.source).toBe("global")
		})

		it("modeApiConfigs 为空对象时回退到 task/global", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					modeLevelLlmRoutingEnabled: true,
					modeApiConfigs: {},
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("global-config")
			expect(result.source).toBe("global")
		})
	})

	describe("resolveProfileForMode - 无可用 profile", () => {
		it("所有来源都缺失时返回 source=none", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					modeLevelLlmRoutingEnabled: true,
					modeApiConfigs: { architect: "architect-config-id" },
				}),
			)
			expect(result.configId).toBeUndefined()
			expect(result.source).toBe("none")
		})
	})

	describe("resolveProfileForMode - 兼容回退（新开关未设置）", () => {
		it("新开关未设置 + lockApiConfigAcrossModes=false 时按 Mode 路由", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					lockApiConfigAcrossModes: false,
					modeApiConfigs: { code: "code-config-id" },
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("code-config-id")
			expect(result.source).toBe("mode-binding")
			expect(result.routingEnabled).toBe(true)
		})

		it("新开关未设置 + lockApiConfigAcrossModes=true 时走全局", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					lockApiConfigAcrossModes: true,
					modeApiConfigs: { code: "code-config-id" },
					currentGlobalApiConfigName: "global-config",
				}),
			)
			expect(result.configId).toBe("global-config")
			expect(result.source).toBe("global")
			expect(result.routingEnabled).toBe(false)
		})
	})

	describe("shouldAutoSwitchProfile", () => {
		it("routing enabled 且命中 mode-binding 时返回 true", () => {
			expect(
				shouldAutoSwitchProfile(
					baseInput({
						mode: "code",
						modeLevelLlmRoutingEnabled: true,
						modeApiConfigs: { code: "code-config-id" },
					}),
				),
			).toBe(true)
		})

		it("routing disabled 时返回 false（即使有 mode-binding）", () => {
			expect(
				shouldAutoSwitchProfile(
					baseInput({
						mode: "code",
						modeLevelLlmRoutingEnabled: false,
						modeApiConfigs: { code: "code-config-id" },
					}),
				),
			).toBe(false)
		})

		it("routing enabled 但未命中 mode-binding（回退到 task）时返回 false", () => {
			expect(
				shouldAutoSwitchProfile(
					baseInput({
						mode: "graphics",
						modeLevelLlmRoutingEnabled: true,
						modeApiConfigs: { code: "code-config-id" },
						currentTaskApiConfigName: "task-config",
					}),
				),
			).toBe(false)
		})

		it("explicit 指定时返回 false（explicit 不算自动切换）", () => {
			expect(
				shouldAutoSwitchProfile(
					baseInput({
						mode: "code",
						modeLevelLlmRoutingEnabled: true,
						explicitProviderProfile: "explicit-config",
						modeApiConfigs: { code: "code-config-id" },
					}),
				),
			).toBe(false)
		})
	})

	describe("describeRoutingSource", () => {
		it("返回各来源的中文描述", () => {
			expect(describeRoutingSource("explicit")).toBe("用户显式指定")
			expect(describeRoutingSource("mode-binding")).toBe("Mode 绑定")
			expect(describeRoutingSource("task")).toBe("task 级 sticky")
			expect(describeRoutingSource("global")).toBe("全局")
			expect(describeRoutingSource("none")).toBe("无可用")
		})
	})

	describe("优先级综合验证", () => {
		// 验证文档定义的优先级顺序：explicit > mode-binding > task > global
		it("优先级：explicit > mode-binding（routing enabled）", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					modeLevelLlmRoutingEnabled: true,
					explicitProviderProfile: "explicit",
					modeApiConfigs: { code: "binding" },
					currentTaskApiConfigName: "task",
					currentGlobalApiConfigName: "global",
				}),
			)
			expect(result.source).toBe("explicit")
		})

		it("优先级：mode-binding > task（routing enabled）", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "code",
					modeLevelLlmRoutingEnabled: true,
					modeApiConfigs: { code: "binding" },
					currentTaskApiConfigName: "task",
					currentGlobalApiConfigName: "global",
				}),
			)
			expect(result.source).toBe("mode-binding")
		})

		it("优先级：task > global（routing enabled，mode 未配置）", () => {
			const result = resolveProfileForMode(
				baseInput({
					mode: "graphics",
					modeLevelLlmRoutingEnabled: true,
					modeApiConfigs: { code: "binding" },
					currentTaskApiConfigName: "task",
					currentGlobalApiConfigName: "global",
				}),
			)
			expect(result.source).toBe("task")
		})

		it("优先级（routing disabled）：explicit > task > global，不应用 mode-binding", () => {
			// explicit 最高
			expect(
				resolveProfileForMode(
					baseInput({
						mode: "code",
						modeLevelLlmRoutingEnabled: false,
						explicitProviderProfile: "explicit",
						modeApiConfigs: { code: "binding" },
						currentTaskApiConfigName: "task",
						currentGlobalApiConfigName: "global",
					}),
				).source,
			).toBe("explicit")

			// task 次之（mode-binding 被跳过）
			expect(
				resolveProfileForMode(
					baseInput({
						mode: "code",
						modeLevelLlmRoutingEnabled: false,
						modeApiConfigs: { code: "binding" },
						currentTaskApiConfigName: "task",
						currentGlobalApiConfigName: "global",
					}),
				).source,
			).toBe("task")

			// global 兜底
			expect(
				resolveProfileForMode(
					baseInput({
						mode: "code",
						modeLevelLlmRoutingEnabled: false,
						modeApiConfigs: { code: "binding" },
						currentGlobalApiConfigName: "global",
					}),
				).source,
			).toBe("global")
		})
	})
})
