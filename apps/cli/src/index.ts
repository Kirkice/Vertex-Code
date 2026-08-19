import { access } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { randomUUID } from "node:crypto"

import { rooCliExitCodes } from "@roo-code/types"
import {
  ConfigStore,
  FileSecretStore,
  FileSessionStore,
  NodeAuthHost,
  NodeMcpHost,
  NodeSkillsHost,
  ProfileStore,
} from "@vertex/node-host"

import { CliCommandError, invalidArgument } from "./feature.js"
import { createRenderer } from "./renderer.js"
import {
  parseOutputFormat,
  validateEvent,
  validateFinalOutput,
  type CliFinalOutput,
  type CliOutputFormat,
} from "./protocol.js"
import { createFinalOutput, runHeadlessSession } from "./session.js"
import { runTui } from "./tui/controller.js"

const VERSION = "0.1.0"

const usage = `Vertex CLI ${VERSION}

用法:
  vertex run <任务描述> [--cwd <目录>] [--output text|json|stream-json] [--yolo]
  vertex <任务描述> [--cwd <目录>] [--output text|json|stream-json] [--yolo]
  vertex doctor [--output text|json|stream-json]
  vertex auth [status|profiles|add|set|clear] [参数]
  vertex config [get|set] [参数]
  vertex mcp [list|refresh]
  vertex resume [sessionId]
  vertex --help
  vertex --version

退出码:
  0 成功；1 运行时错误；2 功能后端尚未迁移；3 已取消；4 配置错误；5 审批拒绝。

说明:
  当前版本提供 CLI 协议、命令入口和 headless runtime 桥接。
  auth、config、mcp、resume 使用 Node Host 持久化与进程能力。
`

interface ParsedArguments {
  command: "run" | "doctor" | "auth" | "config" | "mcp" | "resume" | "interactive"
  cwd: string
  format: CliOutputFormat
  prompt?: string
  yolo: boolean
}

function fail(message: string): never {
  return invalidArgument(message)
}

export function parseArguments(argv: string[]): ParsedArguments {
  const values: string[] = []
  let cwd = process.cwd()
  let output: string | undefined
  let yolo = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === undefined) continue

    if (argument === "--cwd") {
      const value = argv[++index]
      if (!value) fail("--cwd 需要一个目录参数")
      cwd = path.resolve(value)
      continue
    }

    if (argument === "--output") {
      const value = argv[++index]
      if (!value) fail("--output 需要 text、json 或 stream-json")
      output = value
      continue
    }

    if (argument === "--yolo") {
      yolo = true
      continue
    }

    if (argument.startsWith("--")) fail(`未知选项: ${argument}`)
    values.push(argument)
  }

  let format: CliOutputFormat
  try {
    format = parseOutputFormat(output)
  } catch {
    fail("--output 需要 text、json 或 stream-json")
  }
  const [first, ...rest] = values

  if (first === "doctor") {
    if (rest.length > 0) fail("doctor 不接受位置参数")
    if (yolo) fail("--yolo 不适用于 doctor")
    return { command: "doctor", cwd, format, yolo }
  }

  if (first === "auth" || first === "config" || first === "mcp" || first === "resume") {
    if (yolo) fail(`--yolo 不适用于 ${first}`)
    return { command: first, cwd, format, prompt: rest.join(" ").trim() || undefined, yolo }
  }

  if (first === "run") {
    const prompt = rest.join(" ").trim()
    if (!prompt) fail("run 需要任务描述")
    return { command: "run", cwd, format, prompt, yolo }
  }

  if (values.length > 0) {
    return { command: "run", cwd, format, prompt: values.join(" "), yolo }
  }

  if (yolo) fail("--yolo 需要与任务一起使用")
  return { command: "interactive", cwd, format, yolo }
}

async function runDoctor(cwd: string, format: CliOutputFormat): Promise<number> {
  const renderer = createRenderer(format, process.stdout)
  const auth = new NodeAuthHost()
  const skills = new NodeSkillsHost()
  const mcp = new NodeMcpHost()
  const checks = [
    { name: "node", ok: Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10) >= 20 },
    {
      name: "workspace",
      ok: await access(cwd).then(() => true).catch(() => false),
    },
    {
      name: "auth",
      ok: (await auth.status()).configured,
    },
    {
      name: "skills",
      ok: true,
      detail: `发现 ${(await skills.discover(cwd)).length} 个技能`,
    },
    {
      name: "mcp",
      ok: true,
      detail: `发现 ${(await mcp.listServers()).length} 个 MCP Server`,
    },
  ]
  await mcp.close()
  const events = checks.map((check) =>
    validateEvent({
      type: "system",
      subtype: "doctor_check",
      success: check.ok,
      content: `${check.name}: ${check.ok ? "ok" : "failed"}${check.detail ? ` (${check.detail})` : ""}`,
    }),
  )

  for (const event of events) renderer.emit(event)

  const success = checks.every((check) => check.ok)
  const output = validateFinalOutput({
    type: "result",
    success,
    content: success ? "doctor 检查通过" : "doctor 检查失败",
    events,
  })
  renderer.finish(output)
  return success ? 0 : 1
}

