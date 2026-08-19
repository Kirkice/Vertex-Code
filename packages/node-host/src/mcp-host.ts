import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { readFile } from "node:fs/promises"

import type { McpHost } from "@vertex/agent-runtime"
import type { McpServer, McpTool } from "@roo-code/types"

import { resolveVertexPaths } from "./paths.js"

interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>
}

interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  disabled?: boolean
  timeout?: number
}

interface JsonRpcMessage {
  jsonrpc: "2.0"
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { code: number; message: string; data?: unknown }
}

interface McpProcess {
  child: ChildProcessWithoutNullStreams
  buffer: string
  nextId: number
  pending: Map<number, { resolve: (message: JsonRpcMessage) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>
}

/**
 * Node 原生 MCP stdio 客户端。
 *
 * MCP 的 stdout 是严格的 JSON-RPC 通道，因此不能把调试信息写入 stdout。
 * 每个 server 都维护独立的行缓冲区和 request map，响应乱序时仍能正确归属。
 */
export class NodeMcpHost implements McpHost {
  private readonly processes = new Map<string, McpProcess>()
  private servers: McpServer[] = []

  constructor(private readonly configPath = resolveVertexPaths().mcp) {}

  async listServers(): Promise<readonly McpServer[]> {
    if (this.servers.length === 0) await this.refresh()
    return this.servers
  }

  async refresh(): Promise<readonly McpServer[]> {
    const config = await this.readConfig()
    await this.close()
    const next: McpServer[] = []

    for (const [name, definition] of Object.entries(config.mcpServers ?? {})) {
      if (definition.disabled) continue
      try {
        const process = this.startProcess(definition)
        this.processes.set(name, process)
        await this.initialize(process, definition.timeout ?? 10_000)
        const tools = await this.listTools(process, definition.timeout ?? 10_000)
        next.push({
          name,
          config: JSON.stringify(definition),
          status: "connected",
          source: "global",
          tools,
        })
      } catch (error) {
        const process = this.processes.get(name)
        if (process) await this.closeProcess(process)
        this.processes.delete(name)
        next.push({
          name,
          config: JSON.stringify(definition),
          status: "disconnected",
          source: "global",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    this.servers = next
    return next
  }

  async callTool(server: string, tool: string, input: Record<string, unknown>): Promise<string> {
    if (!this.processes.has(server)) await this.refresh()
    const process = this.processes.get(server)
    if (!process) throw new Error(`MCP Server 不存在或未启用：${server}`)

    const response = await this.request(process, "tools/call", {
      name: tool,
      arguments: input,
    })
    const content = response.result?.content
    if (Array.isArray(content)) {
      return content.map((item) => {
        if (typeof item === "object" && item !== null && "text" in item) return String(item.text)
        return JSON.stringify(item)
      }).join("\n")
    }
    return JSON.stringify(response.result ?? {})
  }

  async close(): Promise<void> {
    const processes = [...this.processes.values()]
    this.processes.clear()
    this.servers = []
    await Promise.all(processes.map((process) => this.closeProcess(process)))
  }

  private startProcess(definition: McpServerConfig): McpProcess {
    const child = spawn(definition.command, definition.args ?? [], {
      // MCP 配置已经把可执行文件和参数分开保存；这里不再经过 shell，
      // 避免 Windows 路径、引号和参数注入问题。
      shell: false,
      env: { ...globalThis.process.env, ...definition.env },
      windowsHide: true,
      stdio: "pipe",
    })
    const process: McpProcess = { child, buffer: "", nextId: 1, pending: new Map() }
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => this.consume(process, chunk))
    child.on("error", (error) => this.rejectPending(process, error))
    child.on("close", (code) => this.rejectPending(process, new Error(`MCP Server 已退出（${code ?? "unknown"}）。`)))
    return process
  }

  private async initialize(process: McpProcess, timeoutMs: number): Promise<void> {
    await this.request(process, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vertex", version: "0.1.0" },
    }, timeoutMs)
    this.write(process, { jsonrpc: "2.0", method: "notifications/initialized", params: {} })
  }

  private async listTools(process: McpProcess, timeoutMs: number): Promise<McpTool[]> {
    const response = await this.request(process, "tools/list", {}, timeoutMs)
    const tools = response.result?.tools
    if (!Array.isArray(tools)) return []
    return tools.filter((tool): tool is McpTool => typeof tool === "object" && tool !== null && "name" in tool).map((tool) => ({
      name: String(tool.name),
      description: typeof tool.description === "string" ? tool.description : undefined,
      inputSchema: typeof tool.inputSchema === "object" && tool.inputSchema !== null ? tool.inputSchema : undefined,
    }))
  }

  private request(process: McpProcess, method: string, params: Record<string, unknown>, timeoutMs = 10_000): Promise<JsonRpcMessage> {
    const id = process.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        process.pending.delete(id)
        reject(new Error(`MCP 请求超时：${method}`))
      }, timeoutMs)
      process.pending.set(id, { resolve, reject, timer })
      this.write(process, { jsonrpc: "2.0", id, method, params })
    })
  }

  private write(process: McpProcess, message: JsonRpcMessage): void {
    process.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private consume(process: McpProcess, chunk: string): void {
    process.buffer += chunk
    const lines = process.buffer.split(/\r?\n/)
    process.buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      let message: JsonRpcMessage
      try {
        message = JSON.parse(line) as JsonRpcMessage
      } catch {
        continue
      }
      if (message.id === undefined) continue
      const pending = process.pending.get(message.id)
      if (!pending) continue
      clearTimeout(pending.timer)
      process.pending.delete(message.id)
      if (message.error) pending.reject(new Error(`MCP ${message.error.code}: ${message.error.message}`))
      else pending.resolve(message)
    }
  }

  private rejectPending(process: McpProcess, error: Error): void {
    for (const pending of process.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    process.pending.clear()
  }

  private async closeProcess(process: McpProcess): Promise<void> {
    this.rejectPending(process, new Error("MCP Server 已关闭。"))
    if (process.child.exitCode !== null) return
    process.child.kill()
    await new Promise<void>((resolve) => process.child.once("close", () => resolve()))
  }

  private async readConfig(): Promise<McpConfig> {
    try {
      return JSON.parse(await readFile(this.configPath, "utf8")) as McpConfig
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return {}
      throw error
    }
  }
}
