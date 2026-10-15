import { randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, rename, writeFile, open, unlink } from "node:fs/promises"
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

import { NodeFileSearchHost } from "./search-host.js"
import { NodeWorkspaceHost } from "./workspace-host.js"
import { ConfigStore } from "./config-store.js"

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
 * 带持久化 allowlist 的非交互审批策略。
 * 默认仍然拒绝：只有 `--yolo` 或此前由交互界面显式保存的 operation 才放行。
 */
export class PersistentApprovalPolicy implements ApprovalResolver {
  constructor(
    private readonly yolo: boolean,
    private readonly config = new ConfigStore(),
  ) {}

  async resolve(request: RooCliApprovalRequest, signal: AbortSignal): Promise<RooCliApprovalDecision> {
    if (signal.aborted) throw new Error("任务已取消。")
    if (this.yolo) return "approve"
    const allowed = (await this.config.get()).alwaysAllowOperations ?? []
    return allowed.includes(request.operation) ? "always_allow" : "deny"
  }

  /** 由交互式审批面板在用户选择“始终允许”后调用。 */
  async allow(operation: string): Promise<void> {
    const current = (await this.config.get()).alwaysAllowOperations ?? []
    if (!current.includes(operation)) await this.config.set({ alwaysAllowOperations: [...current, operation] })
  }

  async revoke(operation: string): Promise<void> {
    const current = (await this.config.get()).alwaysAllowOperations ?? []
    await this.config.set({ alwaysAllowOperations: current.filter((item) => item !== operation) })
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
    private readonly integrations: NodeToolIntegrations = {},
    private readonly dynamicMcpTools: readonly DynamicMcpTool[] = [],
  ) {}

  definitions(): readonly AgentToolDefinition[] {
    const native: AgentToolDefinition[] = [
      { name: "read_file", description: "读取工作区中的 UTF-8 文本文件", parameters: objectSchema({ path: stringSchema("相对工作区的文件路径") }), requiresApproval: false, risk: "low" },
      { name: "list_directory", description: "列出工作区中的目录项", parameters: objectSchema({ path: stringSchema("相对工作区的目录路径") }), requiresApproval: false, risk: "low" },
      { name: "write_file", description: "写入工作区中的 UTF-8 文本文件", parameters: objectSchema({ path: stringSchema("相对工作区的文件路径"), content: stringSchema("完整文件内容") }, ["path", "content"]), requiresApproval: true, risk: "medium" },
      { name: "edit_file", description: "按精确文本替换编辑工作区文件", parameters: objectSchema({ path: stringSchema("相对工作区的文件路径"), oldText: stringSchema("必须唯一匹配的原文本"), newText: stringSchema("替换后的文本") }, ["path", "oldText", "newText"]), requiresApproval: true, risk: "medium" },
      { name: "search_replace", description: "在工作区文件中执行精确字符串替换", parameters: objectSchema({ path: stringSchema("相对工作区的文件路径"), search: stringSchema("待搜索文本"), replace: stringSchema("替换文本"), all: { type: "boolean", description: "是否替换所有匹配项" } }, ["path", "search", "replace"]), requiresApproval: true, risk: "medium" },
      { name: "apply_patch", description: "应用 Vertex unified patch 到工作区文件", parameters: objectSchema({ patch: stringSchema("包含文件路径和上下文的 patch") }, ["patch"]), requiresApproval: true, risk: "medium" },
      { name: "execute_shell", description: "在工作区内执行 shell 命令", parameters: objectSchema({ command: stringSchema("要执行的命令") }), requiresApproval: true, risk: "high" },
      { name: "search_files", description: "在工作区文本文件中搜索字符串", parameters: objectSchema({ query: stringSchema("要搜索的字符串") }), requiresApproval: false, risk: "low" },
      { name: "git_status", description: "读取当前 Git 状态", parameters: objectSchema({}), requiresApproval: false, risk: "low" },
      { name: "git_diff", description: "读取当前 Git diff", parameters: objectSchema({ staged: { type: "boolean", description: "是否读取暂存区 diff" } }, []), requiresApproval: false, risk: "low" },
      { name: "git_checkpoint", description: "创建 Git checkpoint 提交", parameters: objectSchema({ message: stringSchema("checkpoint 提交说明") }), requiresApproval: true, risk: "high" },
      { name: "git_restore", description: "将工作区恢复到指定 Git checkpoint", parameters: objectSchema({ checkpoint: stringSchema("要恢复的 checkpoint 引用") }), requiresApproval: true, risk: "high" },
      { name: "git_worktree", description: "创建隔离的 Git worktree", parameters: objectSchema({ path: stringSchema("相对工作区的 worktree 路径"), ref: { type: "string", description: "起始 Git 引用，默认 HEAD" } }, ["path"]), requiresApproval: true, risk: "high" },
      { name: "use_mcp_tool", description: "调用已配置的 MCP 工具", parameters: objectSchema({ server: stringSchema("MCP Server 名称"), tool: stringSchema("MCP 工具名称"), input: { type: "object", description: "工具输入参数" } }), requiresApproval: true, risk: "high" },
      { name: "read_skill", description: "读取本地 Skill 的完整说明", parameters: objectSchema({ name: stringSchema("Skill 名称") }), requiresApproval: false, risk: "low" },
    ]
    return [...native, ...this.dynamicMcpTools.map((tool): AgentToolDefinition => ({
      name: tool.name,
      description: `[MCP ${tool.server}] ${tool.description ?? tool.tool}`,
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
      requiresApproval: true,
      risk: "high" as const,
    }))]
  }

