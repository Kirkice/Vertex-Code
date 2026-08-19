import { access } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { rooCliExitCodes } from "@roo-code/types"
import {
  ConfigStore,
  FileSessionStore,
  NodeAuthHost,
  NodeMcpHost,
  NodeSkillsHost,
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
  vertex auth|config|mcp|resume [参数]
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
  const renderer = createRenderer(format, process.stdout)
  const events = []

  for await (const event of runHeadlessSession({ cwd, prompt, yolo })) {
    const validEvent = validateEvent(event)
    events.push(validEvent)
    renderer.emit(validEvent)
  }

  const output = validateFinalOutput(createFinalOutput(events))
  renderer.finish(output)
  return exitCodeForOutput(output)
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
  const status = await auth.status()
  const event = validateEvent({ type: "system", subtype: "auth_status", success: status.configured, content: JSON.stringify(status) })
  renderer.emit(event)
  renderer.finish(validateFinalOutput({ type: "result", success: true, content: prompt ? `auth: ${prompt}` : "auth status", events: [event] }))
  return 0
}

async function runConfig(prompt: string | undefined, format: CliOutputFormat): Promise<number> {
  const renderer = createRenderer(format, process.stdout)
  const store = new ConfigStore()
  const config = await store.get()
  const event = validateEvent({ type: "system", subtype: "config", success: true, content: JSON.stringify(config) })
  renderer.emit(event)
  renderer.finish(validateFinalOutput({ type: "result", success: true, content: prompt ? `config: ${prompt}` : "config get", events: [event] }))
  return 0
}

async function runMcp(prompt: string | undefined, format: CliOutputFormat): Promise<number> {
  const renderer = createRenderer(format, process.stdout)
  const host = new NodeMcpHost()
  const servers = await host.listServers()
  const event = validateEvent({ type: "system", subtype: "mcp_list", success: true, content: JSON.stringify(servers) })
  renderer.emit(event)
  await host.close()
  renderer.finish(validateFinalOutput({ type: "result", success: true, content: prompt ? `mcp: ${prompt}` : "mcp list", events: [event] }))
  return 0
}

async function runResume(cwd: string, sessionId: string | undefined, format: CliOutputFormat): Promise<number> {
  const renderer = createRenderer(format, process.stdout)
  const store = new FileSessionStore()
  const session = sessionId ? await store.read(sessionId) : await store.findLatest(cwd)
  const content = session
    ? JSON.stringify({ id: session.id, cwd: session.cwd, prompt: session.prompt, startedAt: session.startedAt, finishedAt: session.finishedAt, success: session.success, code: session.code })
    : "没有找到可恢复的会话。"
  const event = validateEvent({ type: "system", subtype: "resume", success: Boolean(session), content })
  renderer.emit(event)
  renderer.finish(validateFinalOutput({ type: "result", success: Boolean(session), content, sessionId: session?.id, events: [event] }))
  return session ? 0 : rooCliExitCodes.RUNTIME_ERROR
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
