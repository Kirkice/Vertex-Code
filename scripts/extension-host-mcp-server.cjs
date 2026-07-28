#!/usr/bin/env node

const path = require("node:path")

// The server is spawned from the temporary workspace, outside the src
// package's pnpm resolution boundary. Resolve the package through the actual
// extension workspace explicitly so the host test is reproducible on Windows.
const sdkRoot = path.join(__dirname, "..", "src", "node_modules", "@modelcontextprotocol", "sdk")
const { McpServer } = require(path.join(sdkRoot, "dist", "cjs", "server", "mcp.js"))
const { StdioServerTransport } = require(path.join(sdkRoot, "dist", "cjs", "server", "stdio.js"))
const { z } = require(path.join(__dirname, "..", "src", "node_modules", "zod"))

const server = new McpServer({ name: "vertex-extension-host-smoke", version: "1.0.0" })

server.registerTool(
	"echo",
	{
		description: "Returns a deterministic smoke-test marker.",
		inputSchema: { value: z.string() },
	},
	async ({ value }) => ({ content: [{ type: "text", text: `mcp:${value}` }] }),
)

const transport = new StdioServerTransport()
server.connect(transport).catch((error) => {
	console.error(error)
	process.exitCode = 1
})
