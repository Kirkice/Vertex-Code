import { randomUUID } from "node:crypto"

import { AgentSession, type ModelProvider } from "@vertex/agent-runtime"
import {
  BatchApprovalPolicy,
  ConfigStore,
  FileSecretStore,
  FileSessionStore,
  NodeToolRegistry,
  NodeWorkspaceHost,
  NodeProcessHost,
  OpenAiCompatibleProvider,
  ProfileStore,
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
  const provider = options.provider ?? new OpenAiCompatibleProvider(configured ?? readOpenAiCompatibleConfig())
  const workspace = new NodeWorkspaceHost(options.cwd)
  const session = new AgentSession({
    sessionId: options.sessionId ?? randomUUID(),
    cwd: options.cwd,
    prompt: options.prompt,
    provider,
    tools: new NodeToolRegistry(workspace, new NodeProcessHost()),
    approvals: new BatchApprovalPolicy(options.yolo),
    store: new FileSessionStore(),
    signal: options.signal,
  })

  for await (const event of session.run()) {
    yield event
  }
}

async function resolveProviderConfig(
  config: ConfigStore,
  profiles: ProfileStore,
  secrets: FileSecretStore,
): Promise<{ apiKey: string; baseUrl: string; model: string } | undefined> {
  const selectedId = (await config.get()).currentProfile
  if (!selectedId) return undefined
  const profile = await profiles.get(selectedId)
  if (!profile) return undefined
  const apiKey = await secrets.get(profile.secretKey)
  if (!apiKey) return undefined
  return { apiKey, baseUrl: profile.baseUrl.replace(/\/$/, ""), model: profile.model }
}

/** 保留 CLI 层的聚合函数，保证 renderer 不直接依赖 runtime 的内部状态。 */
export function createFinalOutput(events: CliStreamEvent[]): CliFinalOutput {
  const result = [...events].reverse().find((event) => event.type === "result")
  return {
    type: "result",
    success: result?.success ?? false,
    content: result?.content,
    code: result?.code as CliFinalOutput["code"],
    sessionId: result?.sessionId,
    cost: result?.cost,
    summary: result?.summary,
    events,
  }
}
