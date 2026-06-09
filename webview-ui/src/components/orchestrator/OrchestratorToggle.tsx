import React from "react"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "../../i18n/TranslationContext"

interface OrchestratorToggleProps {
	enabled: boolean
}

export const OrchestratorToggle: React.FC<OrchestratorToggleProps> = ({ enabled }) => {
	const { t } = useAppTranslation()

	const handleToggle = () => {
		const newState = !enabled
		vscode.postMessage({
			type: "orchestratorSetEnabled",
			bool: newState,
		})
	}

	return (
		<div className="flex items-center gap-2">
			<button
				onClick={handleToggle}
				className={`
					relative inline-flex h-5 w-10 items-center rounded-full
					transition-colors duration-200 ease-in-out focus:outline-none
					${enabled ? "bg-vscode-button-background" : "bg-vscode-input-background"}
				`}
				role="switch"
				aria-checked={enabled}
				aria-label={t("orchestrator.toggleLabel")}
				title={enabled ? t("orchestrator.enabledTooltip") : t("orchestrator.disabledTooltip")}
			>
				<span
					className={`
						inline-block h-4 w-4 transform rounded-full bg-white
						transition-transform duration-200 ease-in-out
						${enabled ? "translate-x-5" : "translate-x-0.5"}
					`}
				/>
			</button>
			<span className="text-xs text-vscode-foreground">
				{enabled ? t("orchestrator.multiModel") : t("orchestrator.defaultSystem")}
			</span>
		</div>
	)
}