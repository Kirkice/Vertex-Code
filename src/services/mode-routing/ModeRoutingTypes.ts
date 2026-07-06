/**
 * Mode-Level LLM Routing 类型定义
 *
 * 定义 Mode → Provider Profile 路由解析的输入输出结构。
 * 详见 docs/mode-level-llm-routing-implementation-guide.md Phase 1。
 */

/**
 * 路由解析输入。
 *
 * 所有字段均为可选，由调用方按可用性填充；resolver 内部按优先级判定。
 */
export interface ResolveModeProfileInput {
	/** 当前要切换到的 Mode slug，例如 "code" / "architect" / "ask" / "graphics" */
	mode: string
	/**
	 * 用户本次显式指定的 Provider Profile（configId 或 name，由调用方约定）。
	 * 若存在则优先级最高，覆盖一切自动判定。
	 */
	explicitProviderProfile?: string
	/** 当前 task 自己持有的 apiConfigName（task 级 sticky profile） */
	currentTaskApiConfigName?: string
	/** 当前全局 currentApiConfigName */
	currentGlobalApiConfigName?: string
	/** Mode → configId 绑定表（来自 modeApiConfigs） */
	modeApiConfigs?: Record<string, string>
	/**
	 * Mode-Level LLM Routing 总开关（新开关，优先）。
	 * - `true`: 按 Mode 绑定切换 profile
	 * - `false`: 所有 Mode 用全局 profile
	 * - `undefined`: 回退到 lockApiConfigAcrossModes 反推
	 */
	modeLevelLlmRoutingEnabled?: boolean
	/**
	 * 旧开关（workspaceState），与新开关互为反义。
	 * 仅当 `modeLevelLlmRoutingEnabled === undefined` 时参与判定。
	 */
	lockApiConfigAcrossModes?: boolean
}

/**
 * 路由来源标签，用于调试与日志。
 *
 * 优先级从高到低：
 * - `"explicit"`: 用户显式指定
 * - `"mode-binding"`: routing enabled 且 modeApiConfigs[mode] 存在
 * - `"task"`: task 级 sticky profile
 * - `"global"`: 全局 currentApiConfigName
 * - `"none"`: 无可用 profile
 */
export type ResolveModeProfileSource = "explicit" | "mode-binding" | "task" | "global" | "none"

/**
 * 路由解析输出。
 */
export interface ResolveModeProfileOutput {
	/** 解析出的 configId（或 profile name，取决于输入约定）；无可用时为 undefined */
	configId?: string
	/** 命中的来源 */
	source: ResolveModeProfileSource
	/** 解析后的实际路由是否启用（已处理兼容回退） */
	routingEnabled: boolean
}
