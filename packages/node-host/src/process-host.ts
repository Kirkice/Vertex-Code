import { spawn } from "node:child_process"

import type { ShellExecutionRequest, ShellExecutionResult, ShellHost } from "@vertex/agent-runtime"

/**
 * 跨平台 Shell Host。
 *
 * Node 的 shell=true 会使用 Windows 的 cmd.exe 或 Unix 的默认 shell，保持与用户
 * 在终端中输入命令时相近的行为。超时和取消都会主动终止子进程，避免 Agent 永久等待。
 */
export class NodeProcessHost implements ShellHost {
  execute(request: ShellExecutionRequest): Promise<ShellExecutionResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(request.command, { cwd: request.cwd, shell: true, windowsHide: true })
      let stdout = ""
      let stderr = ""
      let timedOut = false
      let cancelled = false
      let settled = false

      const terminate = (reason: "timeout" | "cancel") => {
        if (reason === "timeout") timedOut = true
        else cancelled = true
        // Windows 的 shell=true 会多一层 cmd.exe；优先使用 taskkill 清理整棵进程树。
        if (process.platform === "win32" && child.pid) {
          spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true })
        } else {
          child.kill()
        }
      }
      const timer = request.timeoutMs && request.timeoutMs > 0 ? setTimeout(() => terminate("timeout"), request.timeoutMs) : undefined
      const abort = () => terminate("cancel")
      request.signal?.addEventListener("abort", abort, { once: true })
      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })
      child.once("error", (error) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        request.signal?.removeEventListener("abort", abort)
        reject(error)
      })
      child.once("close", (exitCode, signal) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        request.signal?.removeEventListener("abort", abort)
        resolve({ stdout, stderr, exitCode: exitCode ?? 1, signal: signal ?? undefined, timedOut, cancelled })
      })
    })
  }
}
