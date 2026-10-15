import { randomUUID } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { NodeGitHost } from "./git-host.js"
import { NodeProcessHost } from "./process-host.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  // Windows 上 Git 与 shell 子进程退出后，文件句柄的释放可能晚于 close 事件。
  // 采用 Node 内建重试避免临时目录清理与下一轮集成测试发生偶发竞争。
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
    ),
  )
})

describe("Node process and Git hosts", () => {
  it("executes commands and exposes stdout/exit code", async () => {
    const host = new NodeProcessHost()
    const command = process.platform === "win32" ? "echo vertex" : "printf vertex"
    await expect(host.execute({ command, cwd: process.cwd() })).resolves.toMatchObject({ stdout: expect.stringContaining("vertex"), exitCode: 0, timedOut: false, cancelled: false })
  })

  // CI/全仓并行测试会显著延迟 Windows 的 cmd/taskkill 调度；该用例验证的是终止语义，
  // 因此为真实进程清理保留足够时间，避免机器负载导致的伪失败。
  it("marks a timed-out command and a cancelled command", async () => {
    const host = new NodeProcessHost()
    const sleep = process.platform === "win32" ? "ping 127.0.0.1 -n 6 > nul" : "sleep 2"
    await expect(host.execute({ command: sleep, cwd: process.cwd(), timeoutMs: 20 })).resolves.toMatchObject({ timedOut: true })
    const controller = new AbortController()
    const pending = host.execute({ command: sleep, cwd: process.cwd(), signal: controller.signal })
    controller.abort()
    await expect(pending).resolves.toMatchObject({ cancelled: true })
  }, 15_000)

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
    // git worktree add 应自行创建目标目录。预创建空目录在 Windows Git 下会产生
    // 不必要的路径校验/句柄竞争，因此只生成唯一但尚不存在的兄弟路径。
    const worktree = join(tmpdir(), `vertex-git-worktree-${randomUUID()}`)
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
  }, 15_000)
})
