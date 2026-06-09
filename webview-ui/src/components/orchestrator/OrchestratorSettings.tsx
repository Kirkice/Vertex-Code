import React from "react"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "../../i18n/TranslationContext"
import { Section } from "../settings/Section"
import type { OrchestratorProviderConfig, ProviderSettingsEntry } from "@roo-code/types"
import { OrchestratorToggle } from "./OrchestratorToggle"

interface OrchestratorSettingsProps {
	config: OrchestratorProviderConfig
	apiConfigs: ProviderSettingsEntry[]
	onChange: (config: Partial<OrchestratorProviderConfig>) => void
	enabled?: boolean
}

/**
 * Simple profile picker dropdown for orchestrator settings.
 * Avoids the complex ModelPicker which requires apiConfiguration props.
 */
const ProfilePicker: React.FC<{
	label: string
	description: string
	selectedValue: string | undefined
	options: string[]
	onChange: (value: string) => void
}> = ({ label, description, selectedValue, options, onChange }) => {
	return (
		<div>
			<label className="block text-sm font-medium text-vscode-foreground mb-1">{label}</label>
			<select
				value={selectedValue || ""}
				onChange={(e) => onChange(e.target.value)}
				className="w-full px-2 py-1 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded">
				<option value="" disabled>
					Select profile...
				</option>
				{options.map((name) => (
					<option key={name} value={name}>
						{name}
					</option>
				))}
			</select>
			{description && <p className="text-xs text-vscode-descriptionForeground mt-1">{description}</p>}
		</div>
	)
}

export const OrchestratorSettings: React.FC<OrchestratorSettingsProps> = ({ config, apiConfigs, onChange, enabled }) => {
	const { t } = useAppTranslation()

	const profileNames = apiConfigs.map((c) => c.name)


	const handlePlannerProfileChange = (profileName: string) => {
		onChange({ plannerProfile: profileName })
	}

	const handleReviewerProfileChange = (profileName: string) => {
		onChange({ reviewerProfile: profileName })
	}

	const handleWorkerPrimaryChange = (profileName: string) => {
		onChange({
			workerProfiles: {
				...config.workerProfiles,
				primary: profileName,
			},
		})
	}

	const handleWorkerFallbackChange = (profileName: string) => {
		onChange({
			workerProfiles: {
				...config.workerProfiles,
				fallback: profileName,
			},
		})
	}

	const handleMaxRepairRoundsChange = (value: number) => {
		onChange({
			routingPolicy: {
				...config.routingPolicy,
				maxRepairRounds: value,
			},
		})
	}

	const handleBudgetPressureChange = (value: "low" | "medium" | "high") => {
		onChange({
			routingPolicy: {
				...config.routingPolicy,
				budgetPressure: value,
			},
		})
	}

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

			{/* Main models (Planner & Reviewer) */}
			<Section title={t("orchestrator.mainModels")}>
				<div className="space-y-3">
					<ProfilePicker
						label={t("orchestrator.plannerProfile")}
						description={t("orchestrator.plannerProfileDescription")}
						selectedValue={config.plannerProfile}
						options={profileNames}
						onChange={handlePlannerProfileChange}
					/>

					<ProfilePicker
						label={t("orchestrator.reviewerProfile")}
						description={t("orchestrator.reviewerProfileDescription")}
						selectedValue={config.reviewerProfile}
						options={profileNames}
						onChange={handleReviewerProfileChange}
					/>
				</div>
			</Section>

			{/* Worker models */}
			<Section title={t("orchestrator.workerModels")}>
				<div className="space-y-3">
					<ProfilePicker
						label={t("orchestrator.workerPrimaryProfile")}
						description={t("orchestrator.workerPrimaryProfileDescription")}
						selectedValue={config.workerProfiles?.primary}
						options={profileNames}
						onChange={handleWorkerPrimaryChange}
					/>

					<ProfilePicker
						label={t("orchestrator.workerFallbackProfile")}
						description={t("orchestrator.workerFallbackProfileDescription")}
						selectedValue={config.workerProfiles?.fallback}
						options={profileNames}
						onChange={handleWorkerFallbackChange}
					/>
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
							onChange={(e) => handleMaxRepairRoundsChange(parseInt(e.target.value, 10))}
							className="w-20 px-2 py-1 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded"
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
							onChange={(e) => handleBudgetPressureChange(e.target.value as "low" | "medium" | "high")}
							className="w-full px-2 py-1 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded">
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