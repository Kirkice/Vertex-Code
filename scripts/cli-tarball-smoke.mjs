import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"

const artifact = process.argv[2] ?? (await readdir("./.artifacts")).find((file) => file.endsWith(".tgz"))
if (!artifact) throw new Error("未找到 CLI tarball")
const root = await mkdtemp(join(tmpdir(), "vertex-cli-smoke-"))
try {
  await exec(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--ignore-scripts", join(process.cwd(), ".artifacts", artifact)], root)
   const bin = join(root, "node_modules", ".bin", process.platform === "win32" ? "vertex.cmd" : "vertex")
  const result = await exec(bin, ["--version"], root)
  if (!/^\d+\.\d+\.\d+/.test(result.stdout.trim())) throw new Error(`version 输出异常：${result.stdout}`)
  console.log(`CLI tarball smoke passed: ${result.stdout.trim()}`)
} finally {
  await rm(root, { recursive: true, force: true })
}

function exec(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      // Windows .cmd shims are scripts rather than PE executables and must be
      // launched through the shell when invoked by child_process.spawn.
      shell: process.platform === "win32" && command.endsWith(".cmd"),
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.once("error", reject)
    child.once("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} 失败（${code}）：${stderr}`)))
  })
}
