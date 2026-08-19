import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { ConfigStore } from "./config-store.js"
import { FileSecretStore } from "./secret-store.js"
import { ProfileStore } from "./profile-store.js"
import { NodeWorkspaceHost } from "./workspace-host.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("Node host stores", () => {
  it("persists and merges global configuration atomically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vertex-config-"))
    temporaryDirectories.push(directory)
    const store = new ConfigStore(join(directory, "config.json"))

    await expect(store.get()).resolves.toEqual({})
    await store.set({ currentProfile: "default", mcpEnabled: true })
    await expect(store.set({ commandExecutionTimeout: 30 })).resolves.toMatchObject({ currentProfile: "default", commandExecutionTimeout: 30 })
  })

  it("keeps secrets separate from provider profile metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vertex-profile-"))
    temporaryDirectories.push(directory)
    const profiles = new ProfileStore(join(directory, "profiles.json"))
    const secrets = new FileSecretStore(join(directory, "secrets.json"))

    const profile = await profiles.upsert({ name: "local", provider: "openai", baseUrl: "https://example.test", model: "model", secretKey: "profile-key" })
    await secrets.set(profile.secretKey, "secret-value")

    await expect(profiles.list()).resolves.toHaveLength(1)
    await expect(secrets.get(profile.secretKey)).resolves.toBe("secret-value")
    await expect(profiles.remove(profile.id)).resolves.toBe(true)
  })

  it("loads project rules and rejects paths outside the workspace", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "vertex-workspace-"))
    temporaryDirectories.push(workspace)
    await writeFile(join(workspace, ".rooignore"), "node_modules\n# comment\n*.log\n", "utf8")
    await writeFile(join(workspace, "AGENTS.md"), "优先使用中文总结。", "utf8")
    const host = new NodeWorkspaceHost(workspace)

    await expect(host.loadRules()).resolves.toEqual({ files: [".rooignore", "AGENTS.md"], ignored: ["node_modules", "*.log"], content: "优先使用中文总结。" })
    await expect(host.readText("../outside.txt")).rejects.toThrow("不能离开工作区")
  })
})
