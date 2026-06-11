import React from "react"
import { useAppTranslation } from "../../i18n/TranslationContext"
import type { OrchestratorSessionSnapshot } from "@roo-code/types"

interface OrchestratorSessionPanelProps {
	session: OrchestratorSessionSnapshot | null
}

export const OrchestratorSessionPanel: React.FC<OrchestratorSessionPanelProps> = ({ session }) => {
	const { t } = useAppTranslation()

	if (!session) {
		return null
	}

	const { stages } = session

	return (
		<div className="border border-vscode-panel-border rounded-lg p-3 bg-vscode-sideBar-background">
			{/* Stages Grid - dynamic cards based on stages array */}
			<div className="grid grid-cols-3 gap-2">
				{stages.map((stage) => (
					<div
						key={stage.name}
						className={`rounded-md p-2 text-xs transition-all ${
							stage.active
								? "bg-vscode-editor-background border-2 border-blue-500"
								: "bg-vscode-editor-background border border-vscode-panel-border opacity-60"
						}`}>
						{/* Stage Header */}
						<div className="font-semibold mb-1 flex items-center gap-1">
							<span>{stage.label}</span>
							{stage.active && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
						</div>

						{/* Mode */}
						<div className="text-vscode-descriptionForeground">
							{t("orchestrator.mode")}: <span className="text-vscode-foreground">{stage.mode}</span>
						</div>

						{/* Profile/Model */}
						<div className="text-vscode-descriptionForeground">
							{t("orchestrator.profile")}: <span className="text-vscode-foreground">{stage.profile}</span>
						</div>

						{/* Tokens */}
						<div className="text-vscode-descriptionForeground">
							{t("orchestrator.tokens")}: <span className="text-vscode-foreground">{stage.tokens.toLocaleString()}</span>
						</div>

						{/* Cost */}
						<div className="text-vscode-descriptionForeground">
							{t("orchestrator.cost")}: <span className="text-vscode-foreground">${stage.cost.toFixed(4)}</span>
						</div>
					</div>
				))}
			</div>

			{/* Error Message (when session failed) */}
			{session.error && (
				<div className="mt-3 border-t border-vscode-panel-border pt-2">
					<div className="flex items-center gap-1 mb-1">
						<span className="text-red-500">⚠</span>
						<h4 className="text-xs font-medium text-red-500">
							{t("orchestrator.errorMessage")}
						</h4>
					</div>
					<p className="text-xs text-vscode-descriptionForeground bg-red-500/10 p-2 rounded">
						{session.error}
					</p>
				</div>
			)}
		</div>
	)
}
