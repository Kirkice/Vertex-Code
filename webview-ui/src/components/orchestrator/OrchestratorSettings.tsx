import React from "react"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "../../i18n/TranslationContext"
import { Section } from "../settings/Section"
import type { OrchestratorProviderConfig, ProviderSettingsEntry, ModeConfig } from "@roo-code/types"
import { OrchestratorToggle } from "./OrchestratorToggle"
import { cn } from "@/lib/utils"

interface OrchestratorSettingsProps {
	config: OrchestratorProviderConfig
	apiConfigs: ProviderSettingsEntry[]
	modes: Array<{ slug: string; name: string }>
	onChange: (config: Partial<OrchestratorProviderConfig>) => void
	enabled?: boolean
}

/**
 * Stage card component for each orchestrator phase (Planner/Worker/Reviewer)
 */
const StageCard: React.FC<{
	icon: string
	title: string
	description: string
	accentColor: string
	modeValue: string
	profileValue: string
	modeOptions: Array<{ slug: string; name: string }>
	profileOptions: string[]
	onModeChange: (value: string) => void
	onProfileChange: (value: string) => void
	modeLabel: string
	profileLabel: string
}> = ({
	icon,
	title,
	description,
	accentColor,
	modeValue,
	profileValue,
	modeOptions,
	profileOptions,
	onModeChange,
	onProfileChange,
	modeLabel,
	profileLabel,
}) => {
	const { t } = useAppTranslation()

	return (
		<div className="relative rounded-md border border-vscode-panel-border bg-vscode-editor-background overflow-hidden">
			{/* Accent bar */}
			<div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accentColor }} />

			<div className="pl-4 pr-3 py-3">
				{/* Header */}
				<div className="flex items-center gap-2 mb-3">
					<span className="text-base">{icon}</span>
					<span className="text-sm font-semibold text-vscode-foreground">{title}</span>
				</div>

				{/* Mode + Profile grid */}
				<div className="grid grid-cols-2 gap-3 mb-3">
					{/* Mode picker */}
					<div>
						<label className="block text-xs font-medium text-vscode-descriptionForeground mb-1">
							{modeLabel}
						</label>
						<select
							value={modeValue || ""}
							onChange={(e) => onModeChange(e.target.value)}
							className="w-full px-2 py-1.5 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder">
							{modeOptions.map((m) => (
								<option key={m.slug} value={m.slug}>
									{m.name}
								</option>
							))}
						</select>
					</div>

					{/* Profile picker */}
					<div>
						<label className="block text-xs font-medium text-vscode-descriptionForeground mb-1">
							{profileLabel}
						</label>
						<select
							value={profileValue || ""}
							onChange={(e) => onProfileChange(e.target.value)}
							className="w-full px-2 py-1.5 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder">
							<option value="" disabled>
								{t("orchestrator.selectProfile")}
							</option>
							{profileOptions.map((name) => (
								<option key={name} value={name}>
									{name}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Description */}
				<p className="text-xs text-vscode-descriptionForeground leading-relaxed">{description}</p>
			</div>
		</div>
	)
}

