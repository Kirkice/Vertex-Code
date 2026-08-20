import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadWorkspaceModes, resolveWorkspaceMode } from "./mode-loader.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => (await import("node:fs/promises")).rm(directory, { recursive: true, force: true })))
})

describe("workspace mode loader", () => {
  it("loads built-in modes when the workspace has no .roomodes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vertex-modes-"))
    temporaryDirectories.push(cwd)
    expect((await loadWorkspaceModes(cwd)).some((mode) => mode.slug === "code")).toBe(true)
  })

  it("lets .roomodes override defaults and compiles groups into an executable allowlist", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "vertex-modes-"))
    temporaryDirectories.push(cwd)
    await writeFile(join(cwd, ".roomodes"), ["customModes:", "  - slug: code", "    name: Restricted", "    roleDefinition: Read only", "    groups:", "      - read"].join("\n"))

    const mode = await resolveWorkspaceMode(cwd, "code", "项目规则")
    expect(mode.name).toBe("Restricted")
    expect(mode.allowedTools).toContain("read_file")
    expect(mode.allowedTools).not.toContain("write_file")
    expect(mode.customInstructions).toBe("项目规则")
  })
})
