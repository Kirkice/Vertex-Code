import type { RooCliApprovalDecision, RooCliApprovalRequest } from "@roo-code/types"

import type { InteractiveApprovalResolver } from "./contracts.js"

interface PendingApproval {
  resolve(decision: RooCliApprovalDecision): void
  reject(reason: unknown): void
}

/**
 * UI 无关的审批桥接器。运行时在 `resolve` 处暂停，TUI 从键盘输入中调用
 * `decide` 继续会话；因此审批无需耦合 stdout、Ink 或任何编辑器 API。
 */
export class DeferredApprovalResolver implements InteractiveApprovalResolver {
  private readonly pending = new Map<string, PendingApproval>()

  resolve(request: RooCliApprovalRequest, signal: AbortSignal): Promise<RooCliApprovalDecision> {
    if (signal.aborted) return Promise.reject(new Error("任务已取消。"))
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.pending.delete(request.id)
        reject(new Error("任务已取消。"))
      }
      signal.addEventListener("abort", abort, { once: true })
      this.pending.set(request.id, {
        resolve: (decision) => {
          signal.removeEventListener("abort", abort)
          resolve(decision)
        },
        reject: (reason) => {
          signal.removeEventListener("abort", abort)
          reject(reason)
        },
      })
    })
  }

  decide(requestId: string, decision: RooCliApprovalDecision): boolean {
    const pending = this.pending.get(requestId)
    if (!pending) return false
    this.pending.delete(requestId)
    pending.resolve(decision)
    return true
  }

  cancelPending(reason: unknown = new Error("审批已取消。")): void {
    for (const pending of this.pending.values()) pending.reject(reason)
    this.pending.clear()
  }
}
