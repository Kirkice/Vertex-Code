/**
 * Graphics Providers Settings Component
 *
 * Displays registered graphics capture providers with status, capabilities,
 * and configuration information. Design follows the OrchestratorSettings pattern.
 *
 * @module components/settings/GraphicsProvidersSettings
 */

import React, { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { GraphicsProviderCapabilities, GraphicsProviderStatusInfo } from "@roo-code/types"
import { vscode } from "@src/utils/vscode"
import { SectionHeader } from "./SectionHeader"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
	available: { icon: "●", color: "#10b981", label: "Available" },
	unavailable: { icon: "●", color: "#6b7280", label: "Unavailable" },
	"no-capture": { icon: "●", color: "#f59e0b", label: "No Capture" },
	error: { icon: "✕", color: "#ef4444", label: "Error" },
}

const CAPABILITY_META: Array<{
	key: keyof GraphicsProviderCapabilities
	label: string
	icon: string
	method: string
	description: string
}> = [
	{
		key: "frameSummary",
		label: "Frame Summary",
		icon: "📳",
		method: "getFrameSummary()",
		description: "Read frame-level pass lists, timings, and hot events.",
	},
	{
		key: "passGraph",
		label: "Pass Graph",
		icon: "🔆",
		method: "getPassGraph()",
		description: "Inspect render pass structure and pass dependencies.",
	},
	{
		key: "selectionContext",
		label: "Selection Context",
		icon: "🎆",
		method: "getSelectionContext()",
		description: "Read the currently selected draw, event, or pass context.",
	},
	{
		key: "eventDetails",
		label: "Event Details",
		icon: "📵",
		method: "getEventDetails()",
		description: "Inspect detailed event-level timing and draw information.",
	},
	{
		key: "pipelineState",
		label: "Pipeline State",
		icon: "🗍",
		method: "getPipelineState()",
		description: "Inspect bound render targets, buffers, samplers, and state.",
	},
	{
		key: "shaderInfo",
		label: "Shader Info",
		icon: "✎",
		method: "getShaderInfo()",
		description: "Read shader stage, entry point, reflection, and metadata.",
	},
	{
		key: "shaderSource",
		label: "Shader Source",
		icon: "📝",
		method: "getShaderSource()",
		description: "Fetch decompiled or original shader source when available.",
	},
	{
		key: "meshData",
		label: "Mesh Data",
		icon: "🔽",
		method: "getMeshData()",
		description: "Inspect vertex/index data and geometry payloads.",
	},
	{
		key: "resourceDetail",
		label: "Resource Detail",
		icon: "🪼",
		method: "getResourceDetail()",
		description: "Inspect textures, buffers, and bindings at the resource level.",
	},
	{
		key: "textureData",
		label: "Texture Data",
		icon: "🖤",
		method: "getTextureData()",
		description: "Read raw texture contents for debugging and inspection.",
	},
	{
		key: "bufferData",
		label: "Buffer Data",
		icon: "📝",
		method: "getBufferData()",
		description: "Read raw buffer contents for inspection and validation.",
	},
	{
		key: "projectMapping",
		label: "Project Mapping",
		icon: "📧",
		method: "findOwnerInProject()",
		description: "Map capture-side objects back to project source locations.",
	},
	{
		key: "captureDiff",
		label: "Capture Diff",
		icon: "🄢",
		method: "diffCapture()",
		description: "Compare captures or events for regressions and changes.",
	},
]

function statusHint(status: GraphicsProviderStatusInfo): string | null {
	switch (status.status) {
		case "unavailable":
			return "MCP server not found or not running. Install and configure the graphics tool, then add it as an MCP server in Settings > MCP Servers."
		case "no-capture":
			return "Provider is connected but no capture is open. Open a capture in your graphics tool first."
		case "error":
			return status.message || "An unexpected error occurred."
		default:
			return null
	}
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
	const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unavailable
	return (
		<span
			className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
			style={{
				color: cfg.color,
				backgroundColor: `${cfg.color}15`,
				border: `1px solid ${cfg.color}30`,
			}}>
			<span style={{ fontSize: "10px" }}>{cfg.icon}</span>
			{cfg.label}
		</span>
	)
}

const CapabilityChip: React.FC<{ enabled: boolean; label: string; icon: string }> = ({ enabled, label, icon }) => (
	<span
		className={cn(
			"inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
			enabled
				? "border border-[#10b98130] bg-[#10b98115] text-[#10b981]"
				: "border border-[#6b728030] bg-transparent text-[#6b7280] opacity-60 line-through",
		)}>
		<span className="text-[10px]">{icon}</span>
		{label}
	</span>
)

