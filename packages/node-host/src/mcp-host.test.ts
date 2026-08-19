import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { NodeMcpHost } from "./mcp-host.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("Node MCP host", () => {
  it("initializes a stdio server, discovers tools, and calls a tool", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vertex-mcp-"))
    temporaryDirectories.push(directory)
    const server = join(directory, "server.cjs")
    const config = join(directory, "mcp.json")
    await writeFile(server, [
      "const readline = require('node:readline')",
      "const rl = readline.createInterface({ input: process.stdin })",
      "rl.on('line', line => {",
      "  const request = JSON.parse(line)",
      "  if (request.method === 'initialize') reply(request.id, { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'mock', version: '1' } })",
      "  if (request.method === 'tools/list') reply(request.id, { tools: [{ name: 'echo', description: 'echo input', inputSchema: { type: 'object' } }] })",
      "  if (request.method === 'tools/call') reply(request.id, { content: [{ type: 'text', text: request.params.arguments.value }] })",
      "})",
      "function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n') }",
    ].join("\n"), "utf8")
    await writeFile(config, JSON.stringify({ mcpServers: { mock: { command: process.execPath, args: [server] } } }), "utf8")

    const host = new NodeMcpHost(config)
    const servers = await host.listServers()
    expect(servers[0]).toMatchObject({ name: "mock", status: "connected", tools: [{ name: "echo" }] })
    await expect(host.callTool("mock", "echo", { value: "hello" })).resolves.toBe("hello")
    await host.close()
  })
})
