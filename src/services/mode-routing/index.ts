/**
 * Mode-Level LLM Routing 服务入口
 *
 * 统一导出路由解析相关类型与函数。
 */

export type {
	ResolveModeProfileInput,
	ResolveModeProfileOutput,
	ResolveModeProfileSource,
} from "./ModeRoutingTypes"

export {
	resolveProfileForMode,
	resolveRoutingEnabled,
	shouldAutoSwitchProfile,
	describeRoutingSource,
} from "./ModeRoutingResolver"
