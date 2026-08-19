import { randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { spawn } from "node:child_process"

import { resolveVertexPaths } from "./paths.js"

import type {
  AgentMessage,
  AgentToolCall,
  AgentToolDefinition,
  ApprovalResolver,
  ModelProvider,
  ModelRequest,
  ModelStreamEvent,
  PersistedSession,
  SessionStore,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolRegistry,
} from "@vertex/agent-runtime"
import type { RooCliApprovalDecision, RooCliApprovalRequest, RooCliStreamEvent } from "@roo-code/types"

const textDecoder = new TextDecoder()

/** 从环境变量构建 OpenAI Chat Completions 兼容配置，不在配置错误时发起网络请求。 */
export function readOpenAiCompatibleConfig(environment: NodeJS.ProcessEnv = process.env): OpenAiCompatibleConfig {
  const apiKey = environment.VERTEX_API_KEY?.trim()
  const baseUrl = environment.VERTEX_BASE_URL?.trim()
  const model = environment.VERTEX_MODEL?.trim()
  if (!apiKey || !baseUrl || !model) {
    throw new Error("缺少模型配置：请设置 VERTEX_API_KEY、VERTEX_BASE_URL 和 VERTEX_MODEL。")
  }
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model }
}

export interface OpenAiCompatibleConfig {
  apiKey: string
  baseUrl: string
  model: string
}

/**
 * 仅依赖 Fetch/SSE 标准实现 OpenAI Chat Completions 的流式工具调用协议。
 * 适配层将网络帧归一化为 runtime 的小型事件模型，避免运行时绑定供应商 SDK。
 */
export class OpenAiCompatibleProvider implements ModelProvider {
  constructor(private readonly config: OpenAiCompatibleConfig, private readonly fetcher: typeof fetch = fetch) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    const response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
      signal: request.signal,
      body: JSON.stringify({
        model: this.config.model,
        stream: true,
        messages: request.messages.map(toOpenAiMessage),
        tools: request.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
      }),
    })
    if (!response.ok || !response.body) {
      throw new Error(`模型请求失败（HTTP ${response.status}）：${await response.text()}`)
    }

    const toolCalls = new Map<number, { id: string; name: string; arguments: string }>()
    let pending = ""
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      pending += textDecoder.decode(chunk, { stream: true })
      const lines = pending.split("\n")
      pending = lines.pop() ?? ""
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith("data:")) continue
        const payload = line.slice(5).trim()
        if (payload === "[DONE]") continue
        const parsed = JSON.parse(payload) as OpenAiChunk
        const choice = parsed.choices?.[0]
        if (parsed.usage) yield { type: "usage", usage: { inputTokens: parsed.usage.prompt_tokens, outputTokens: parsed.usage.completion_tokens } }
        if (!choice) continue
        if (choice.delta?.content) yield { type: "text_delta", text: choice.delta.content }
        for (const delta of choice.delta?.tool_calls ?? []) {
          const current = toolCalls.get(delta.index) ?? { id: "", name: "", arguments: "" }
          current.id += delta.id ?? ""
          current.name += delta.function?.name ?? ""
          current.arguments += delta.function?.arguments ?? ""
          toolCalls.set(delta.index, current)
        }
        if (choice.finish_reason) {
          for (const tool of toolCalls.values()) {
            yield { type: "tool_call", toolCall: { id: tool.id || randomUUID(), name: tool.name, input: parseToolArguments(tool.arguments) } }
          }
          yield { type: "done", finishReason: choice.finish_reason === "tool_calls" ? "tool_calls" : "stop" }
        }
      }
    }
  }
}

/** 无交互 batch 模式采用拒绝优先原则；--yolo 明确开启后才自动批准。 */
export class BatchApprovalPolicy implements ApprovalResolver {
  constructor(private readonly yolo: boolean) {}

  async resolve(_request: RooCliApprovalRequest, signal: AbortSignal): Promise<RooCliApprovalDecision> {
    if (signal.aborted) throw new Error("任务已取消。")
    return this.yolo ? "approve" : "deny"
  }
}

/**
 * 文件工具只解析工作区内路径。绝对路径、.. 跳出工作区和符号路径混淆都在
 * 统一入口处拒绝，避免每个工具各自实现不一致的安全检查。
 */
export class NodeToolRegistry implements ToolRegistry {
  constructor(
    private readonly workspace?: import("@vertex/agent-runtime").WorkspaceHost,
    private readonly shell?: import("@vertex/agent-runtime").ShellHost,
  ) {}

  definitions(): readonly AgentToolDefinition[] {
    return [
      { name: "read_file", description: "读取工作区中的 UTF-8 文本文件", parameters: objectSchema({ path: stringSchema("相对工作区的文件路径") }), requiresApproval: false, risk: "low" },
      { name: "list_directory", description: "列出工作区中的目录项", parameters: objectSchema({ path: stringSchema("相对工作区的目录路径") }), requiresApproval: false, risk: "low" },
      { name: "write_file", description: "写入工作区中的 UTF-8 文本文件", parameters: objectSchema({ path: stringSchema("相对工作区的文件路径"), content: stringSchema("完整文件内容") }, ["path", "content"]), requiresApproval: true, risk: "medium" },
      { name: "execute_shell", description: "在工作区内执行 shell 命令", parameters: objectSchema({ command: stringSchema("要执行的命令") }), requiresApproval: true, risk: "high" },
    ]
  }

