import * as vscode from "vscode"
import pWaitFor from "p-wait-for"

import { t } from "../../i18n"
import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema } from "@roo-code/types"
import { handleCheckpointRestoreOperation } from "./checkpointRestoreHandler"
import {
	handleListWorktrees,
	handleCreateWorktree,
	handleDeleteWorktree,
	handleSwitchWorktree,
	handleGetAvailableBranches,
	handleGetWorktreeDefaults,
	handleGetWorktreeIncludeStatus,
	handleCheckBranchWorktreeInclude,
	handleCreateWorktreeInclude,
	handleCheckoutBranch,
} from "./worktree"
import type { WebviewHandlerContext } from "./ports"
import type { ClineProvider } from "./ClineProvider"

/** Worktree and checkpoint message boundary. / Worktree 与 checkpoint 消息边界。 */
export async function handleWorktreeCheckpointMessage(context: WebviewHandlerContext): Promise<boolean> {
	const { message } = context
	// Transitional adapter: existing worktree services still depend on the full provider.
	// 过渡适配：现有 worktree service 仍依赖完整 Provider，后续阶段再继续收窄端口。
	const provider = context.provider as ClineProvider
	try {
		switch (message.type) {
			case "checkpointDiff": {
				const result = checkoutDiffPayloadSchema.safeParse(message.payload)
				if (result.success) await (provider.getCurrentTask() as any)?.checkpointDiff(result.data)
				return true
			}
			case "checkpointRestore": {
				const result = checkoutRestorePayloadSchema.safeParse(message.payload)
				if (!result.success) return true
				await provider.cancelTask()
				await pWaitFor(() => provider.getCurrentTask()?.isInitialized === true, { timeout: 3_000 }).catch(() =>
					vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout")),
				)
				await (provider.getCurrentTask() as any)?.checkpointRestore(result.data)
				return true
			}
			case "listWorktrees": {
				const result = await handleListWorktrees(provider)
				await context.postWebviewMessage({ type: "worktreeList", ...result })
				return true
			}
			case "createWorktree": {
				const result = await handleCreateWorktree(
					provider,
					{
						path: message.worktreePath!,
						branch: message.worktreeBranch,
						baseBranch: message.worktreeBaseBranch,
						createNewBranch: message.worktreeCreateNewBranch,
					},
					(progress) =>
						void context.postWebviewMessage({
							type: "worktreeCopyProgress",
							copyProgressBytesCopied: progress.bytesCopied,
							copyProgressItemName: progress.itemName,
						}),
				)
				await context.postWebviewMessage({
					type: "worktreeResult",
					success: result.success,
					text: result.message,
				})
				return true
			}
			case "deleteWorktree": {
				const result = await handleDeleteWorktree(
					provider,
					message.worktreePath!,
					message.worktreeForce ?? false,
				)
				await context.postWebviewMessage({
					type: "worktreeResult",
					success: result.success,
					text: result.message,
				})
				return true
			}
			case "switchWorktree": {
				const result = await handleSwitchWorktree(
					provider,
					message.worktreePath!,
					message.worktreeNewWindow ?? true,
				)
				await context.postWebviewMessage({
					type: "worktreeResult",
					success: result.success,
					text: result.message,
				})
				return true
			}
			case "getAvailableBranches":
				await context.postWebviewMessage({
					type: "branchList",
					...(await handleGetAvailableBranches(provider)),
				})
				return true
			case "getWorktreeDefaults":
				await context.postWebviewMessage({
					type: "worktreeDefaults",
					...(await handleGetWorktreeDefaults(provider)),
				})
				return true
			case "getWorktreeIncludeStatus":
				await context.postWebviewMessage({
					type: "worktreeIncludeStatus",
					worktreeIncludeStatus: await handleGetWorktreeIncludeStatus(provider),
				})
				return true
			case "checkBranchWorktreeInclude":
				await context.postWebviewMessage({
					type: "branchWorktreeIncludeResult",
					branch: message.worktreeBranch,
					hasWorktreeInclude: await handleCheckBranchWorktreeInclude(provider, message.worktreeBranch!),
				})
				return true
			case "createWorktreeInclude": {
				const result = await handleCreateWorktreeInclude(provider, message.worktreeIncludeContent ?? "")
				await context.postWebviewMessage({
					type: "worktreeResult",
					success: result.success,
					text: result.message,
				})
				return true
			}
			case "checkoutBranch": {
				const result = await handleCheckoutBranch(provider, message.worktreeBranch!)
				await context.postWebviewMessage({
					type: "worktreeResult",
					success: result.success,
					text: result.message,
				})
				return true
			}
			case "browseForWorktreePath": {
				const result = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: t("worktrees:selectWorktreeLocation"),
					title: t("worktrees:selectFolderForWorktree"),
				})
				if (result?.[0]) await context.postWebviewMessage({ type: "folderSelected", path: result[0].fsPath })
				return true
			}
			default:
				return false
		}
	} catch (error) {
		provider.log(`Worktree/checkpoint handler failed: ${String(error)}`)
		return true
	}
}