const CapabilityRow: React.FC<{
	enabled: boolean
	label: string
	icon: string
	method: string
	description: string
}> = ({ enabled, label, icon, method, description }) => (
	<div className="rounded-md border border-vscode-panel-border bg-vscode-editor-background px-3 py-2">
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="flex items-center gap-2 text-sm font-medium text-vscode-foreground">
					<span className="text-xs">{icon}</span>
					<span>{label}</span>
				</div>
				<div className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">{description}</div>
				<div className="mt-1 text-[11px] text-vscode-descriptionForeground">
					Vertex operation: <code>{method}</code>
				</div>
			</div>
			<span
				className={cn(
					"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
					enabled
						? "border border-[#10b98130] bg-[#10b98115] text-[#10b981]"
						: "border border-[#6b728030] bg-transparent text-[#6b7280]",
				)}>
				{enabled ? "Supported" : "Unavailable"}
			</span>
		</div>
	</div>
)

const ProviderCard: React.FC<{
	provider: GraphicsProviderStatusInfo
	isExpanded: boolean
	isSelected: boolean
	capabilities?: GraphicsProviderCapabilities | null
	onToggleExpanded: () => void
}> = ({ provider, isExpanded, isSelected, capabilities, onToggleExpanded }) => {
	const cfg = STATUS_CONFIG[provider.status] ?? STATUS_CONFIG.unavailable
	const hint = statusHint(provider)
	const enabledCapabilities = capabilities ? CAPABILITY_META.filter((cap) => capabilities[cap.key]).length : 0

	return (
		<div className="relative overflow-hidden rounded-md border border-vscode-panel-border bg-vscode-editor-background">
			<div className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: cfg.color }} />

			<div className="pl-4 pr-3 py-3">
				<div className="mb-2 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={onToggleExpanded}
								className="mt-[1px] shrink-0 rounded-sm p-0.5 text-vscode-descriptionForeground transition-colors hover:bg-vscode-toolbar-hoverBackground hover:text-vscode-foreground"
								aria-expanded={isExpanded}
								aria-label={isExpanded ? "Collapse provider details" : "Expand provider details"}>
								{isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
							</button>
							<span className="truncate text-sm font-semibold text-vscode-foreground">
								{provider.providerName}
							</span>
							{isSelected && (
								<span className="shrink-0 rounded border border-[#7c3aed30] bg-[#7c3aed15] px-1.5 py-0.5 text-[10px] font-medium text-[#7c3aed]">
									Selected
								</span>
							)}
						</div>
						<div className="mt-1 pl-6 text-xs text-vscode-descriptionForeground opacity-70">
							ID: <code className="text-[11px]">{provider.providerId}</code>
						</div>
						{capabilities && (
							<div className="mt-2 pl-6 text-xs text-vscode-descriptionForeground">
								{enabledCapabilities} of {CAPABILITY_META.length} capabilities available
							</div>
						)}
					</div>
					<StatusBadge status={provider.status} />
				</div>

				{capabilities && (
					<div className="mb-3 pl-6">
						<div className="flex flex-wrap gap-1">
							{CAPABILITY_META.map((cap) => (
								<CapabilityChip key={cap.key} enabled={!!capabilities[cap.key]} label={cap.label} icon={cap.icon} />
							))}
						</div>
					</div>
				)}

				{hint && (
					<div
						className="rounded px-3 py-2 text-xs leading-relaxed"
						style={{
							color: cfg.color,
							backgroundColor: `${cfg.color}0D`,
							border: `1px solid ${cfg.color}20`,
						}}>
						{hint}
					</div>
				)}

				{provider.message && provider.status !== "unavailable" && !hint && (
					<div className="mt-2 text-xs text-vscode-descriptionForeground">{provider.message}</div>
				)}

				{isExpanded && capabilities && (
					<div className="mt-4 border-t border-vscode-panel-border pt-4">
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-vscode-descriptionForeground">
							Provider Details
						</div>
						<div className="mb-3 grid gap-2 text-xs text-vscode-descriptionForeground md:grid-cols-2">
							<div className="rounded border border-vscode-panel-border bg-vscode-editor-background px-3 py-2">
								<div className="font-medium text-vscode-foreground">What this provider exposes</div>
								<div className="mt-1 leading-relaxed">
									These capabilities drive what Graphics Mode can query from the connected capture tool.
								</div>
							</div>
							<div className="rounded border border-vscode-panel-border bg-vscode-editor-background px-3 py-2">
								<div className="font-medium text-vscode-foreground">How to read this</div>
								<div className="mt-1 leading-relaxed">
									Supported capabilities are available to workflows and playbooks; unavailable ones will be skipped during preflight checks.
								</div>
							</div>
						</div>
						<div className="space-y-2">
							{CAPABILITY_META.map((cap) => (
								<CapabilityRow
									key={cap.key}
									enabled={!!capabilities[cap.key]}
									label={cap.label}
									icon={cap.icon}
									method={cap.method}
									description={cap.description}
								/>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

const EmptyState: React.FC = () => (
	<div className="flex flex-col items-center justify-center px-6 py-12 text-center">
		<div className="mb-4 text-4xl opacity-40">🖼️</div>
		<h3 className="mb-2 text-sm font-semibold text-vscode-foreground">No Graphics Providers</h3>
		<p className="max-w-sm text-xs leading-relaxed text-vscode-descriptionForeground">
			Graphics providers are automatically discovered when MCP servers are configured. To get started:
		</p>
		<div className="mt-4 space-y-2 text-left text-xs text-vscode-descriptionForeground">
			<div className="flex items-start gap-2">
				<span className="mt-0.5 shrink-0 text-[#7c3aed]">1.</span>
				<span>
					Install <strong>RenderDoc for VS Code</strong> (or another graphics capture extension)
				</span>
			</div>
			<div className="flex items-start gap-2">
				<span className="mt-0.5 shrink-0 text-[#7c3aed]">2.</span>
				<span>
					Configure it as an <strong>MCP Server</strong> in Settings &gt; MCP Servers
				</span>
			</div>
			<div className="flex items-start gap-2">
				<span className="mt-0.5 shrink-0 text-[#7c3aed]">3.</span>
				<span>Return here to inspect provider status, capabilities, and supported operations</span>
			</div>
		</div>
	</div>
)

export const GraphicsProvidersSettings: React.FC = () => {
	const [providers, setProviders] = useState<GraphicsProviderStatusInfo[]>([])
	const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
	const [capabilitiesByProviderId, setCapabilitiesByProviderId] = useState<
		Record<string, GraphicsProviderCapabilities | null>
	>({})
	const [expandedProviderIds, setExpandedProviderIds] = useState<Record<string, boolean>>({})
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		vscode.postMessage({ type: "requestGraphicsProviderStatus" } as any)

		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "graphicsProviderStatus") {
				const values = message.values as {
					providers: GraphicsProviderStatusInfo[]
					selectedProviderId?: string
					capabilitiesByProviderId?: Record<string, GraphicsProviderCapabilities | null>
				}
				setProviders(values.providers || [])
				setSelectedProviderId(values.selectedProviderId || null)
				setCapabilitiesByProviderId(values.capabilitiesByProviderId || {})
				setExpandedProviderIds((prev) => {
					const next = { ...prev }
					for (const graphicsProvider of values.providers || []) {
						if (!(graphicsProvider.providerId in next)) {
							next[graphicsProvider.providerId] = false
						}
					}
					return next
				})
				setLoading(false)
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	if (loading) {
		return (
			<div>
				<SectionHeader description="Manage external graphics capture tools for GPU frame analysis and debugging.">
					Graphics Providers
				</SectionHeader>
				<div className="flex flex-col items-center justify-center py-12">
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-vscode-focusBorder border-t-transparent" />
					<span className="mt-3 text-xs text-vscode-descriptionForeground">Loading providers...</span>
				</div>
			</div>
		)
	}

	const availableCount = providers.filter((provider) => provider.status === "available").length
	const totalCount = providers.length

	return (
		<div>
			<SectionHeader
				description={
					totalCount > 0
						? `${availableCount} of ${totalCount} provider${totalCount !== 1 ? "s" : ""} available`
						: "Manage external graphics capture tools for GPU frame analysis and debugging."
				}>
				Graphics Providers
			</SectionHeader>

			<div className="space-y-4 px-5 py-2">
				{totalCount > 0 && (
					<div className="mb-1 flex items-center gap-4 text-xs text-vscode-descriptionForeground">
						<div className="flex items-center gap-1.5">
							<div className="h-2 w-2 rounded-full bg-[#10b981]" />
							{availableCount} Available
						</div>
						<div className="flex items-center gap-1.5">
							<div className="h-2 w-2 rounded-full bg-[#6b7280]" />
							{totalCount - availableCount} Offline
						</div>
					</div>
				)}

				{totalCount > 0 ? (
					<div className="space-y-3">
						{providers.map((provider) => (
							<ProviderCard
								key={provider.providerId}
								provider={provider}
								isSelected={selectedProviderId === provider.providerId}
								isExpanded={!!expandedProviderIds[provider.providerId]}
								capabilities={capabilitiesByProviderId[provider.providerId] ?? null}
								onToggleExpanded={() =>
									setExpandedProviderIds((prev) => ({
										...prev,
										[provider.providerId]: !prev[provider.providerId],
									}))
								}
							/>
						))}
					</div>
				) : (
					<EmptyState />
				)}

				{totalCount === 0 && (
					<div className="py-4 text-center text-[11px] text-vscode-descriptionForeground opacity-60">
						Looking for RenderDoc? Add it in <strong>MCP Servers</strong> with server name <code>renderdoc-for-vscode</code>
					</div>
				)}
			</div>
		</div>
	)
}

export default GraphicsProvidersSettings
