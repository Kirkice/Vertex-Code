import type {
  RooCliApprovalDecision,
  RooCliApprovalRequest,
  RooCliCost,
  RooCliErrorCode,
  RooCliFinalOutput,
  RooCliStreamEvent,
} from "@roo-code/types"

/**
 * 运行时只描述对外能力，不依赖 Node、终端或任何 UI 框架。
 * 具体实现由 node-host、未来的远程 Host 或测试替身分别提供。
 */
export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  toolCallId?: string
  name?: string
  toolCalls?: AgentToolCall[]
}

/** JSON Schema 的最小子集，足够表达 OpenAI function tool。 */
export interface AgentToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  requiresApproval: boolean
  risk: RooCliApprovalRequest["risk"]
}

/** 任务模式快照：由 CLI/Node Host 解析，runtime 只消费结果。 */
export interface AgentMode {
  slug: string
  name: string
  roleDefinition: string
  customInstructions?: string
  allowedTools?: readonly string[]
}

/** runtime 持有的任务清单项，不依赖 TUI 的本地状态。 */
export interface AgentTodoItem {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed"
}

export interface AgentToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ModelUsage {
  inputTokens?: number
  outputTokens?: number
  totalCost?: number
}

/**
 * Provider 以增量事件表达回复。运行时因此可以在文本到达时立即转发，
 * 而不把 SSE/OpenAI 传输细节泄漏到 CLI 渲染器。
 */
export type ModelStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; toolCall: AgentToolCall }
  | { type: "usage"; usage: ModelUsage }
  | { type: "done"; finishReason: "stop" | "tool_calls" }

export interface ModelRequest {
  messages: readonly AgentMessage[]
  tools: readonly AgentToolDefinition[]
  signal: AbortSignal
}

export interface ModelProvider {
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>
}

export interface ToolExecutionContext {
  cwd: string
  signal: AbortSignal
}

export interface ToolExecutionResult {
  output: string
  exitCode?: number
}

export interface ToolRegistry {
  definitions(): readonly AgentToolDefinition[]
  execute(call: AgentToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult>
}

/** 审批策略既可由交互式 TUI 实现，也可由非交互 batch 策略实现。 */
export interface ApprovalResolver {
  resolve(request: RooCliApprovalRequest, signal: AbortSignal): Promise<RooCliApprovalDecision>
}

/** 交互宿主在审批事件到达后提交用户的明确选择。 */
export interface InteractiveApprovalResolver extends ApprovalResolver {
  decide(requestId: string, decision: RooCliApprovalDecision): boolean
  cancelPending(reason?: unknown): void
}

export interface PersistedSession {
  id: string
  cwd: string
  prompt: string
  startedAt: string
  finishedAt?: string
  success?: boolean
  code?: RooCliErrorCode
  events: RooCliStreamEvent[]
  messages: AgentMessage[]
  cost?: RooCliCost
}

export interface SessionStore {
  create(session: PersistedSession): Promise<void>
  appendEvent(sessionId: string, event: RooCliStreamEvent): Promise<void>
  complete(sessionId: string, patch: Pick<PersistedSession, "finishedAt" | "success" | "code" | "messages" | "cost">): Promise<void>
}

/**
 * 平台无关的键值存储端口。
 *
 * runtime 只关心配置的读写，不关心数据最终落在 JSON、数据库还是远程服务中。
 * Node Host 会用它替代 VS Code 的 globalState/workspaceState。
 */
export interface KeyValueStore<T extends Record<string, unknown>> {
  get(): Promise<Readonly<T>>
  set(patch: Partial<T>): Promise<Readonly<T>>
  replace(value: T): Promise<Readonly<T>>
}

/** API Profile 的最小跨平台描述；敏感字段必须通过 SecretStore 保存。 */
export interface ProviderProfile {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  secretKey: string
  createdAt: string
  updatedAt: string
}

/** SecretStorage 的平台无关端口，具体实现可替换为系统钥匙串。 */
export interface SecretStore {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<readonly string[]>
}

/**
 * 工作区宿主端口。所有路径都使用相对于 workspace 的 POSIX 风格路径，
 * 从而避免 runtime 处理 Windows 分隔符和 VS Code URI。
 */
export interface WorkspaceHost {
  root(): string
  readText(path: string): Promise<string>
  writeText(path: string, content: string): Promise<void>
  list(path?: string): Promise<readonly WorkspaceEntry[]>
  loadRules(): Promise<WorkspaceRules>
}

export interface WorkspaceEntry {
  path: string
  kind: "file" | "directory"
}

export interface WorkspaceRules {
  files: readonly string[]
  ignored: readonly string[]
  content: string
}

/** 文件搜索结果使用稳定的 POSIX 相对路径，便于模型和 CLI 跨平台消费。 */
export interface WorkspaceSearchResult {
  path: string
  line: number
  column: number
  preview: string
}

export interface WorkspaceSearchHost {
  search(query: string, options?: WorkspaceSearchOptions): Promise<readonly WorkspaceSearchResult[]>
}

export interface WorkspaceSearchOptions {
  maxResults?: number
  include?: readonly string[]
  exclude?: readonly string[]
}

export interface AgentSessionOptions {
  sessionId: string
  cwd: string
  prompt: string
  provider: ModelProvider
  tools: ToolRegistry
  approvals: ApprovalResolver
  store: SessionStore
  signal?: AbortSignal
  now?: () => Date
  maxTurns?: number
  /**
   * 恢复会话时使用的历史消息。新会话不传此字段；恢复会话则以该消息序列
   * 作为模型上下文，避免把 resume 降级成重新发送原始提示词。
   */
  initialMessages?: readonly AgentMessage[]
  mode?: AgentMode
  todos?: readonly AgentTodoItem[]
  maxContextMessages?: number
}

export interface AgentSessionResult extends Omit<RooCliFinalOutput, "events"> {
  events: RooCliStreamEvent[]
}