  async execute(call: AgentToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const dynamic = this.dynamicMcpTools.find((tool) => tool.name === call.name)
    if (dynamic) {
      const mcp = this.requireIntegration(this.integrations.mcp, "MCP")
      return { output: await mcp.callTool(dynamic.server, dynamic.tool, call.input) }
    }
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
    if (call.name === "edit_file" || call.name === "search_replace") {
      const path = requiredString(call.input.path, "path")
      const search = requiredString(call.input[call.name === "edit_file" ? "oldText" : "search"], call.name === "edit_file" ? "oldText" : "search")
      const replacement = requiredString(call.input[call.name === "edit_file" ? "newText" : "replace"], call.name === "edit_file" ? "newText" : "replace")
      // 统一复用 WorkspaceHost 的安全边界；不能因为编辑工具走了另一条
      // 路径，就绕过相对路径、越界和符号链接检查。
      const content = this.workspace
        ? await this.workspace.readText(path)
        : await readFile(resolveWorkspacePath(context.cwd, path), "utf8")
      const count = content.split(search).length - 1
      if (count === 0) throw new Error(`文件中未找到待替换文本：${path}`)
      if (call.name === "edit_file" && count !== 1) throw new Error(`编辑文本必须唯一匹配：${path}`)
      const next = call.name === "search_replace" && call.input.all === true
        ? content.split(search).join(replacement)
        : content.replace(search, replacement)
      if (this.workspace) await this.workspace.writeText(path, next)
      else await writeFile(resolveWorkspacePath(context.cwd, path), next, "utf8")
      return { output: `已编辑 ${path}（${call.name === "search_replace" && call.input.all === true ? count : 1} 处）` }
    }
    if (call.name === "apply_patch") {
      const patch = requiredString(call.input.patch, "patch")
      return { output: await applyWorkspacePatch(context.cwd, patch) }
    }
    if (call.name === "execute_shell") {
      const command = requiredString(call.input.command, "command")
      if (this.shell) {
        const result = await this.shell.execute({ command, cwd: context.cwd, signal: context.signal })
        return { output: [result.stdout, result.stderr].filter(Boolean).join("\n") || "命令未产生输出。", exitCode: result.exitCode }
      }
      return executeShell(command, context)
    }
    if (call.name === "search_files") {
      const query = requiredString(call.input.query, "query")
      const search = this.integrations.search ?? this.createSearch(context.cwd)
      const results = await search.search(query)
      return { output: results.map((item) => `${item.path}:${item.line}:${item.column}: ${item.preview}`).join("\n") || "未找到匹配结果。" }
    }
    if (call.name === "git_status") {
      const git = this.requireIntegration(this.integrations.git, "Git")
      return { output: JSON.stringify(await git.status(context.cwd), null, 2) }
    }
    if (call.name === "git_diff") {
      const git = this.requireIntegration(this.integrations.git, "Git")
      return { output: await git.diff(context.cwd, call.input.staged === true) }
    }
    if (call.name === "git_checkpoint") {
      const git = this.requireIntegration(this.integrations.git, "Git")
      const message = requiredString(call.input.message, "message")
      return { output: `已创建 checkpoint：${await git.checkpoint(context.cwd, message)}` }
    }
    if (call.name === "git_restore") {
      const git = this.requireIntegration(this.integrations.git, "Git")
      const checkpoint = requiredString(call.input.checkpoint, "checkpoint")
      await git.restore(context.cwd, checkpoint)
      return { output: `已恢复到 checkpoint：${checkpoint}` }
    }
    if (call.name === "git_worktree") {
      const git = this.requireIntegration(this.integrations.git, "Git")
      const path = requiredString(call.input.path, "path")
      const worktreePath = resolveWorkspacePath(context.cwd, path)
      const ref = optionalString(call.input.ref)
      return { output: `已创建 worktree：${await git.worktree(context.cwd, worktreePath, ref)}` }
    }
    if (call.name === "use_mcp_tool") {
      const mcp = this.requireIntegration(this.integrations.mcp, "MCP")
      return { output: await mcp.callTool(requiredString(call.input.server, "server"), requiredString(call.input.tool, "tool"), record(call.input.input, "input")) }
    }
    if (call.name === "read_skill") {
      const skills = this.requireIntegration(this.integrations.skills, "Skills")
      const name = requiredString(call.input.name, "name")
      const skill = (await skills.discover(context.cwd)).find((item) => item.name === name)
      if (!skill) throw new Error(`未找到 Skill：${name}`)
      return { output: await skills.read(skill) }
    }
    throw new Error(`未注册工具：${call.name}`)
  }

