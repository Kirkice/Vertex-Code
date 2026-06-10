/**
 * Orchestrator Events
 *
 * 多模型编排系统的事件类型定义。
 * 用于 Session 状态流转、组件间通信、UI 推送。
 */

import type {
	OrchestratorTask,
	ExecTask,
	ReviewTask,
	ContextBundle,
	VerificationReport,
	OrchestratorSessionState,
	ReviewDecision,
	ReviewFinding,
	ModelPreference,
} from "./orchestrator.js"

// ============================================================================
// Message Envelope (通用消息封装)
// ============================================================================

/**
 * 消息来源/目标
 */
export type OrchestratorComponent =
	| "ui"
	| "extension"
	| "planner"
	| "router"
	| "worker"
	| "verifier"
	| "reviewer"

/**
 * 通用消息封装 (envelope + payload)
 *
 * 用于：
 * - 统一记录日志
 * - 支持扩展
 * - 支持 UI 实时展示
 * - 支持以后接入远端 orchestrator 服务
 */
export interface MessageEnvelope<T = unknown> {
	/** 协议版本 */
	version: "1.0"
	/** 消息唯一标识 */
	messageId: string
	/** 所属会话 ID */
	sessionId: string
	/** 追踪 ID（用于关联请求/响应） */
	traceId: string
	/** 时间戳 (ISO 8601) */
	timestamp: string
	/** 消息来源 */
	source: OrchestratorComponent
	/** 消息目标 */
	target: OrchestratorComponent
	/** 消息类型 */
	type: string
	/** 消息内容 */
	payload: T
}

// ============================================================================
// UI -> Extension Messages
// ============================================================================

/**
 * 用户设置
 */
export interface UserOrchestratorSettings {
	/** 最大预算（美元） */
	maxBudgetUsd?: number
	/** 偏好的低成本模型 */
	preferredCheapModel?: string
	/** 是否允许自动应用 patch */
	allowAutoApply?: boolean
	/** 最大修复轮次 */
	maxRepairRounds?: number
}

/**
 * 启动会话请求
 */
export interface StartSessionPayload {
	type: "session.start"
	/** 用户请求内容 */
	userRequest: string
	/** 当前活动文件 */
	activeFile?: string
	/** 选中代码 */
	selectedText?: string
	/** 用户设置 */
	userSettings: UserOrchestratorSettings
}

/**
 * 批准计划请求
 */
export interface ApprovePlanPayload {
	type: "plan.approve"
	/** 会话 ID */
	sessionId: string
	/** 批准的任务 ID 列表（空表示全部批准） */
	approvedTaskIds?: string[]
}

/**
 * 取消会话请求
 */
export interface CancelSessionPayload {
	type: "session.cancel"
	/** 会话 ID */
	sessionId: string
	/** 取消原因 */
	reason?: string
}

/**
 * 重试任务请求
 */
export interface RetryTaskPayload {
	type: "task.retry"
	/** 会话 ID */
	sessionId: string
	/** 任务 ID */
	taskId: string
}

/**
 * UI -> Extension 消息联合类型
 */
export type UiToExtensionMessage =
	| MessageEnvelope<StartSessionPayload>
	| MessageEnvelope<ApprovePlanPayload>
	| MessageEnvelope<CancelSessionPayload>
	| MessageEnvelope<RetryTaskPayload>

// ============================================================================
// Extension -> Planner Messages
// ============================================================================

/**
 * 规划策略
 */
export interface PlanningPolicy {
	/** 任务树最大深度 */
	maxDepth: number
	/** 是否优先可并行任务 */
	preferParallelizableTasks: boolean
	/** 是否必须生成验收标准 */
	requireAcceptanceCriteria: true
	/** 是否必须指定 allowedWritePaths */
	requireAllowedWritePaths: true
}

/**
 * 规划请求
 */
export interface PlanRequestPayload {
	type: "plan.request"
	/** 用户请求 */
	userRequest: string
	/** 上下文 bundle */
	context: ContextBundle
	/** 规划策略 */
	planningPolicy: PlanningPolicy
}

// ============================================================================
// Planner -> Extension Response
// ============================================================================

/**
 * 验收模板
 */
export interface FinalReviewTemplate {
	/** 成功定义 */
	successDefinition: string
	/** 必须检查的项目 */
	mustCheckItems: string[]
}