export const OrchestratorSettings: React.FC<OrchestratorSettingsProps> = ({
	config,
	apiConfigs,
	modes,
	onChange,
	enabled,
}) => {
	const { t } = useAppTranslation()

	const profileNames = apiConfigs.map((c) => c.name)

	return (
		<div className="space-y-4">
			{/* Enable/Disable Toggle */}
			<Section title={t("orchestrator.enableMode")}>
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-vscode-foreground">
							{t("orchestrator.enableModeDescription")}
						</p>
						<p className="text-xs text-vscode-descriptionForeground mt-1">
							{t("orchestrator.enableModeHint")}
						</p>
					</div>
					<OrchestratorToggle enabled={enabled ?? false} />
				</div>
			</Section>

			{/* Stage Configuration */}
			<Section title={t("orchestrator.stageConfig")}>
				<div className="space-y-3">
					{/* Planner */}
					<StageCard
						icon="🧠"
						title={t("orchestrator.planner")}
						description={t("orchestrator.plannerStageDescription")}
						accentColor="#7c3aed"
						modeValue={config.plannerMode ?? "architect"}
						profileValue={config.plannerProfile ?? ""}
						modeOptions={modes}
						profileOptions={profileNames}
						onModeChange={(mode) => onChange({ plannerMode: mode })}
						onProfileChange={(profile) => onChange({ plannerProfile: profile })}
						modeLabel={t("orchestrator.mode")}
						profileLabel={t("orchestrator.profile")}
					/>

					{/* Worker */}
					<StageCard
						icon="⚡"
						title={t("orchestrator.worker")}
						description={t("orchestrator.workerStageDescription")}
						accentColor="#f59e0b"
						modeValue={config.workerMode ?? "code"}
						profileValue={config.workerProfiles?.primary ?? ""}
						modeOptions={modes}
						profileOptions={profileNames}
						onModeChange={(mode) => onChange({ workerMode: mode })}
						onProfileChange={(profile) =>
							onChange({
								workerProfiles: {
									...config.workerProfiles,
									primary: profile,
								},
							})
						}
						modeLabel={t("orchestrator.mode")}
						profileLabel={t("orchestrator.profile")}
					/>

					{/* Reviewer */}
					<StageCard
						icon="🔍"
						title={t("orchestrator.reviewer")}
						description={t("orchestrator.reviewerStageDescription")}
						accentColor="#10b981"
						modeValue={config.reviewerMode ?? "architect"}
						profileValue={config.reviewerProfile ?? ""}
						modeOptions={modes}
						profileOptions={profileNames}
						onModeChange={(mode) => onChange({ reviewerMode: mode })}
						onProfileChange={(profile) => onChange({ reviewerProfile: profile })}
						modeLabel={t("orchestrator.mode")}
						profileLabel={t("orchestrator.profile")}
					/>
				</div>
			</Section>

			{/* Worker Fallback (secondary profile) */}
			<Section title={t("orchestrator.workerFallback")}>
				<div>
					<label className="block text-sm font-medium text-vscode-foreground mb-1">
						{t("orchestrator.workerFallbackProfile")}
					</label>
					<select
						value={config.workerProfiles?.fallback ?? ""}
						onChange={(e) =>
							onChange({
								workerProfiles: {
									...config.workerProfiles,
									fallback: e.target.value,
								},
							})
						}
						className="w-full px-2 py-1.5 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder">
						<option value="" disabled>
							{t("orchestrator.selectProfile")}
						</option>
						{profileNames.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
					<p className="text-xs text-vscode-descriptionForeground mt-1">
						{t("orchestrator.workerFallbackProfileDescription")}
					</p>
				</div>
			</Section>

			{/* Routing policy */}
			<Section title={t("orchestrator.routingPolicy")}>
				<div className="space-y-3">
					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-1">
							{t("orchestrator.maxRepairRounds")}
						</label>
						<input
							type="number"
							min={1}
							max={5}
							value={config.routingPolicy?.maxRepairRounds ?? 2}
							onChange={(e) =>
								onChange({
									routingPolicy: {
										...config.routingPolicy,
										maxRepairRounds: parseInt(e.target.value, 10),
									},
								})
							}
							className="w-20 px-2 py-1.5 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder"
						/>
						<p className="text-xs text-vscode-descriptionForeground mt-1">
							{t("orchestrator.maxRepairRoundsDescription")}
						</p>
					</div>

					<div>
						<label className="block text-sm font-medium text-vscode-foreground mb-1">
							{t("orchestrator.budgetPressure")}
						</label>
						<select
							value={config.routingPolicy?.budgetPressure ?? "medium"}
							onChange={(e) =>
								onChange({
									routingPolicy: {
										...config.routingPolicy,
										budgetPressure: e.target.value as "low" | "medium" | "high",
									},
								})
							}
							className="w-full px-2 py-1.5 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder">
							<option value="low">{t("orchestrator.budgetLow")}</option>
							<option value="medium">{t("orchestrator.budgetMedium")}</option>
							<option value="high">{t("orchestrator.budgetHigh")}</option>
						</select>
						<p className="text-xs text-vscode-descriptionForeground mt-1">
							{t("orchestrator.budgetPressureDescription")}
						</p>
					</div>
				</div>
			</Section>
		</div>
	)
}