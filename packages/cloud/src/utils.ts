import type { ExtensionContext } from "vscode"

export function getUserAgent(context?: ExtensionContext): string {
	return `Vertex ${context?.extension?.packageJSON?.version || "unknown"}`
}
