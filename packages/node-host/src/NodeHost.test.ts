import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { BatchApprovalPolicy, FileSessionStore, NodeToolRegistry, PersistentApprovalPolicy, readOpenAiCompatibleConfig } from "./NodeHost.js"
import { ConfigStore } from "./config-store.js"

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

  it("persists explicit always-allow approvals without weakening the default deny policy", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vertex-approval-policy-"))
    temporaryDirectories.push(directory)
    const config = new ConfigStore(join(directory, "config.json"))
    const policy = new PersistentApprovalPolicy(false, config)
    const request = { id: "approval-2", operation: "write_file", description: "write", cwd: directory, risk: "medium" as const }

    expect(await policy.resolve(request, new AbortController().signal)).toBe("deny")
    await policy.allow("write_file")
    expect(await policy.resolve(request, new AbortController().signal)).toBe("always_allow")
    await policy.revoke("write_file")
    expect(await policy.resolve(request, new AbortController().signal)).toBe("deny")
  })

  it("dispatches search, Git and integration tools through injected Node ports", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "vertex-tool-integrations-"))
    temporaryDirectories.push(workspace)
    const calls: string[] = []
    const tools = new NodeToolRegistry(undefined, undefined, {
      search: { search: async () => [{ path: "src/a.ts", line: 3, column: 2, preview: "needle" }] },
      git: {
        status: async () => ({ branch: "main", entries: [] }),
        diff: async () => "diff --git a/a b/a",
        checkpoint: async (_cwd, message) => `checkpoint:${message}`,
        restore: async () => undefined,
        worktree: async (_cwd, path) => path,
      },
      mcp: {
        listServers: async () => [],
        refresh: async () => [],
        callTool: async (server, tool, input) => { calls.push(`${server}/${tool}/${input.value}`); return "mcp output" },
        close: async () => undefined,
      },
      skills: {
        discover: async () => [{ name: "review", description: "review", path: "virtual", source: "project" }],
        read: async () => "# Skill instructions",
      },
    })
    const context = { cwd: workspace, signal: new AbortController().signal }

    await expect(tools.execute({ id: "s", name: "search_files", input: { query: "needle" } }, context)).resolves.toMatchObject({ output: "src/a.ts:3:2: needle" })
    await expect(tools.execute({ id: "d", name: "git_diff", input: {} }, context)).resolves.toMatchObject({ output: "diff --git a/a b/a" })
    await expect(tools.execute({ id: "c", name: "git_checkpoint", input: { message: "save" } }, context)).resolves.toMatchObject({ output: "已创建 checkpoint：checkpoint:save" })
    await expect(tools.execute({ id: "r", name: "git_restore", input: { checkpoint: "checkpoint:save" } }, context)).resolves.toMatchObject({ output: "已恢复到 checkpoint：checkpoint:save" })
    await expect(tools.execute({ id: "w", name: "git_worktree", input: { path: "../outside" } }, context)).rejects.toThrow("不能离开工作区")
    await expect(tools.execute({ id: "m", name: "use_mcp_tool", input: { server: "demo", tool: "echo", input: { value: "ok" } } }, context)).resolves.toMatchObject({ output: "mcp output" })
    await expect(tools.execute({ id: "k", name: "read_skill", input: { name: "review" } }, context)).resolves.toMatchObject({ output: "# Skill instructions" })
    expect(calls).toEqual(["demo/echo/ok"])
  })
})