  private createSearch(cwd: string): NodeFileSearchHost {
    if (this.workspace instanceof NodeWorkspaceHost) return new NodeFileSearchHost(this.workspace)
    return new NodeFileSearchHost(new NodeWorkspaceHost(cwd))
  }

  private requireIntegration<T>(value: T | undefined, name: string): T {
    if (!value) throw new Error(`${name} Host 尚未配置。`)
    return value
  }
}

/** Node 工具所需的可选外部适配器；使核心文件操作不依赖 MCP/Git/Skill。 */
export interface NodeToolIntegrations {
  search?: import("@vertex/agent-runtime").WorkspaceSearchHost
  git?: import("@vertex/agent-runtime").GitHost
  mcp?: import("@vertex/agent-runtime").McpHost
  skills?: import("@vertex/agent-runtime").SkillsHost
}

export interface DynamicMcpTool {
  name: string
  server: string
  tool: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/** 原子写入会话快照；CLI 崩溃时最多丢失最后一次事件，不留下半截 JSON。 */
export class FileSessionStore implements SessionStore {
  private readonly indexVersion = 1

  constructor(private readonly directory = join(resolveVertexPaths().sessions)) {}

  private get indexPath(): string { return join(this.directory, "index.json") }

  async create(session: PersistedSession): Promise<void> {
    await this.write(session)
    await this.updateIndex(session)
  }

  async appendEvent(sessionId: string, event: RooCliStreamEvent): Promise<void> {
    const session = await this.read(sessionId)
    session.events.push(event)
    await this.write(session)
  }

  async complete(sessionId: string, patch: Pick<PersistedSession, "finishedAt" | "success" | "code" | "messages" | "todos" | "cost">): Promise<void> {
    const session = { ...(await this.read(sessionId)), ...patch }
    await this.write(session)
    await this.updateIndex(session)
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
      if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "index.json") continue
      try {
        sessions.push(JSON.parse(await readFile(join(this.directory, entry.name), "utf8")) as PersistedSession)
      } catch {
        // 忽略崩溃遗留的无效快照，不影响其他会话恢复。
      }
    }
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  /** 读取轻量索引；损坏或旧版本索引会自动从快照重建。 */
  async readIndex(): Promise<readonly Pick<PersistedSession, "id" | "cwd" | "prompt" | "startedAt" | "finishedAt" | "success">[]> {
    try {
      const parsed = JSON.parse(await readFile(this.indexPath, "utf8")) as { version?: number; sessions?: unknown }
      if (parsed.version === this.indexVersion && Array.isArray(parsed.sessions)) return parsed.sessions as never
    } catch {
      // 下方的重建路径会跳过损坏快照，保证单个文件损坏不阻塞历史列表。
    }
    const sessions = await this.list()
    await this.writeIndex(sessions)
    return this.toIndexEntries(sessions)
  }