/**
 * 规划响应
 */
export interface PlanResponsePayload {
	type: "plan.response"
	/** 计划摘要 */
	planSummary: string
	/** 假设条件 */
	assumptions: string[]
	/** 风险点 */
	risks: string[]
	/** 生成的执行任务列表 */
	tasks: ExecTask[]
	/** 最终验收模板 */
	finalReviewTemplate: FinalReviewTemplate
}

// ============================================================================
// Extension -> Worker Messages
// ============================================================================

/**
 * 执行策略
 */
export interface ExecutionPolicy {
	/** 是否要求结构化输出 */
	requireStructuredOutput: true
	/** 是否拒绝超范围修改 */
	rejectOutOfScopeChanges: true
	/** patch 格式 */
	patchFormat: "unified_diff"
	/** 是否允许建议命令 */
	canSuggestCommands: boolean
}

/**
 * 执行任务请求
 */
export interface ExecuteTaskPayload {
	type: "task.execute"
	/** 任务对象 */
	task: ExecTask
	/** 上下文 bundle */
	context: ContextBundle
	/** 执行策略 */
	executionPolicy: ExecutionPolicy
}

// ============================================================================
// Worker -> Extension Response
// ============================================================================

/**
 * Worker 输出中的 patch 信息
 */
export interface PatchOutput {
	/** patch 格式 */
	format: "unified_diff"
	/** patch 内容 */
	content: string
	/** 变更的文件列表 */
	changedFiles: string[]
}

/**
 * Worker 输出
 */
export interface WorkerOutputs {
	/** patch 输出（可选） */
	patch?: PatchOutput
	/** 分析结果（可选） */
	analysis?: string
	/** 测试计划（可选） */
	testPlan?: string[]
	/** 命令建议（可选） */
	commandSuggestions?: string[]
}

/**
 * Worker 任务状态
 */
export type WorkerTaskStatus = "succeeded" | "failed" | "blocked"

/**
 * Worker 结果
 */
export interface WorkerResultPayload {
	type: "task.result"
	/** 任务 ID */
	taskId: string
	/** 任务状态 */
	status: WorkerTaskStatus
	/** 结果摘要 */
	summary: string
	/** 推理过程摘要 */
	reasoningSummary: string
	/** 输出内容 */
	outputs: WorkerOutputs
	/** 警告信息 */
	warnings: string[]
}

// ============================================================================
// Extension -> Verifier Messages
// ============================================================================

/**
 * 验证请求
 */
export interface VerifyRequestPayload {
	type: "verify.request"
	/** 任务 ID */
	taskId: string
	/** 变更的文件列表 */
	changedFiles: string[]
	/** 要执行的验证命令 */
	commands: string[]
}

// ============================================================================
// Verifier -> Extension Response
// ============================================================================

/**
 * 验证命令结果
 */
export interface VerifyCommandResult {
	/** 执行的命令 */
	command: string
	/** 退出码 */
	exitCode: number
	/** stdout 内容 */
	stdout: string
	/** stderr 内容 */
	stderr: string
	/** 执行耗时（毫秒） */
	durationMs: number
}

/**
 * 验证响应
 */
export interface VerifyResponsePayload {
	type: "verify.response"
	/** 任务 ID */
	taskId: string
	/** 整体状态 */
	overallStatus: "passed" | "failed" | "partial"
	/** 各命令执行结果 */
	commandResults: VerifyCommandResult[]
	/** 验证摘要 */
	summary: string
}

// ============================================================================
// Extension -> Reviewer Messages
// ============================================================================

/**
 * 审查策略
 */
export interface ReviewPolicy {
	/** 是否可以请求修复 */
	mayRequestRepair: true
	/** 最大修复轮次 */
	maxRepairRounds: number
	/** 是否必须返回决策 */
	requireDecision: true
}

/**
 * 审查请求
 */
export interface ReviewRequestPayload {
	type: "review.request"
	/** 原始用户请求 */
	originalUserRequest: string
	/** 计划摘要 */
	planSummary: string
	/** 已执行的任务列表 */
	executedTasks: ExecTask[]
	/** unified diff */
	diff: string
	/** 验证结果 */
	verification: VerifyResponsePayload
	/** 审查策略 */
	reviewPolicy: ReviewPolicy
}

// ============================================================================
// Reviewer -> Extension Response
// ============================================================================

