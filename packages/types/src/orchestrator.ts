/**
 * Orchestrator Types
 *
 * 多模型编排系统的核心类型定义。
 * OrchestratorTask 是编排层任务对象，与执行层 TaskLike 分离建模。
 */

// ============================================================================
// Task Status & Kind
// ============================================================================

/**
 * 编排任务状态
 */
export type OrchestratorTaskStatus =
	| "pending"
	| "ready"
	| "running"
	| "succeeded"
	| "failed"
	| "blocked"
	| "cancelled"

/**
 * 任务类型
 * - plan: 规划任务（Codex 负责）
 * - exec: 执行任务（Worker 负责）
 * - repair: 修复任务（Worker 负责，继承原任务边界）
 * - review: 验收任务（Codex 负责）
 */
export type OrchestratorTaskKind = "plan" | "exec" | "repair" | "review"

// ============================================================================
// Task References & Constraints
// ============================================================================

/**
 * 任务引用（用于依赖关系）
 */
export interface TaskRef {
	taskId: string
	title: string
}

/**
 * 验收标准
 */
export interface AcceptanceCriterion {
	/** 唯一标识 */
	id: string
	/** 标准描述 */
	description: string
	/** 是否必须满足 */
	required: boolean
	/** 验证提示（可选） */
	verificationHint?: string
}

/**
 * 任务约束类型
 */
export type TaskConstraintType =
	| "allowed_files"
	| "forbidden_files"
	| "max_diff_lines"
	| "must_add_tests"
	| "no_api_change"
	| "preserve_behavior"
	| "output_format"

/**
 * 任务约束
 */
export interface TaskConstraint {
	type: TaskConstraintType
	value: unknown
}

/**
 * 模型偏好
 */
export interface ModelPreference {
	provider: "codex" | "deepseek" | "qwen" | "claude" | "auto"
	model?: string
	reasoningEffort?: "low" | "medium" | "high"
}

// ============================================================================
// Base Task
// ============================================================================

/**
 * 编排任务基础接口
 *
 * 这是编排层的任务对象，与执行层 TaskLike 分离。
 * OrchestratorTask 描述"做什么"，TaskLike 描述"怎么执行"。
 */
export interface OrchestratorTask {
	/** 任务唯一标识 */
	taskId: string
	/** 父任务 ID（可选） */
	parentTaskId?: string
	/** 所属会话 ID */
	sessionId: string
	/** 任务类型 */
	kind: OrchestratorTaskKind
	/** 任务标题 */
	title: string
	/** 任务目标描述 */
	objective: string
	/** 当前状态 */
	status: OrchestratorTaskStatus
	/** 优先级（1 最高，5 最低） */
	priority: 1 | 2 | 3 | 4 | 5
	/** 依赖的前置任务 */
	dependsOn: TaskRef[]
	/** 关联的上下文 bundle IDs */
	contextBundleIds: string[]
	/** 任务输入参数 */
	inputs: Record<string, unknown>
	/** 任务约束 */
	constraints: TaskConstraint[]
	/** 验收标准 */
	acceptanceCriteria: AcceptanceCriterion[]
	/** 推荐执行模型 */
	preferredModel: ModelPreference
	/** 已重试次数 */
	retryCount: number
	/** 最大重试次数 */
	maxRetries: number
	/** 创建时间 (ISO 8601) */
	createdAt: string
	/** 更新时间 (ISO 8601) */
	updatedAt: string
}

// ============================================================================
// Exec Task (执行/修复任务扩展)
// ============================================================================

/**
 * 执行任务输出类型
 */
export type ExecTaskOutputType = "patch" | "analysis" | "test_plan" | "command_suggestion"

/**
 * 风险等级
 */
export type RiskLevel = "low" | "medium" | "high"

/**
 * 执行任务（扩展 OrchestratorTask）
 *
 * 用于 worker 执行具体子任务。
 */
export interface ExecTask extends OrchestratorTask {
	kind: "exec" | "repair"
	/** 允许写入的文件路径 */
	allowedWritePaths: string[]
	/** 期望输出类型 */
	expectedOutputs: ExecTaskOutputType[]
	/** 风险等级 */
	riskLevel: RiskLevel
}

// ============================================================================
// Review Task (验收任务扩展)
// ============================================================================

/**
 * 验收任务输入
 */
export interface ReviewInputs {
	/** 变更的文件列表 */
	changedFiles: string[]
	/** unified diff 格式的差异 */
	unifiedDiff: string
	/** 验证报告 ID（可选） */
	verificationReportId?: string
	/** 原始用户请求 */
	originalUserRequest: string
}

