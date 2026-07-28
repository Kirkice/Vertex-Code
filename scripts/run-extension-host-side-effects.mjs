import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const testElectron = path.join(repoRoot, "src", "node_modules", "@vscode", "test-electron")
const { runTests } = createRequire(import.meta.url)(testElectron)
const vscodeExecutablePath = path.join(repoRoot, ".vscode-test", "vscode-win32-x64-archive-1.128.0", "Code.exe")

// This workspace is often opened from an Electron/Node shell where the
// environment sets ELECTRON_RUN_AS_NODE=1. That flag turns Code.exe into a
// Node interpreter and produces the misleading "bad option" failure.
delete process.env.ELECTRON_RUN_AS_NODE

if (!(await fs.stat(vscodeExecutablePath).catch(() => undefined))) {
	throw new Error(`VS Code archive not found: ${vscodeExecutablePath}`)
}

const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "vertex-extension-host-smoke-"))
const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "vertex-extension-host-user-data-"))
const mcpConfigPath = path.join(workspacePath, ".roo", "mcp.json")
const mcpServerPath = path.join(repoRoot, "scripts", "extension-host-mcp-server.cjs")

try {
	await fs.mkdir(path.dirname(mcpConfigPath), { recursive: true })
	await fs.writeFile(
		mcpConfigPath,
		JSON.stringify(
			{
				mcpServers: {
					"host-smoke": {
						type: "stdio",
						command: process.execPath,
						args: [mcpServerPath],
					},
				},
			},
			null,
			2,
		),
	)
	execFileSync("git", ["init", "--quiet", workspacePath], { stdio: "ignore" })
	await fs.writeFile(path.join(workspacePath, ".gitignore"), "extension-host-smoke/\n")

	const exitCode = await runTests({
		vscodeExecutablePath,
		extensionDevelopmentPath: path.join(repoRoot, "src"),
		extensionTestsPath: path.join(repoRoot, "scripts", "extension-host-side-effects.test.js"),
		extensionTestsEnv: {
			VERTEX_EXTENSION_HOST_SMOKE: "1",
			NODE_ENV: "production",
		},
		launchArgs: [
			`--folder-uri=file:///${workspacePath.replaceAll("\\", "/")}`,
			"--disable-gpu",
			"--disable-workspace-trust",
			`--user-data-dir=${userDataPath}`,
		],
	})

	if (exitCode !== 0) {
		process.exitCode = exitCode
	}
} finally {
	await fs.rm(workspacePath, { recursive: true, force: true })
	await fs.rm(userDataPath, { recursive: true, force: true })
}
