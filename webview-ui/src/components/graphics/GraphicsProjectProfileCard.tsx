import { RefreshCw } from "lucide-react"

import type { GraphicsArchitectureCategory, GraphicsProjectProfile } from "@roo-code/types"

import { Button } from "@src/components/ui"

const architectureCategoryLabels: Record<GraphicsArchitectureCategory, string> = {
	pipeline: "Pipeline",
	pass: "Passes",
	shader: "Shaders",
	client: "Client lifecycle",
	asset: "Assets",
	quality: "Quality",
}

interface GraphicsProjectProfileCardProps {
	profile: GraphicsProjectProfile | null
	loading: boolean
	onRefresh: () => void
	maxVisibleFindings?: number
}

const ArchitectureFindings = ({
	profile,
	maxVisibleFindings,
}: {
	profile: GraphicsProjectProfile
	maxVisibleFindings: number
}) => {
	const { architectureIndex } = profile
	if (architectureIndex.findings.length === 0) return null

	return (
		<div className="space-y-2" aria-label="Architecture findings">
			<div className="flex items-center justify-between text-xs">
				<span className="font-medium text-vscode-foreground">Deep architecture findings</span>
				<span className="text-vscode-descriptionForeground">
					{architectureIndex.findings.length} findings from {architectureIndex.analyzedFileCount} files
				</span>
			</div>
			<ul className="space-y-1.5 text-xs">
				{architectureIndex.findings.slice(0, maxVisibleFindings).map((finding) => (
					<li
						key={`${finding.category}:${finding.path}:${finding.kind}:${finding.symbol ?? ""}`}
						className="rounded border border-vscode-panel-border px-2 py-1.5">
						<div className="flex flex-wrap items-center gap-1.5">
							<span className="rounded bg-vscode-badge-background px-1.5 py-0.5 text-vscode-badge-foreground">
								{architectureCategoryLabels[finding.category]}
							</span>
							<span className="font-medium text-vscode-foreground">{finding.symbol ?? finding.kind}</span>
						</div>
						<p className="mt-1 text-vscode-descriptionForeground">{finding.detail}</p>
						<p className="mt-0.5 text-vscode-descriptionForeground/80">{finding.path}</p>
					</li>
				))}
			</ul>
		</div>
	)
}

export const GraphicsProjectProfileCard = ({
	profile,
	loading,
	onRefresh,
	maxVisibleFindings = 12,
}: GraphicsProjectProfileCardProps) => (
	<section
		className="space-y-3 rounded-lg border border-vscode-panel-border p-4"
		aria-label="Graphics Project Profile">
		<div className="flex items-start justify-between gap-3">
			<div>
				<h3 className="text-sm font-semibold text-vscode-foreground">Graphics Project Profile</h3>
				<p className="mt-1 text-xs text-vscode-descriptionForeground">
					Source-derived engine, pipeline, shader, platform, and architecture signals.
				</p>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onClick={onRefresh}
				disabled={loading}
				aria-label="Refresh project profile">
				<RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
				Refresh
			</Button>
		</div>
		{loading ? (
			<p className="text-xs text-vscode-descriptionForeground">Inspecting project graphics architecture…</p>
		) : profile ? (
			<>
				<div className="grid gap-2 text-xs sm:grid-cols-2">
					<div>
						<span className="text-vscode-descriptionForeground">Engine:</span> {profile.engine}
						{profile.engineVersion ? ` ${profile.engineVersion}` : ""}
					</div>
					<div>
						<span className="text-vscode-descriptionForeground">Pipeline:</span>{" "}
						{profile.renderPipelines.join(", ") || "Not detected"}
					</div>
					<div>
						<span className="text-vscode-descriptionForeground">Shaders:</span>{" "}
						{profile.shaderLanguages.join(", ") || "Not detected"}
					</div>
					<div>
						<span className="text-vscode-descriptionForeground">Platforms / APIs:</span>{" "}
						{[...profile.targetPlatforms, ...profile.graphicsApis].join(", ") || "Not detected"}
					</div>
				</div>
				{profile.architectureSignals.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{profile.architectureSignals.map((signal) => (
							<span
								key={signal}
								className="rounded bg-vscode-badge-background px-2 py-0.5 text-xs text-vscode-badge-foreground">
								{signal}
							</span>
						))}
					</div>
				)}
				<ArchitectureFindings profile={profile} maxVisibleFindings={maxVisibleFindings} />
				{profile.evidence.length > 0 && (
					<ul className="space-y-1 text-xs text-vscode-descriptionForeground">
						{profile.evidence.slice(0, 5).map((item) => (
							<li key={`${item.path}:${item.description}`}>
								<span className="text-vscode-foreground">{item.path}</span> — {item.description}
							</li>
						))}
					</ul>
				)}
				{profile.warnings.map((warning) => (
					<p key={warning} className="text-xs text-vscode-editorWarning-foreground">
						{warning}
					</p>
				))}
			</>
		) : null}
	</section>
)
