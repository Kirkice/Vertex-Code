import type { WebviewHandlerContext } from "./ports"

/**
 * Handle mode/profile routing toggles.
 *
 * 目的 / Purpose:
 * Keep Mode-Level LLM routing state transitions in one place so the migration
 * from legacy workspace flag to explicit routing flag becomes auditable.
 * 将 Mode 路由相关开关集中处理，便于后续删除旧兼容逻辑。
 */
export async function handleModeRoutingMessage(context: WebviewHandlerContext): Promise<boolean> {
	const { provider, message } = context

	switch (message.type) {
		case "lockApiConfigAcrossModes": {
			const enabled = message.bool ?? false
			await provider.context.workspaceState.update("lockApiConfigAcrossModes", enabled)
			await context.postWebviewState()
			return true
		}
		case "setModeLevelLlmRoutingEnabled": {
			const routingEnabled = message.bool ?? false
			await context.updateGlobalState("modeLevelLlmRoutingEnabled", routingEnabled)
			await provider.context.workspaceState.update("lockApiConfigAcrossModes", !routingEnabled)
			await context.postWebviewState()
			return true
		}
		default:
			return false
	}
}
