import { randomUUID } from "node:crypto"

import { AgentSession, type AgentMessage, type ModelProvider } from "@vertex/agent-runtime"
import {
  ConfigStore,
  FileSecretStore,
  FileSessionStore,
  NodeToolRegistry,
  NodeFileSearchHost,
  NodeGitHost,
  NodeMcpHost,
  NodeSkillsHost,
  NodeWorkspaceHost,
  NodeProcessHost,
  OpenAiCompatibleProvider,
  ProfileStore,
  PersistentApprovalPolicy,
  createModelProvider,
  readOpenAiCompatibleConfig,
} from "@vertex/node-host"

import type { CliFinalOutput, CliStreamEvent } from "./protocol.js"

export interface HeadlessSessionOptions {
  cwd: string
  prompt: string
  /** 仅在用户显式传入时自动批准写入与 Shell 操作。 */
  yolo: boolean
  signal?: AbortSignal
  sessionId?: string
  /** 恢复已有会话时传入完整消息上下文。 */
  initialMessages?: readonly AgentMessage[]
}

/**
 * CLI 与运行时的唯一装配点。这里选择 Node 实现；运行时本身不感知环境变量、
 * 文件系统、进程或 stdout，因此未来替换为 TUI/远程 Host 不需要改 AgentSession。
 */
export async function* runHeadlessSession(
  options: HeadlessSessionOptions & { provider?: ModelProvider },
): AsyncGenerator<CliStreamEvent> {
  const config = new ConfigStore()
  const profiles = new ProfileStore()
  const secrets = new FileSecretStore()
  const configured = await resolveProviderConfig(config, profiles, secrets)
  const provider = options.provider ?? configured ?? new OpenAiCompatibleProvider(readOpenAiCompatibleConfig())
  const workspace = new NodeWorkspaceHost(options.cwd)
  const mcp = new NodeMcpHost()
  const session = new AgentSession({
    sessionId: options.sessionId ?? randomUUID(),
    cwd: options.cwd,
    prompt: options.prompt,
    provider,
    tools: new NodeToolRegistry(workspace, new NodeProcessHost(), {
      search: new NodeFileSearchHost(workspace),
      git: new NodeGitHost(),
      mcp,
      skills: new NodeSkillsHost(),
    }),
    // batch 默认拒绝危险操作；交互式 UI 以后可在该策略上保存 always allow。
    approvals: new PersistentApprovalPolicy(options.yolo),
    store: new FileSessionStore(),
    signal: options.signal,
    initialMessages: options.initialMessages,
  })

  try {
    for await (const event of session.run()) {
      yield event
    }
  } finally {
    // MCP stdio 进程归本次会话所有；任务成功、失败或取消均要主动回收。
    await mcp.close()
  }
}

/**
 * 为 CLI 命令统一提供会话装配入口。
 * resume 与普通 run 共用同一条事件、取消和错误处理链，避免出现两套行为。
 */

async function resolveProviderConfig(
  config: ConfigStore,
  profiles: ProfileStore,
  secrets: FileSecretStore,
): Promise<ModelProvider | undefined> {
  const selectedId = (await config.get()).currentProfile
  if (!selectedId) return undefined
  const profile = await profiles.get(selectedId)
  if (!profile) return undefined
  const apiKey = await secrets.get(profile.secretKey)
  if (!apiKey) return undefined
  return createModelProvider(profile, apiKey)
}

/** 保留 CLI 层的聚合函数，保证 renderer 不直接依赖 runtime 的内部状态。 */
export function createFinalOutput(events: CliStreamEvent[]): CliFinalOutput {
  const result = [...events].reverse().find((event) => event.type === "result")
  const error = [...events].reverse().find((event) => event.type === "error")
  return {
    type: "result",
    success: result?.success ?? false,
    content: result?.content ?? error?.content,
    code: result?.code as CliFinalOutput["code"] ?? error?.code as CliFinalOutput["code"],
    sessionId: result?.sessionId,
    cost: result?.cost,
    summary: result?.summary,
    events,
  }
}
