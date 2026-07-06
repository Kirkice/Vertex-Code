/**
 * Mode-Level LLM Routing 解析器
 *
 * 统一实现 Mode → Provider Profile 的路由优先级判定，
 * 收口原本散落在 ClineProvider.handleModeSwitch / task 恢复 / submitUserMessage 的判定逻辑。
 *
 * 优先级（routing enabled 时）：
 *   1. explicitProviderProfile（用户显式指定）
 *   2. modeApiConfigs[mode]（Mode 绑定）
 *   3. currentTaskApiConfigName（task 级 sticky）
 *   4. currentGlobalApiConfigName（全局）
 *
 * 优先级（routing disabled 时）：
 *   1. explicitProviderProfile
 *   2. currentTaskApiConfigName
 *   3. currentGlobalApiConfigName
 *   （不应用 modeApiConfigs）
 *
 * 详见 docs/mode-level-llm-routing-implementation-guide.md Phase 1。
 */

import type {
	ResolveModeProfileInput,
	ResolveModeProfileOutput,
	ResolveModeProfileSource,
} from "./ModeRoutingTypes"

/**
 * 解析某个 Mode 应使用的 Provider Profile。
 *
 * 纯函数，无副作用，不访问 ProviderSettingsManager。
 * 调用方拿到 configId 后，自行负责 configId → profile name 的解析与 activateProviderProfile。
 */
export function resolveProfileForMode(input: ResolveModeProfileInput): ResolveModeProfileOutput {
	const routingEnabled = resolveRoutingEnabled(input)

	// 1. 用户显式指定优先级最高（无论 routing 是否开启）
	if (input.explicitProviderProfile) {
		return { configId: input.explicitProviderProfile, source: "explicit", routingEnabled }
	}

	// 2. routing enabled 时，优先使用 Mode 绑定
	if (routingEnabled) {
		const bound = input.modeApiConfigs?.[input.mode]
		if (bound) {
			return { configId: bound, source: "mode-binding", routingEnabled }
		}
	}

	// 3. task 级 sticky profile
	if (input.currentTaskApiConfigName) {
		return { configId: input.currentTaskApiConfigName, source: "task", routingEnabled }
	}

	// 4. 全局 profile
	if (input.currentGlobalApiConfigName) {
		return { configId: input.currentGlobalApiConfigName, source: "global", routingEnabled }
	}

	// 5. 无可用
	return { configId: undefined, source: "none", routingEnabled }
}

/**
 * 解析路由是否启用，处理新开关与旧开关的兼容回退。
 *
 * 规则：
 * - 新开关 modeLevelLlmRoutingEnabled 已设置 → 直接使用
 * - 新开关未设置（undefined）→ 由 lockApiConfigAcrossModes 反推（反义）
 * - 两者均未设置 → 默认 false（向后兼容：沿用全局模型）
 *
 * @returns true 表示按 Mode 切换 profile；false 表示锁定全局 profile
 */
export function resolveRoutingEnabled(input: Pick<ResolveModeProfileInput, "modeLevelLlmRoutingEnabled" | "lockApiConfigAcrossModes">): boolean {
	if (input.modeLevelLlmRoutingEnabled !== undefined) {
		return input.modeLevelLlmRoutingEnabled
	}
	// 兼容回退：lockApiConfigAcrossModes 是反义
	// lock=true  ⇔ routing=false（锁定全局）
	// lock=false ⇔ routing=true（允许按 Mode 切换）
	return !(input.lockApiConfigAcrossModes ?? false)
}

/**
 * 判断某次 Mode 切换是否应触发自动 profile 切换。
 *
 * 供 ClineProvider.handleModeSwitch 决定是否调用 activateProviderProfile。
 * 只有 routing enabled 且命中 mode-binding 时才返回 true。
 */
export function shouldAutoSwitchProfile(input: ResolveModeProfileInput): boolean {
	const result = resolveProfileForMode(input)
	return result.routingEnabled && result.source === "mode-binding"
}

/**
 * 获取路由来源的中文描述（用于日志/调试）。
 */
export function describeRoutingSource(source: ResolveModeProfileSource): string {
	switch (source) {
		case "explicit":
			return "用户显式指定"
		case "mode-binding":
			return "Mode 绑定"
		case "task":
			return "task 级 sticky"
		case "global":
			return "全局"
		case "none":
			return "无可用"
	}
}