async function runTask(prompt: string, cwd: string, format: CliOutputFormat, yolo: boolean): Promise<number> {
  return runTaskWithOptions({ prompt, cwd, format, yolo })
}

interface TaskRunOptions {
  prompt: string
  cwd: string
  format: CliOutputFormat
  yolo: boolean
  sessionId?: string
  initialMessages?: import("@vertex/agent-runtime").AgentMessage[]
}

async function runTaskWithOptions(options: TaskRunOptions): Promise<number> {
  const { prompt, cwd, format, yolo } = options
  const renderer = createRenderer(format, process.stdout)
  const events: ReturnType<typeof validateEvent>[] = []
  const controller = new AbortController()

  // SIGINT 必须同时取消模型流、审批等待和 Shell 子进程。
  // 这里不直接 process.exit，确保 runtime 有机会写入最终会话快照。
  const onSigint = () => controller.abort("用户按下 Ctrl+C")
  process.once("SIGINT", onSigint)

  try {
    for await (const event of runHeadlessSession({
      cwd,
      prompt,
      yolo,
      signal: controller.signal,
      sessionId: options.sessionId,
      initialMessages: options.initialMessages,
    })) {
      const validEvent = validateEvent(event)
      events.push(validEvent)
      renderer.emit(validEvent)
    }
  } catch (error) {
    // 配置解析发生在会话创建前，无法由 AgentSession 产生 error 事件；
    // CLI 仍然必须输出统一的最终结果，而不能让异常污染机器消费协议。
    const code = controller.signal.aborted ? "CANCELLED" : isConfigurationError(error) ? "CONFIGURATION_ERROR" : "RUNTIME_ERROR"
    const event = validateEvent({
      type: "error",
      code,
      sessionId: randomUUID(),
      content: error instanceof Error ? error.message : String(error),
    })
    events.push(event)
    renderer.emit(event)
    // 即使运行时在创建会话前失败，stream-json 也必须以一个 result 事件收尾。
    // 这样调用方无需根据“是否收到 error”猜测任务是否已经结束。
    const result = validateEvent({
      type: "result",
      done: true,
      success: false,
      code,
      sessionId: event.sessionId,
      content: event.content,
    })
    events.push(result)
    renderer.emit(result)
  } finally {
    // 无论 renderer 或 runtime 是否抛出异常，都必须移除本次命令注册的信号监听器。
    process.off("SIGINT", onSigint)
  }

  const output = validateFinalOutput(createFinalOutput(events))
  renderer.finish(output)
  return exitCodeForOutput(output)
}

function isConfigurationError(error: unknown): boolean {
  return error instanceof Error && /配置|VERTEX_API_KEY|VERTEX_BASE_URL|VERTEX_MODEL/i.test(error.message)
}

function exitCodeForOutput(output: CliFinalOutput): number {
  if (output.success) return 0
  if (output.code === "CANCELLED") return rooCliExitCodes.CANCELLED
  if (output.code === "APPROVAL_DENIED") return rooCliExitCodes.APPROVAL_DENIED
  if (output.code === "CONFIGURATION_ERROR" || output.code === "INVALID_ARGUMENT") return rooCliExitCodes.CONFIGURATION_ERROR
  return rooCliExitCodes.RUNTIME_ERROR
}

async function runAuth(prompt: string | undefined, format: CliOutputFormat): Promise<number> {
  const renderer = createRenderer(format, process.stdout)
  const auth = new NodeAuthHost()
  const profiles = new ProfileStore()
  const secrets = new FileSecretStore()
  const config = new ConfigStore()
  const [action = "status", ...arguments_] = splitCommand(prompt)
  let content: string

  if (action === "status") {
    content = JSON.stringify(await auth.status())
  } else if (action === "profiles") {
    content = JSON.stringify(await profiles.list())
  } else if (action === "add") {
    const [name, baseUrl, model, apiKey] = arguments_
    if (!name || !baseUrl || !model || !apiKey) invalidArgument("auth add 需要：名称、baseUrl、model、apiKey")
    const profile = await profiles.upsert({ name, provider: "openai-compatible", baseUrl, model, secretKey: `profile:${name}` })
    await secrets.set(profile.secretKey, apiKey)
    await config.set({ currentProfile: profile.id })
    content = JSON.stringify({ profileId: profile.id, configured: true, selected: true })
  } else if (action === "set") {
    const [profileId, apiKey] = arguments_
    if (!profileId || !apiKey) invalidArgument("auth set 需要：profileId、apiKey")
    await auth.setApiKey(profileId, apiKey)
    content = JSON.stringify({ profileId, configured: true })
  } else if (action === "clear") {
    const [profileId] = arguments_
    if (!profileId) invalidArgument("auth clear 需要 profileId")
    await auth.clear(profileId)
    content = JSON.stringify({ profileId, configured: false })
  } else {
    invalidArgument(`未知 auth 子命令：${action}`)
  }

  const event = validateEvent({ type: "system", subtype: "auth", success: true, content })
  renderer.emit(event)
  renderer.finish(validateFinalOutput({ type: "result", success: true, content, events: [event] }))
  return 0
}

