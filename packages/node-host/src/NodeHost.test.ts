import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { BatchApprovalPolicy, FileSessionStore, NodeToolRegistry, readOpenAiCompatibleConfig } from "./NodeHost.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("Node host", () => {
  it("validates provider configuration before network access", () => {
    expect(() => readOpenAiCompatibleConfig({ VERTEX_API_KEY: "key" })).toThrow("VERTEX_BASE_URL")
    expect(readOpenAiCompatibleConfig({ VERTEX_API_KEY: "key", VERTEX_BASE_URL: "https://example.test/", VERTEX_MODEL: "model" })).toEqual({
      apiKey: "key",
      baseUrl: "https://example.test",
      model: "model",
    })
  })

  it("keeps file tools inside the workspace and persists session snapshots", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "vertex-workspace-"))
    const storage = await mkdtemp(join(tmpdir(), "vertex-sessions-"))
    temporaryDirectories.push(workspace, storage)
    const tools = new NodeToolRegistry()

    await tools.execute({ id: "1", name: "write_file", input: { path: "nested/a.txt", content: "hello" } }, { cwd: workspace, signal: new AbortController().signal })
    await expect(tools.execute({ id: "2", name: "read_file", input: { path: "../outside.txt" } }, { cwd: workspace, signal: new AbortController().signal })).rejects.toThrow("不能离开工作区")
    await expect(readFile(join(workspace, "nested/a.txt"), "utf8")).resolves.toBe("hello")

    const store = new FileSessionStore(storage)
    await store.create({ id: "00000000-0000-4000-8000-000000000003", cwd: workspace, prompt: "test", startedAt: new Date(0).toISOString(), events: [], messages: [] })
    await store.appendEvent("00000000-0000-4000-8000-000000000003", { type: "system", content: "saved" })
    await expect(readFile(join(storage, "00000000-0000-4000-8000-000000000003.json"), "utf8")).resolves.toContain("saved")
  })

  it("exposes persisted sessions for listing and latest-session lookup", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vertex-session-list-"))
    try {
      const store = new FileSessionStore(directory)
      await store.create({ id: "old", cwd: directory, prompt: "old", startedAt: "2025-01-01T00:00:00.000Z", events: [], messages: [] })
      await store.create({ id: "new", cwd: directory, prompt: "new", startedAt: "2025-01-02T00:00:00.000Z", events: [], messages: [] })
      expect((await store.list()).map((session) => session.id)).toEqual(["new", "old"])
      expect((await store.findLatest(directory))?.id).toBe("new")
      expect((await store.read("old")).prompt).toBe("old")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it("denies risky operations by default and approves them only in yolo mode", async () => {
    const request = { id: "approval-1", operation: "execute_shell", description: "run", cwd: "/workspace", risk: "high" as const }
    expect(await new BatchApprovalPolicy(false).resolve(request, new AbortController().signal)).toBe("deny")
    expect(await new BatchApprovalPolicy(true).resolve(request, new AbortController().signal)).toBe("approve")
  })
})