/**
 * 验收任务（扩展 OrchestratorTask）
 *
 * 用于 reviewer 验收执行结果。
 */
export interface ReviewTask extends OrchestratorTask {
	kind: "review"
	/** 验收输入 */
	reviewInputs: ReviewInputs
}

// ============================================================================
// Context Bundle
// ============================================================================

/**
 * 上下文文件来源
 */
export type ContextFileReason = "active" | "dependency" | "search-hit" | "config" | "test-related"

/**
 * 上下文文件
 */
export interface ContextFile {
	/** 文件路径 */
	path: string
	/** 包含原因 */
	reason: ContextFileReason
	/** 文件内容 */
	content: string
	/** 是否被截断 */
	truncated: boolean
}

/**
 * 符号引用
 */
export interface SymbolRef {
	/** 符号名称 */
	name: string
	/** 符号类型 */
	kind: "function" | "class" | "variable" | "type" | "interface" | "other"
	/** 所在文件路径 */
	filePath: string
	/** 行号范围 */
	lineRange?: { start: number; end: number }
}

/**
 * 上下文 Bundle
 *
 * 为模型提供的最小必要上下文切片。
 */
export interface ContextBundle {
	/** Bundle 唯一标识 */
	bundleId: string
	/** 上下文摘要 */
	summary: string
	/** 包含的文件 */
	files: ContextFile[]
	/** 相关符号引用 */
	symbols: SymbolRef[]
	/** 约束条件 */
	constraints: string[]
	/** 预估 token 数 */
	tokenEstimate: number
}

// ============================================================================
// Verification Report
// ============================================================================

/**
 * 验证配置文件
 * - fast: 格式检查、局部测试、类型检查
 * - standard: lint + typecheck + targeted test
 * - full: standard + build + integration test
 */
export type VerificationProfile = "fast" | "standard" | "full"

/**
 * 验证状态
 */
export type VerificationStatus = "passed" | "failed" | "partial"

/**
 * 命令执行结果
 */
export interface CommandResult {
	/** 执行的命令 */
	command: string
	/** 退出码 */
	exitCode: number
	/** 命令摘要 */
	summary: string
	/** stdout 输出路径（可选，大文件落盘） */
	stdoutPath?: string
	/** stderr 输出路径（可选，大文件落盘） */
	stderrPath?: string
	/** stdout 内容（小文件直接包含） */
	stdout?: string
	/** stderr 内容（小文件直接包含） */
	stderr?: string
	/** 执行耗时（毫秒） */
	durationMs?: number
}

/**
 * 验证报告
 */
export interface VerificationReport {
	/** 报告唯一标识 */
	reportId: string
	/** 所属会话 ID */
	sessionId: string
	/** 整体状态 */
	status: VerificationStatus
	/** 使用的验证配置 */
	profile: VerificationProfile
	/** 各命令执行结果 */
	commandResults: CommandResult[]
	/** 未通过的验收标准 ID 列表 */
	failedCriteriaIds: string[]
	/** 报告生成时间 (ISO 8601) */
	generatedAt: string
}

// ============================================================================
// Session State
// ============================================================================

/**
 * 编排会话状态
 */
export type OrchestratorSessionState =
	| "created"
	| "planning"
	| "executing"
	| "verifying"
	| "reviewing"
	| "repairing"
	| "completed"
	| "failed"
	| "cancelled"

// ============================================================================
// Review Decision
// ============================================================================

/**
 * Reviewer 决策类型
 */
export type ReviewDecision = "accept" | "repair" | "reject" | "needs_user_confirmation"

/**
 * Review Finding 严重度
 */
export type FindingSeverity = "high" | "medium" | "low"

/**
 * Review Finding
 */
export interface ReviewFinding {
	severity: FindingSeverity
	file?: string
	message: string
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 判断是否为 ExecTask
 */
export function isExecTask(task: OrchestratorTask): task is ExecTask {
	return task.kind === "exec" || task.kind === "repair"
}

/**
 * 判断是否为 ReviewTask
 */
export function isReviewTask(task: OrchestratorTask): task is ReviewTask {
	return task.kind === "review"
}

// ============================================================================
// Task Factory Helpers
// ============================================================================

/**
 * 创建任务 ID
 */
export function createTaskId(prefix: string = "task"): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创建 Bundle ID
 */
export function createBundleId(): string {
	return `bundle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创建 Report ID
 */
export function createReportId(): string {
	return `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}