async function runConfig(prompt: string | undefined, format: CliOutputFormat): Promise<number> {
  const renderer = createRenderer(format, process.stdout)
  const store = new ConfigStore()
  const [action = "get", key, ...values] = splitCommand(prompt)
  let content: string
  if (action === "get") {
    const config = await store.get()
    content = JSON.stringify(key ? { [key]: config[key] } : config)
  } else if (action === "set") {
    if (!key || values.length === 0) invalidArgument("config set 需要：键、JSON 值")
    const raw = values.join(" ")
    let value: unknown
    try { value = JSON.parse(raw) } catch { value = raw }
    content = JSON.stringify(await store.set({ [key]: value }))
  } else {
    invalidArgument(`未知 config 子命令：${action}`)
  }
  const event = validateEvent({ type: "system", subtype: "config", success: true, content })
  renderer.emit(event)
  renderer.finish(validateFinalOutput({ type: "result", success: true, content, events: [event] }))
  return 0
}

async function runMcp(prompt: string | undefined, format: CliOutputFormat): Promise<number> {
  const renderer = createRenderer(format, process.stdout)
  const host = new NodeMcpHost()
  const [action = "list"] = splitCommand(prompt)
  if (action !== "list" && action !== "refresh") invalidArgument(`未知 mcp 子命令：${action}`)
  const servers = action === "refresh" ? await host.refresh() : await host.listServers()
  const event = validateEvent({ type: "system", subtype: "mcp_list", success: true, content: JSON.stringify(servers) })
  renderer.emit(event)
  await host.close()
  renderer.finish(validateFinalOutput({ type: "result", success: true, content: `mcp ${action}`, events: [event] }))
  return 0
}

/** 简单 shell 风格分词；密钥带空格时必须使用双引号。 */
function splitCommand(value: string | undefined): string[] {
  if (!value) return []
  return value.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((item) => item.replace(/^"|"$/g, "")) ?? []
}

async function runResume(cwd: string, sessionId: string | undefined, format: CliOutputFormat): Promise<number> {
  const store = new FileSessionStore()
  const session = sessionId ? await store.read(sessionId) : await store.findLatest(cwd)
  if (!session) {
    const renderer = createRenderer(format, process.stdout)
    const content = "没有找到可恢复的会话。"
    const event = validateEvent({ type: "system", subtype: "resume", success: false, content })
    renderer.emit(event)
    renderer.finish(validateFinalOutput({ type: "result", success: false, code: "RUNTIME_ERROR", content, events: [event] }))
    return rooCliExitCodes.RUNTIME_ERROR
  }

  // resume 使用持久化消息继续请求模型，而不是重新拼接原始 prompt。
  return runTaskWithOptions({
    prompt: session.prompt,
    cwd: session.cwd,
    format,
    yolo: false,
    sessionId: session.id,
    initialMessages: session.messages,
  })
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(usage)
    return 0
  }

  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${VERSION}\n`)
    return 0
  }

  const args = parseArguments(argv)
  if (args.command === "doctor") return runDoctor(args.cwd, args.format)
  if (args.command === "auth") return runAuth(args.prompt, args.format)
  if (args.command === "config") return runConfig(args.prompt, args.format)
  if (args.command === "mcp") return runMcp(args.prompt, args.format)
  if (args.command === "resume") return runResume(args.cwd, args.prompt, args.format)

  if (args.command === "interactive") return runTui(args.cwd)

  return runTask(args.prompt ?? "", args.cwd, args.format, args.yolo)
}

function isEntrypoint(): boolean {
  const entryPath = process.argv[1]
  return entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href
}

if (isEntrypoint()) {
  void main().then(
    (exitCode) => {
      process.exitCode = exitCode
    },
    (error: unknown) => {
      if (error instanceof CliCommandError) {
        process.stderr.write(`${error.code}: ${error.message}\n`)
        process.exitCode = error.exitCode
        return
      }

      process.stderr.write(`RUNTIME_ERROR: ${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = rooCliExitCodes.RUNTIME_ERROR
    },
  )
}
