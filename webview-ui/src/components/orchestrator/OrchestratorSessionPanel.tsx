import React from "react"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "../../i18n/TranslationContext"
import type { OrchestratorSessionState, OrchestratorTask } from "@roo-code/types"

interface CostStats {
	totalTokens: number
	tokensByProvider: Record<string, number>
	estimatedCostUsd: number
}

interface OrchestratorSessionSnapshot {
	sessionId: string
	state: OrchestratorSessionState
	currentPhase: string
	tasks: OrchestratorTask[]
	repairRound: number
	maxRepairRounds: number
	costStats: CostStats
	planSummary?: string
	error?: string
}

interface OrchestratorSessionPanelProps {
	session: OrchestratorSessionSnapshot | null
}

const stateLabels: Record<OrchestratorSessionState, string> = {
	created: "orchestrator.state.created",
	planning: "orchestrator.state.planning",
	executing: "orchestrator.state.executing",
	verifying: "orchestrator.state.verifying",
	reviewing: "orchestrator.state.reviewing",
	repairing: "orchestrator.state.repairing",
	completed: "orchestrator.state.completed",
	failed: "orchestrator.state.failed",
	cancelled: "orchestrator.state.cancelled",
}

const stateColors: Record<OrchestratorSessionState, string> = {
	created: "bg-gray-400",
	planning: "bg-blue-400",
	executing: "bg-yellow-400",
	verifying: "bg-purple-400",
	reviewing: "bg-orange-400",
	repairing: "bg-red-400",
	completed: "bg-green-500",
	failed: "bg-red-500",
	cancelled: "bg-gray-500",
}

export const OrchestratorSessionPanel: React.FC<OrchestratorSessionPanelProps> = ({ session }) => {
	const { t } = useAppTranslation()

	if (!session) {
		return null
	}

	const handleApprovePlan = () => {
		vscode.postMessage({
			type: "orchestratorApprovePlan",
			sessionId: session.sessionId,
		})
	}

	const handleCancel = () => {
		vscode.postMessage({
			type: "orchestratorCancel",
			sessionId: session.sessionId,
		})
	}

	// Plan approval should happen when planner has finished generating the plan
	// (state is "planning" and planSummary is available), not during "reviewing"
	// which is for the reviewer to evaluate execution results
	const isActionable = session.state === "planning" && session.planSummary
	const isTerminal = ["completed", "failed", "cancelled"].includes(session.state)

	return (
		<div className="border border-vscode-panel-border rounded-lg p-3 space-y-3 bg-vscode-sideBar-background">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-vscode-foreground">
					{t("orchestrator.sessionTitle")}
				</h3>
				<div className="flex items-center gap-2">
					<span className={`w-2 h-2 rounded-full ${stateColors[session.state]}`} />
					<span className="text-xs text-vscode-descriptionForeground">
						{t(stateLabels[session.state])}
					</span>
				</div>
			</div>

			{/* Current Phase */}
			<div className="text-xs text-vscode-descriptionForeground">
				{t("orchestrator.currentPhase")}: <span className="text-vscode-foreground">{session.currentPhase}</span>
			</div>

			{/* Repair Rounds */}
			{session.repairRound > 0 && (
				<div className="text-xs text-vscode-descriptionForeground">
					{t("orchestrator.repairRound")}: <span className="text-vscode-foreground">{session.repairRound}/{session.maxRepairRounds}</span>
				</div>
			)}

			{/* Task List */}
			<div className="space-y-1">
				<h4 className="text-xs font-medium text-vscode-foreground">
					{t("orchestrator.tasks")} ({session.tasks.length})
				</h4>
				<div className="max-h-32 overflow-y-auto space-y-1">
					{session.tasks.map((task) => (
						<div
							key={task.taskId}
							className="flex items-center gap-2 text-xs p-1 rounded bg-vscode-editor-background"
						>
							<span className={`w-1.5 h-1.5 rounded-full ${getTaskStatusColor(task.status)}`} />
							<span className="flex-1 truncate text-vscode-foreground">{task.title}</span>
							<span className="text-vscode-descriptionForeground">{task.kind}</span>
						</div>
					))}
				</div>
			</div>

			{/* Cost Stats */}
			<div className="border-t border-vscode-panel-border pt-2">
				<h4 className="text-xs font-medium text-vscode-foreground mb-1">
					{t("orchestrator.costStats")}
				</h4>
				<div className="grid grid-cols-2 gap-2 text-xs">
					<div>
						<span className="text-vscode-descriptionForeground">{t("orchestrator.totalTokens")}:</span>
						<span className="ml-1 text-vscode-foreground">{session.costStats.totalTokens.toLocaleString()}</span>
					</div>
					<div>
						<span className="text-vscode-descriptionForeground">{t("orchestrator.estimatedCost")}:</span>
						<span className="ml-1 text-vscode-foreground">${session.costStats.estimatedCostUsd.toFixed(4)}</span>
					</div>
				</div>
				{Object.keys(session.costStats.tokensByProvider).length > 0 && (
					<div className="mt-2">
						<span className="text-xs text-vscode-descriptionForeground">{t("orchestrator.tokensByProvider")}:</span>
						<div className="flex flex-wrap gap-2 mt-1">
							{Object.entries(session.costStats.tokensByProvider).map(([provider, tokens]) => (
								<span
									key={provider}
									className="text-xs px-2 py-0.5 rounded bg-vscode-editor-background text-vscode-foreground"
								>
									{provider}: {tokens.toLocaleString()}
								</span>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Plan Summary (when plan is ready for approval) */}
			{isActionable && session.planSummary && (
				<div className="border-t border-vscode-panel-border pt-2">
					<h4 className="text-xs font-medium text-vscode-foreground mb-1">
						{t("orchestrator.planSummary")}
					</h4>
					<p className="text-xs text-vscode-descriptionForeground">{session.planSummary}</p>
				</div>
			)}

			{/* Action Buttons */}
			{!isTerminal && (
				<div className="flex gap-2 pt-2">
					{isActionable && (
						<button
							onClick={handleApprovePlan}
							className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground"
						>
							{t("orchestrator.approvePlan")}
						</button>
					)}
					<button
						onClick={handleCancel}
						className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground"
					>
						{t("orchestrator.cancel")}
					</button>
				</div>
			)}

			{/* Terminal State Message */}
			{isTerminal && (
				<div className={`text-xs text-center py-2 ${session.state === "completed" ? "text-green-500" : "text-red-500"}`}>
					{t(`orchestrator.sessionEnded.${session.state}`)}
				</div>
			)}

			{/* Error Message (when session failed) */}
			{session.state === "failed" && session.error && (
				<div className="border-t border-vscode-panel-border pt-2">
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

function getTaskStatusColor(status: string): string {
	switch (status) {
		case "pending":
			return "bg-gray-400"
		case "ready":
			return "bg-blue-400"
		case "running":
			return "bg-yellow-400"
		case "succeeded":
			return "bg-green-500"
		case "failed":
			return "bg-red-500"
		case "blocked":
			return "bg-orange-400"
		case "cancelled":
			return "bg-gray-500"
		default:
			return "bg-gray-400"
	}
}