/**
 * 审查响应
 */
export interface ReviewResponsePayload {
	type: "review.response"
	/** 决策 */
	decision: ReviewDecision
	/** 审查摘要 */
	summary: string
	/** 发现的问题 */
	findings: ReviewFinding[]
	/** 修复任务（当 decision === "repair" 时） */
	/** 非阻塞性建议（优化、改进等，不影响审核通过） */
	suggestions?: string[]
	repairTasks?: ExecTask[]
	/** 需要用户确认的问题（当 decision === "needs_user_confirmation" 时） */
	userConfirmationQuestion?: string
}

// ============================================================================
// Session Events (内部事件)
// ============================================================================

/**
 * 会话状态变更事件
 */
export interface SessionStateChangeEvent {
	type: "session.stateChanged"
	sessionId: string
	previousState: OrchestratorSessionState
	currentState: OrchestratorSessionState
	timestamp: string
}

/**
 * 任务状态变更事件
 */
export interface TaskStateChangeEvent {
	type: "task.stateChanged"
	sessionId: string
	taskId: string
	previousStatus: OrchestratorTask["status"]
	currentStatus: OrchestratorTask["status"]
	timestamp: string
}

/**
 * 任务创建事件
 */
export interface TaskCreatedEvent {
	type: "task.created"
	sessionId: string
	task: OrchestratorTask
	timestamp: string
}

/**
 * 任务完成事件
 */
export interface TaskCompletedEvent {
	type: "task.completed"
	sessionId: string
	taskId: string
	status: "succeeded" | "failed" | "cancelled"
	result?: WorkerResultPayload
	timestamp: string
}

/**
 * 模型选择事件
 */
export interface ModelSelectedEvent {
	type: "model.selected"
	sessionId: string
	taskId: string
	selectedModel: ModelPreference
	reason: string
	timestamp: string
}

/**
 * 修复循环事件
 */
export interface RepairLoopEvent {
	type: "repair.started" | "repair.completed" | "repair.exhausted"
	sessionId: string
	round: number
	maxRounds: number
	timestamp: string
}

/**
 * 编排事件联合类型
 */
export type OrchestratorEvent =
	| SessionStateChangeEvent
	| TaskStateChangeEvent
	| TaskCreatedEvent
	| TaskCompletedEvent
	| ModelSelectedEvent
	| RepairLoopEvent

// ============================================================================
// UI Push Events (推送给 Webview 的事件)
// ============================================================================

/**
 * 编排状态推送（给 Webview）
 */
export interface OrchestratorStatePush {
	type: "orchestrator.state"
	sessionId: string
	state: OrchestratorSessionState
	currentPhase: string
	currentTaskId?: string
	repairRound: number
	maxRepairRounds: number
}

/**
 * 任务更新推送（给 Webview）
 */
export interface OrchestratorTaskUpdate {
	type: "orchestrator.taskUpdated"
	sessionId: string
	task: OrchestratorTask
}

/**
 * 审查结果推送（给 Webview）
 */
export interface OrchestratorReviewResult {
	type: "orchestrator.reviewResult"
	sessionId: string
	decision: ReviewDecision
	summary: string
	findings: ReviewFinding[]
}

/**
 * 成本统计推送（给 Webview）
 */
export interface OrchestratorCostUpdate {
	type: "orchestrator.costUpdate"
	sessionId: string
	totalTokens: number
	tokensByProvider: Record<string, number>
	estimatedCostUsd: number
}

/**
 * Webview 推送事件联合类型
 */
export type OrchestratorWebviewPush =
	| OrchestratorStatePush
	| OrchestratorTaskUpdate
	| OrchestratorReviewResult
	| OrchestratorCostUpdate

// ============================================================================
// Helpers
// ============================================================================

/**
 * 创建消息 ID
 */
export function createMessageId(): string {
	return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创建追踪 ID
 */
export function createTraceId(): string {
	return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创建消息封装
 */
export function createEnvelope<T>(
	source: OrchestratorComponent,
	target: OrchestratorComponent,
	sessionId: string,
	traceId: string,
	type: string,
	payload: T,
): MessageEnvelope<T> {
	return {
		version: "1.0",
		messageId: createMessageId(),
		sessionId,
		traceId,
		timestamp: new Date().toISOString(),
		source,
		target,
		type,
		payload,
	}
}