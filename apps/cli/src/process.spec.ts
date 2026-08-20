import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { rooCliStreamEventSchema } from "@roo-code/types"

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url))

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })
    child.once("error", reject)
    child.once("close", (code) => resolve({ code, stdout, stderr }))
  })
}

describe("built CLI process contract", () => {
  it("runs the bundled executable without loading workspace source modules", async () => {
    const result = await runCli(["--help"])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("Vertex CLI")
    expect(result.stderr).toBe("")
  })

  it("keeps every stream-json line schema-valid and returns configuration exit code", async () => {
    const result = await runCli(["--output", "stream-json", "配置检查"])
    const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean)
    expect(lines.length).toBeGreaterThanOrEqual(2)
    for (const line of lines) expect(rooCliStreamEventSchema.safeParse(JSON.parse(line)).success).toBe(true)
    expect(result.code).toBe(4)
    expect(result.stderr).toBe("")
  })
})