  /** 构建按工作区和启动时间排序的轻量索引，避免调用方反复扫描正文。 */
  async index(cwd?: string): Promise<readonly Pick<PersistedSession, "id" | "cwd" | "prompt" | "startedAt" | "finishedAt" | "success">[]> {
    return (await this.list())
      .filter((session) => !cwd || session.cwd === cwd)
      .map(({ id, cwd: sessionCwd, prompt, startedAt, finishedAt, success }) => ({ id, cwd: sessionCwd, prompt, startedAt, finishedAt, success }))
  }

  /** 同一 session 的写入锁；CLI 并发恢复时拒绝第二个持有者，避免覆盖快照。 */
  async withLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true })
    const lockPath = `${this.path(sessionId)}.lock`
    let handle
    try {
      handle = await open(lockPath, "wx")
      return await task()
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") throw new Error(`会话正在运行：${sessionId}`)
      throw error
    } finally {
      await handle?.close().catch(() => undefined)
      await unlink(lockPath).catch(() => undefined)
    }
  }

  async findLatest(cwd: string): Promise<PersistedSession | undefined> {
    return (await this.list()).find((session) => session.cwd === cwd)
  }

  private path(sessionId: string): string { return join(this.directory, `${sessionId}.json`) }
  private toIndexEntries(sessions: readonly PersistedSession[]) {
    return sessions.map(({ id, cwd, prompt, startedAt, finishedAt, success }) => ({ id, cwd, prompt, startedAt, finishedAt, success }))
  }
  private async updateIndex(session: PersistedSession): Promise<void> {
    const entries = (await this.readIndex()).filter((item) => item.id !== session.id)
    await this.writeIndex([...entries, ...this.toIndexEntries([session])].sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
  }
  private async writeIndex(sessions: readonly PersistedSession[] | readonly Pick<PersistedSession, "id" | "cwd" | "prompt" | "startedAt" | "finishedAt" | "success">[]): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const temporary = `${this.indexPath}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify({ version: this.indexVersion, sessions: sessions.map((session) => ({ id: session.id, cwd: session.cwd, prompt: session.prompt, startedAt: session.startedAt, finishedAt: session.finishedAt, success: session.success })) }, null, 2), "utf8")
    await rename(temporary, this.indexPath)
  }
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

/**
 * 应用 Vertex patch。解析阶段只读文件并生成内存中的新内容，所有 hunk 都
 * 校验通过后才写盘；任意写入失败会使用原内容回滚，避免多文件 patch 半成功。
 */
async function applyWorkspacePatch(cwd: string, patch: string): Promise<string> {
  const lines = patch.split(/\r?\n/)
  const operations: PatchOperation[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index]
    if (!header || header === "*** Begin Patch" || header === "*** End Patch") continue
    if (header.startsWith("*** Add File: ")) {
      const path = header.slice("*** Add File: ".length).trim()
      const content: string[] = []
      index += 1
      while (index < lines.length && !lines[index]?.startsWith("*** ")) {
        const line = lines[index++]
        if (line?.startsWith("+")) content.push(line.slice(1))
      }
      index -= 1
      operations.push({ kind: "add", path, content: content.join("\n") })
      continue
    }
    if (header.startsWith("*** Delete File: ")) {
      operations.push({ kind: "delete", path: header.slice("*** Delete File: ".length).trim() })
      continue
    }
    if (!header.startsWith("*** Update File: ")) continue
    const path = header.slice("*** Update File: ".length).trim()
    let moveTo: string | undefined
    if (lines[index + 1]?.startsWith("*** Move to: ")) moveTo = lines[++index]?.slice("*** Move to: ".length).trim()
    const hunks: PatchHunk[] = []
    while (index + 1 < lines.length && !lines[index + 1]?.startsWith("*** ")) {
      index += 1
      if (!lines[index]?.startsWith("@@")) continue
      const body: string[] = []
      while (index + 1 < lines.length && !lines[index + 1]?.startsWith("@@") && !lines[index + 1]?.startsWith("*** ")) body.push(lines[++index] ?? "")
      hunks.push({ lines: body })
    }
    operations.push({ kind: "update", path, moveTo, hunks })
  }
  if (operations.length === 0) throw new Error("patch 不包含可应用的文件操作")

  const staged = new Map<string, string | undefined>()
  const original = new Map<string, string | undefined>()
  for (const operation of operations) {
    const target = resolveWorkspacePath(cwd, operation.path)
    if (!original.has(target)) original.set(target, await readOptionalFile(target))
    const current = staged.has(target) ? staged.get(target) : original.get(target)
    if (operation.kind === "add") {
      if (current !== undefined) throw new Error(`新增文件已存在：${operation.path}`)
      staged.set(target, operation.content)
    } else if (operation.kind === "delete") {
      if (current === undefined) throw new Error(`删除文件不存在：${operation.path}`)
      staged.set(target, undefined)
    } else {
      if (current === undefined) throw new Error(`更新文件不存在：${operation.path}`)
      staged.set(target, applyHunks(current, operation.hunks, operation.path))
      if (operation.moveTo) {
        const destination = resolveWorkspacePath(cwd, operation.moveTo)
        if (!original.has(destination)) original.set(destination, await readOptionalFile(destination))
        if (staged.has(destination) ? staged.get(destination) !== undefined : original.get(destination) !== undefined) throw new Error(`重命名目标已存在：${operation.moveTo}`)
        staged.set(destination, staged.get(target))
        staged.set(target, undefined)
      }
    }
  }

  const changed = [...staged.entries()]
  try {
    for (const [target, content] of changed) {
      if (content === undefined) await unlink(target)
      else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, content, "utf8") }
    }
  } catch (error) {
    for (const [target] of changed) {
      const before = original.get(target)
      if (before === undefined) await unlink(target).catch(() => undefined)
      else await writeFile(target, before, "utf8").catch(() => undefined)
    }
    throw error
  }
  return `已应用 patch（${operations.length} 个文件操作）`
}

type PatchOperation =
  | { kind: "add"; path: string; content: string }
  | { kind: "delete"; path: string }
  | { kind: "update"; path: string; moveTo?: string; hunks: PatchHunk[] }
type PatchHunk = { lines: string[] }

async function readOptionalFile(path: string): Promise<string | undefined> {
  try { return await readFile(path, "utf8") } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
    throw error
  }
}

function applyHunks(content: string, hunks: readonly PatchHunk[], path: string): string {
  const source = content.split(/\r?\n/)
  let offset = 0
  for (const hunk of hunks) {
    const context = hunk.lines.filter((line) => line.startsWith(" ") || line.startsWith("-"))
    const removed = context.filter((line) => line.startsWith(" ") || line.startsWith("-")).map((line) => line.slice(1))
    const start = findSequence(source, removed, offset)
    if (start < 0) throw new Error(`patch 上下文未匹配：${path}`)
    const added = hunk.lines.filter((line) => line.startsWith(" ") || line.startsWith("+")).map((line) => line.slice(1))
    source.splice(start, removed.length, ...added)
    offset = start + added.length
  }
  return source.join("\n")
}

function findSequence(source: readonly string[], wanted: readonly string[], from: number): number {
  for (let index = from; index <= source.length - wanted.length; index += 1) {
    if (wanted.every((line, offset) => source[index + offset] === line)) return index
  }
  return -1
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
function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`工具参数 ${name} 必须是对象。`)
  return value as Record<string, unknown>
}
function stringSchema(description: string): Record<string, unknown> { return { type: "string", description } }
function objectSchema(properties: Record<string, unknown>, required = Object.keys(properties)): Record<string, unknown> { return { type: "object", properties, required, additionalProperties: false } }

interface OpenAiChunk {
  choices?: Array<{ finish_reason?: string | null; delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}