  async execute(call: AgentToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    if (call.name === "read_file") {
      const path = requiredString(call.input.path, "path")
      return { output: this.workspace ? await this.workspace.readText(path) : await readFile(resolveWorkspacePath(context.cwd, path), "utf8") }
    }
    if (call.name === "list_directory") {
      const path = optionalString(call.input.path) ?? "."
      if (this.workspace) {
        const entries = await this.workspace.list(path)
        return { output: entries.map((entry) => `${entry.kind === "directory" ? "[dir]" : "[file]"} ${entry.path}`).join("\n") }
      }
      const entries = await readdir(resolveWorkspacePath(context.cwd, path), { withFileTypes: true })
      return { output: entries.map((entry) => `${entry.isDirectory() ? "[dir]" : "[file]"} ${entry.name}`).join("\n") }
    }
    if (call.name === "write_file") {
      const path = requiredString(call.input.path, "path")
      const content = requiredString(call.input.content, "content")
      if (this.workspace) await this.workspace.writeText(path, content)
      else {
        const target = resolveWorkspacePath(context.cwd, path)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, content, "utf8")
      }
      return { output: `已写入 ${path}` }
    }
    if (call.name === "execute_shell") {
      const command = requiredString(call.input.command, "command")
      if (this.shell) {
        const result = await this.shell.execute({ command, cwd: context.cwd, signal: context.signal })
        return { output: [result.stdout, result.stderr].filter(Boolean).join("\n") || "命令未产生输出。", exitCode: result.exitCode }
      }
      return executeShell(command, context)
    }
    throw new Error(`未注册工具：${call.name}`)
  }
}

/** 原子写入会话快照；CLI 崩溃时最多丢失最后一次事件，不留下半截 JSON。 */
export class FileSessionStore implements SessionStore {
  constructor(private readonly directory = join(resolveVertexPaths().sessions)) {}

  async create(session: PersistedSession): Promise<void> {
    await this.write(session)
  }

  async appendEvent(sessionId: string, event: RooCliStreamEvent): Promise<void> {
    const session = await this.read(sessionId)
    session.events.push(event)
    await this.write(session)
  }

  async complete(sessionId: string, patch: Pick<PersistedSession, "finishedAt" | "success" | "code" | "messages" | "cost">): Promise<void> {
    await this.write({ ...(await this.read(sessionId)), ...patch })
  }

  async read(sessionId: string): Promise<PersistedSession> {
    return JSON.parse(await readFile(this.path(sessionId), "utf8")) as PersistedSession
  }

  async list(): Promise<readonly PersistedSession[]> {
    let entries
    try {
      entries = await readdir(this.directory, { withFileTypes: true })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    const sessions: PersistedSession[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue
      try {
        sessions.push(JSON.parse(await readFile(join(this.directory, entry.name), "utf8")) as PersistedSession)
      } catch {
        // 忽略崩溃遗留的无效快照，不影响其他会话恢复。
      }
    }
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async findLatest(cwd: string): Promise<PersistedSession | undefined> {
    return (await this.list()).find((session) => session.cwd === cwd)
  }

  private path(sessionId: string): string { return join(this.directory, `${sessionId}.json`) }
  private async write(session: PersistedSession): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const target = this.path(session.id)
    const temporary = `${target}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(session, null, 2), "utf8")
    await rename(temporary, target)
  }
}

function resolveWorkspacePath(cwd: string, requested: string): string {
  if (isAbsolute(requested)) throw new Error("工具路径必须是相对工作区的路径。")
  const workspace = resolve(cwd)
  const target = resolve(workspace, requested)
  if (target !== workspace && !target.startsWith(`${workspace}\\`) && !target.startsWith(`${workspace}/`)) throw new Error("工具路径不能离开工作区。")
  return target
}

function executeShell(command: string, context: ToolExecutionContext): Promise<ToolExecutionResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, { cwd: context.cwd, shell: true, windowsHide: true })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })
    const abort = () => child.kill()
    context.signal.addEventListener("abort", abort, { once: true })
    child.once("error", reject)
    child.once("close", (exitCode) => {
      context.signal.removeEventListener("abort", abort)
      resolvePromise({ output: [stdout, stderr].filter(Boolean).join("\n") || "命令未产生输出。", exitCode: exitCode ?? 1 })
    })
  })
}

function toOpenAiMessage(message: AgentMessage): Record<string, unknown> {
  if (message.role === "tool") return { role: "tool", tool_call_id: message.toolCallId, content: message.content }
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.input),
        },
      })),
    }
  }
  return { role: message.role, content: message.content }
}
function parseToolArguments(value: string): Record<string, unknown> { try { return JSON.parse(value || "{}") as Record<string, unknown> } catch { throw new Error(`模型返回了无效工具参数：${value}`) } }
function requiredString(value: unknown, name: string): string { if (typeof value !== "string" || !value) throw new Error(`工具参数 ${name} 必须是非空字符串。`); return value }
function optionalString(value: unknown): string | undefined { return typeof value === "string" ? value : undefined }
function stringSchema(description: string): Record<string, unknown> { return { type: "string", description } }
function objectSchema(properties: Record<string, unknown>, required = Object.keys(properties)): Record<string, unknown> { return { type: "object", properties, required, additionalProperties: false } }

interface OpenAiChunk {
  choices?: Array<{ finish_reason?: string | null; delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}
