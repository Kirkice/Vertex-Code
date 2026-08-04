import { RefreshCw } from "lucide-react"

import type { GraphicsArchitectureCategory, GraphicsProjectProfile } from "@roo-code/types"

import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"

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
	const { t } = useAppTranslation()
	const { architectureIndex } = profile
	if (architectureIndex.findings.length === 0) return null

	const categoryLabel = (category: GraphicsArchitectureCategory) => t(`graphics:profile.categories.${category}`)
	const visibleFindings = architectureIndex.findings.slice(0, maxVisibleFindings)
	const remainingCount = Math.max(architectureIndex.findings.length - visibleFindings.length, 0)

	return (
		<Collapsible className="space-y-1.5" aria-label={t("graphics:profile.architectureFindings")}>
			<CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs hover:bg-vscode-list-hoverBackground">
				<span className="font-medium text-vscode-foreground">{t("graphics:profile.deepFindings")}</span>
				<span className="text-vscode-descriptionForeground">
					{t("graphics:profile.findingCount", {
						count: architectureIndex.findings.length,
						files: architectureIndex.analyzedFileCount,
					})}
				</span>
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-1.5">
				<ul className="space-y-1 text-xs">
					{visibleFindings.map((finding) => (
						<li
							key={`${finding.category}:${finding.path}:${finding.kind}:${finding.symbol ?? ""}`}
							className="rounded-md border border-vscode-panel-border/80 bg-vscode-editor-background/35 px-2 py-1.5">
							<div className="flex min-w-0 items-center gap-1.5">
								<span className="shrink-0 rounded bg-vscode-badge-background px-1.5 py-0.5 text-[10px] text-vscode-badge-foreground">
									{categoryLabel(finding.category)}
								</span>
								<span className="truncate font-medium text-vscode-foreground">{finding.symbol ?? finding.kind}</span>
							</div>
							<p className="mt-0.5 line-clamp-1 text-vscode-descriptionForeground">{finding.detail}</p>
							<p className="truncate text-[10px] text-vscode-descriptionForeground/70">{finding.path}</p>
						</li>
					))}
				</ul>
				{remainingCount > 0 && (
					<p className="px-1 text-[10px] text-vscode-descriptionForeground">
						+{remainingCount} more findings
					</p>
				)}
			</CollapsibleContent>
		</Collapsible>
	)
}

export const GraphicsProjectProfileCard = ({
	profile,
	loading,
	onRefresh,
	maxVisibleFindings = 4,
}: GraphicsProjectProfileCardProps) => {
	const { t } = useAppTranslation()

	return (
		<section
			className="space-y-2.5 rounded-lg border border-vscode-panel-border bg-vscode-editor-background/20 p-3"
			aria-label={t("graphics:profile.title")}>
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0">
					<h3 className="truncate text-sm font-semibold text-vscode-foreground">{t("graphics:profile.title")}</h3>
					<p className="mt-0.5 line-clamp-1 text-[11px] text-vscode-descriptionForeground">
						{t("graphics:profile.description")}
					</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="size-7 shrink-0 rounded-md p-0"
					onClick={onRefresh}
					disabled={loading}
					aria-label={t("graphics:profile.refreshAria")}
					type="button">
					<RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
				</Button>
			</div>
			{loading ? (
				<p className="text-xs text-vscode-descriptionForeground" role="status">
					{t("graphics:profile.loading")}
				</p>
			) : profile ? (
				<>
					<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
						<div>
							<span className="text-vscode-descriptionForeground">{t("graphics:profile.engine")}</span>{" "}
							{profile.engine}
							{profile.engineVersion ? ` ${profile.engineVersion}` : ""}
						</div>
						<div>
							<span className="text-vscode-descriptionForeground">{t("graphics:profile.pipeline")}</span>{" "}
							{profile.renderPipelines.join(", ") || t("graphics:profile.notDetected")}
						</div>
						<div>
							<span className="text-vscode-descriptionForeground">{t("graphics:profile.shaders")}</span>{" "}
							{profile.shaderLanguages.join(", ") || t("graphics:profile.notDetected")}
						</div>
						<div>
							<span className="text-vscode-descriptionForeground">
								{t("graphics:profile.platformsApis")}
							</span>{" "}
							{[...profile.targetPlatforms, ...profile.graphicsApis].join(", ") ||
								t("graphics:profile.notDetected")}
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
						<ul className="space-y-0.5 text-[10px] text-vscode-descriptionForeground">
							{profile.evidence.slice(0, 2).map((item) => (
								<li key={`${item.path}:${item.description}`} className="truncate">
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
}
