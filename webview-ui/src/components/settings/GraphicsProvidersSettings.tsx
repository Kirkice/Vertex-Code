/**
 * Graphics Providers Settings Component
 *
 * Displays registered graphics capture providers with status, capabilities,
 * and configuration information. Design follows the OrchestratorSettings pattern.
 *
 * @module components/settings/GraphicsProvidersSettings
 */

import React, { useEffect, useState } from "react"
import type { GraphicsProviderStatusInfo, GraphicsProviderCapabilities } from "@roo-code/types"
import { vscode } from "@src/utils/vscode"
import { SectionHeader } from "./SectionHeader"
import { cn } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
	available: { icon: "●", color: "#10b981", label: "Available" },
	unavailable: { icon: "○", color: "#6b7280", label: "Unavailable" },
	"no-capture": { icon: "◌", color: "#f59e0b", label: "No Capture" },
	error: { icon: "✕", color: "#ef4444", label: "Error" },
}

const CAPABILITY_META: Array<{ key: keyof GraphicsProviderCapabilities; label: string; icon: string }> = [
	{ key: "frameSummary", label: "Frame Summary", icon: "📊" },
	{ key: "passGraph", label: "Pass Graph", icon: "🔗" },
	{ key: "selectionContext", label: "Selection Context", icon: "🎯" },
	{ key: "eventDetails", label: "Event Details", icon: "📋" },
	{ key: "pipelineState", label: "Pipeline State", icon: "⚙️" },
	{ key: "shaderInfo", label: "Shader Info", icon: "✨" },
	{ key: "shaderSource", label: "Shader Source", icon: "📝" },
	{ key: "meshData", label: "Mesh Data", icon: "🔺" },
	{ key: "resourceDetail", label: "Resource Detail", icon: "🗃️" },
	{ key: "textureData", label: "Texture Data", icon: "🖼️" },
	{ key: "bufferData", label: "Buffer Data", icon: "📦" },
	{ key: "projectMapping", label: "Project Mapping", icon: "📁" },
	{ key: "captureDiff", label: "Capture Diff", icon: "🔀" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function statusHint(status: GraphicsProviderStatusInfo): string | null {
	switch (status.status) {
		case "unavailable":
			return "MCP server not found or not running. Install and configure the graphics tool, then add it as an MCP server in Settings → MCP Servers."
		case "no-capture":
			return "Provider is connected but no capture is open. Open a capture in your graphics tool first."
		case "error":
			return status.message || "An unexpected error occurred."
		default:
			return null
	}
}

// ─── Sub-Components ───────────────────────────────────────────────────────

/** Status dot + label badge */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
	const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unavailable
	return (
		<span
			className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
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

/** Single capability chip */
const CapabilityChip: React.FC<{ enabled: boolean; label: string; icon: string }> = ({ enabled, label, icon }) => (
	<span
		className={cn(
			"inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
			enabled
				? "bg-[#10b98115] text-[#10b981] border border-[#10b98130]"
				: "bg-transparent text-[#6b7280] border border-[#6b728030] line-through opacity-60",
		)}>
		<span className="text-[10px]">{icon}</span>
		{label}
	</span>
)

/** Provider card - inspired by Orchestrator StageCard */
const ProviderCard: React.FC<{
	provider: GraphicsProviderStatusInfo
	isSelected: boolean
	capabilities?: GraphicsProviderCapabilities | null
}> = ({ provider, isSelected, capabilities }) => {
	const cfg = STATUS_CONFIG[provider.status] ?? STATUS_CONFIG.unavailable
	const hint = statusHint(provider)

	return (
		<div className="relative rounded-md border border-vscode-panel-border bg-vscode-editor-background overflow-hidden">
			{/* Accent bar */}
			<div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: cfg.color }} />

			<div className="pl-4 pr-3 py-3">
				{/* Header row */}
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2 min-w-0">
						<span className="text-sm font-semibold text-vscode-foreground truncate">
							{provider.providerName}
						</span>
						{isSelected && (
							<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#7c3aed15] text-[#7c3aed] border border-[#7c3aed30] shrink-0">
								Selected
							</span>
						)}
					</div>
					<StatusBadge status={provider.status} />
				</div>

				{/* Provider ID */}
				<div className="text-xs text-vscode-descriptionForeground mb-3 opacity-70">
					ID: <code className="text-[11px]">{provider.providerId}</code>
				</div>

				{/* Capabilities grid */}
				{capabilities && (
					<div className="mb-3">
						<div className="text-[10px] font-semibold text-vscode-descriptionForeground uppercase tracking-wider mb-1.5">
							Capabilities
						</div>
						<div className="flex flex-wrap gap-1">
							{CAPABILITY_META.map((cap) => (
								<CapabilityChip
									key={cap.key}
									enabled={!!capabilities[cap.key]}
									label={cap.label}
									icon={cap.icon}
								/>
							))}
						</div>
					</div>
				)}

				{/* Hint / warning */}
				{hint && (
					<div
						className="text-xs leading-relaxed rounded px-3 py-2"
						style={{
							color: cfg.color,
							backgroundColor: `${cfg.color}0D`,
							border: `1px solid ${cfg.color}20`,
						}}>
						{hint}
					</div>
				)}

				{/* Additional message (non-unavailable) */}
				{provider.message && provider.status !== "unavailable" && !hint && (
					<div className="text-xs text-vscode-descriptionForeground mt-2">{provider.message}</div>
				)}
			</div>
		</div>
	)
}

/** Empty state when no providers registered */
const EmptyState: React.FC = () => (
	<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
		<div className="text-4xl mb-4 opacity-40">🖥️</div>
		<h3 className="text-sm font-semibold text-vscode-foreground mb-2">No Graphics Providers</h3>
		<p className="text-xs text-vscode-descriptionForeground max-w-sm leading-relaxed">
			Graphics providers are automatically discovered when MCP servers are configured. To get started:
		</p>
		<div className="mt-4 space-y-2 text-xs text-vscode-descriptionForeground text-left">
			<div className="flex items-start gap-2">
				<span className="text-[#7c3aed] mt-0.5 shrink-0">1.</span>
				<span>Install <strong>RenderDoc for VS Code</strong> (or another graphics capture extension)</span>
			</div>
			<div className="flex items-start gap-2">
				<span className="text-[#7c3aed] mt-0.5 shrink-0">2.</span>
				<span>Configure it as an <strong>MCP Server</strong> in Settings → MCP Servers</span>
			</div>
			<div className="flex items-start gap-2">
				<span className="text-[#7c3aed] mt-0.5 shrink-0">3.</span>
				<span>Return here to see the provider status and available capabilities</span>
			</div>
		</div>
	</div>
)

// ─── Main Component ───────────────────────────────────────────────────────

export const GraphicsProvidersSettings: React.FC = () => {
	const [providers, setProviders] = useState<GraphicsProviderStatusInfo[]>([])
	const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		vscode.postMessage({ type: "requestGraphicsProviderStatus" } as any)

		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "graphicsProviderStatus") {
				const values = message.values as {
					providers: GraphicsProviderStatusInfo[]
					selectedProviderId?: string
				}
				setProviders(values.providers || [])
				setSelectedProviderId(values.selectedProviderId || null)
				setLoading(false)
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	// ── Loading ──
	if (loading) {
		return (
			<div>
				<SectionHeader description="Manage external graphics capture tools for GPU frame analysis and debugging.">
					Graphics Providers
				</SectionHeader>
				<div className="flex flex-col items-center justify-center py-12">
					<div
						className="w-5 h-5 border-2 border-vscode-focusBorder border-t-transparent rounded-full animate-spin"
					/>
					<span className="text-xs text-vscode-descriptionForeground mt-3">Loading providers...</span>
				</div>
			</div>
		)
	}

	// ── Header ──
	const availableCount = providers.filter((p) => p.status === "available").length
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
				{/* Summary bar */}
				{totalCount > 0 && (
					<div className="flex items-center gap-4 text-xs text-vscode-descriptionForeground mb-1">
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full bg-[#10b981]" />
							{availableCount} Available
						</div>
						<div className="flex items-center gap-1.5">
							<div className="w-2 h-2 rounded-full bg-[#6b7280]" />
							{totalCount - availableCount} Offline
						</div>
					</div>
				)}

				{/* Provider cards */}
				{totalCount > 0 ? (
					<div className="space-y-3">
						{providers.map((provider) => (
							<ProviderCard
								key={provider.providerId}
								provider={provider}
								isSelected={selectedProviderId === provider.providerId}
								capabilities={null} // Capabilities require per-provider fetch; future enhancement
							/>
						))}
					</div>
				) : (
					<EmptyState />
				)}

				{/* Footer hint */}
				{totalCount === 0 && (
					<div className="text-[11px] text-vscode-descriptionForeground opacity-60 text-center py-4">
						Looking for RenderDoc? Add it in <strong>MCP Servers</strong> with server name{" "}
						<code>renderdoc-for-vscode</code>
					</div>
				)}
			</div>
		</div>
	)
}

export default GraphicsProvidersSettings
