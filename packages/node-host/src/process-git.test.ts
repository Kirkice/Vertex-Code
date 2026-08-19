import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { NodeGitHost } from "./git-host.js"
import { NodeProcessHost } from "./process-host.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("Node process and Git hosts", () => {
  it("executes commands and exposes stdout/exit code", async () => {
    const host = new NodeProcessHost()
    const command = process.platform === "win32" ? "echo vertex" : "printf vertex"
    await expect(host.execute({ command, cwd: process.cwd() })).resolves.toMatchObject({ stdout: expect.stringContaining("vertex"), exitCode: 0, timedOut: false, cancelled: false })
  })

  it("marks a timed-out command and a cancelled command", async () => {
    const host = new NodeProcessHost()
    const sleep = process.platform === "win32" ? "ping 127.0.0.1 -n 6 > nul" : "sleep 2"
    await expect(host.execute({ command: sleep, cwd: process.cwd(), timeoutMs: 20 })).resolves.toMatchObject({ timedOut: true })
    const controller = new AbortController()
    const pending = host.execute({ command: sleep, cwd: process.cwd(), signal: controller.signal })
    controller.abort()
    await expect(pending).resolves.toMatchObject({ cancelled: true })
  })

  it("reads Git status and diff in a temporary repository", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vertex-git-"))
    temporaryDirectories.push(directory)
    const processHost = new NodeProcessHost()
    const run = (command: string) => processHost.execute({ command, cwd: directory })
    await run("git init")
    await run("git config user.email vertex@example.test")
    await run("git config user.name vertex")
    await writeFile(join(directory, "file.txt"), "changed\n", "utf8")
    const git = new NodeGitHost(processHost)

    await expect(git.status(directory)).resolves.toMatchObject({ entries: [{ path: "file.txt" }] })
    await expect(git.diff(directory)).resolves.toBe("")
  })

  it("creates a checkpoint, restores it, and creates a worktree", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vertex-git-checkpoint-"))
    const worktree = await mkdtemp(join(tmpdir(), "vertex-git-worktree-"))
    temporaryDirectories.push(directory, worktree)
    const processHost = new NodeProcessHost()
    const run = (command: string) => processHost.execute({ command, cwd: directory })
    await run("git init")
    await run("git config user.email vertex@example.test")
    await run("git config user.name vertex")
    await writeFile(join(directory, "file.txt"), "before\n", "utf8")
    const git = new NodeGitHost(processHost)
    const checkpoint = await git.checkpoint(directory, "initial checkpoint")
    await writeFile(join(directory, "file.txt"), "after\n", "utf8")
    await git.restore(directory, checkpoint)
    await expect(run("git show HEAD:file.txt")).resolves.toMatchObject({ stdout: expect.stringContaining("before") })
    await expect(git.worktree(directory, worktree, checkpoint)).resolves.toBe(worktree)
  })
})
