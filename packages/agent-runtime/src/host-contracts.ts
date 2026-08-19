/** 平台无关的 Shell 执行请求。 */
export interface ShellExecutionRequest {
  command: string
  cwd: string
  timeoutMs?: number
  signal?: AbortSignal
}

export interface ShellExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
  signal?: string
  timedOut: boolean
  cancelled: boolean
}

export interface ShellHost {
  execute(request: ShellExecutionRequest): Promise<ShellExecutionResult>
}

export interface GitStatusEntry {
  path: string
  index: string
  worktree: string
}

export interface GitStatus {
  branch?: string
  entries: readonly GitStatusEntry[]
}

export interface GitHost {
  status(cwd: string): Promise<GitStatus>
  diff(cwd: string, staged?: boolean): Promise<string>
  checkpoint(cwd: string, message: string): Promise<string>
  restore(cwd: string, checkpoint: string): Promise<void>
  worktree(cwd: string, path: string, ref?: string): Promise<string>
}
