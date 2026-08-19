import type { GitHost, GitStatus, GitStatusEntry } from "@vertex/agent-runtime"

import { NodeProcessHost } from "./process-host.js"

/** 通过 Git CLI 实现 checkpoint、状态和 diff，避免引入平台相关 Git SDK。 */
export class NodeGitHost implements GitHost {
  constructor(private readonly process = new NodeProcessHost()) {}

  async status(cwd: string): Promise<GitStatus> {
    const result = await this.run(cwd, ["status", "--short", "--branch"])
    if (result.exitCode !== 0) throw new Error(result.stderr || "读取 Git 状态失败。")
    const lines = result.stdout.split(/\r?\n/).filter(Boolean)
    const branchLine = lines.find((line) => line.startsWith("## "))
    const entries: GitStatusEntry[] = lines
      .filter((line) => !line.startsWith("## "))
      .map((line) => ({ index: line[0] ?? " ", worktree: line[1] ?? " ", path: line.slice(3).trim() }))
    return { branch: branchLine?.slice(3), entries }
  }

  async diff(cwd: string, staged = false): Promise<string> {
    const result = await this.run(cwd, staged ? ["diff", "--cached"] : ["diff"])
    if (result.exitCode !== 0) throw new Error(result.stderr || "读取 Git diff 失败。")
    return result.stdout
  }

  async checkpoint(cwd: string, message: string): Promise<string> {
    const result = await this.run(cwd, ["add", "--all"])
    if (result.exitCode !== 0) throw new Error(result.stderr || "暂存 checkpoint 文件失败。")
    const commit = await this.run(cwd, ["commit", "-m", message])
    if (commit.exitCode !== 0) throw new Error(commit.stderr || "创建 checkpoint 失败。")
    const head = await this.run(cwd, ["rev-parse", "HEAD"])
    if (head.exitCode !== 0) throw new Error(head.stderr || "读取 checkpoint 标识失败。")
    return head.stdout.trim()
  }

  /** 将工作区恢复到指定 checkpoint；强制模式只影响当前工作树，不修改远端。 */
  async restore(cwd: string, checkpoint: string): Promise<void> {
    const result = await this.run(cwd, ["reset", "--hard", checkpoint])
    if (result.exitCode !== 0) throw new Error(result.stderr || "恢复 Git checkpoint 失败。")
  }

  /** 创建独立 worktree，并返回 Git 实际解析后的路径。 */
  async worktree(cwd: string, path: string, ref = "HEAD"): Promise<string> {
    const result = await this.run(cwd, ["worktree", "add", path, ref])
    if (result.exitCode !== 0) throw new Error(result.stderr || "创建 Git worktree 失败。")
    return path
  }

  private async run(cwd: string, args: readonly string[]) {
    return this.process.execute({ command: ["git", ...args].map(quote).join(" "), cwd })
  }
}

function quote(value: string): string {
  return process.platform === "win32" ? `"${value.replaceAll('"', '\\"')}"` : `'${value.replaceAll("'", "'\\''")}'`
}
