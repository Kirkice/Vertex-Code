import { useEffect, useState } from "react"
import type {
	GraphicsFeaturePlan,
	GraphicsFeaturePlanSection,
	GraphicsFeatureTask,
	GraphicsFeatureTaskStatus,
} from "@roo-code/types"
import { ClipboardList, LoaderCircle, ShieldAlert } from "lucide-react"
import { Button } from "@src/components/ui/button"

interface GraphicsFeaturePlanViewProps {
	plan: GraphicsFeaturePlan | null
	loading: boolean
	onTaskStatusChange?: (taskId: string, status: GraphicsFeatureTaskStatus, statusNote?: string) => void
	onTaskEdit?: (taskId: string, title: string, completionConditions: string[]) => void
}

const DesignSection = ({ title, section }: { title: string; section: GraphicsFeaturePlanSection }) => (
	<div className="rounded-md border border-vscode-panel-border p-3">
		<h4 className="text-xs font-semibold text-vscode-foreground">{title}</h4>
		<p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">{section.summary}</p>
		<ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-vscode-descriptionForeground">
			{section.details.map((detail) => (
				<li key={detail}>{detail}</li>
			))}
		</ul>
	</div>
)

const taskStatuses: GraphicsFeatureTaskStatus[] = ["pending", "in-progress", "blocked", "completed", "skipped"]

export const GraphicsFeaturePlanView = ({
	plan,
	loading,
	onTaskStatusChange,
	onTaskEdit,
}: GraphicsFeaturePlanViewProps) => {
	const [drafts, setDrafts] = useState<
		Record<
			string,
			{ status: GraphicsFeatureTaskStatus; statusNote: string; title: string; completionConditions: string[] }
		>
	>({})

	useEffect(() => {
		if (!plan) return
		setDrafts(
			Object.fromEntries(
				plan.tasks.map((task) => [
					task.id,
					{
						status: task.status,
						statusNote: task.statusNote ?? "",
						title: task.title,
						completionConditions: task.completionConditions,
					},
				]),
			),
		)
	}, [plan])

	const getDraft = (task: GraphicsFeatureTask) =>
		drafts[task.id] ?? {
			status: task.status,
			statusNote: task.statusNote ?? "",
			title: task.title,
			completionConditions: task.completionConditions,
		}

	return (
		<section
			className="space-y-4 rounded-lg border border-vscode-panel-border p-4"
			aria-label="Graphics Feature Plan">
			<div className="flex items-start gap-3">
				<ClipboardList className="mt-0.5 size-4 text-vscode-focusBorder" />
				<div>
					<h3 className="text-sm font-semibold text-vscode-foreground">Cross-module implementation plan</h3>
					<p className="mt-1 text-xs text-vscode-descriptionForeground">
						Dependency-ordered work across rendering, shaders, client lifecycle, assets, and validation.
					</p>
				</div>
			</div>
			{loading ? (
				<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground">
					<LoaderCircle className="size-4 animate-spin" />
					Generating cross-module feature plan…
				</div>
			) : plan ? (
				<>
					<div className="rounded-md border border-vscode-focusBorder/40 bg-vscode-focusBorder/10 p-3">
						<div className="text-xs font-semibold text-vscode-foreground">{plan.title}</div>
						<p className="mt-1 text-xs text-vscode-descriptionForeground">{plan.briefSummary}</p>
						<p className="mt-2 text-xs text-vscode-descriptionForeground">
							Decision: {plan.decision.recommendedLevel} · {plan.tasks.length} dependency-ordered tasks ·
							revision {plan.revision}
						</p>
					</div>
					<div className="grid gap-3 md:grid-cols-3">
						<DesignSection title="Pipeline" section={plan.pipelineDesign} />
						<DesignSection title="Shader" section={plan.shaderDesign} />
						<DesignSection title="Client lifecycle" section={plan.clientDesign} />
					</div>
					<div>
						<h4 className="text-xs font-semibold text-vscode-foreground">Implementation tasks</h4>
						<div className="mt-2 space-y-2">
							{plan.tasks.map((task) => (
								<div key={task.id} className="rounded-md border border-vscode-panel-border p-3 text-xs">
									<div className="flex items-center justify-between gap-3">
										<input
											aria-label={`${task.id} title`}
											className="min-w-0 flex-1 rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 font-medium text-vscode-foreground"
											value={getDraft(task).title}
											onChange={(event) =>
												setDrafts((current) => ({
													...current,
													[task.id]: { ...getDraft(task), title: event.target.value },
												}))
											}
											onBlur={() => {
												const draft = getDraft(task)
												onTaskEdit?.(task.id, draft.title, draft.completionConditions)
											}}
										/>
										<div className="flex items-center gap-2">
											<span className="text-vscode-descriptionForeground">{task.owner}</span>
											<select
												aria-label={`${task.id} status`}
												className="rounded border border-vscode-panel-border bg-vscode-input-background px-1 py-0.5 text-xs text-vscode-foreground"
												value={getDraft(task).status}
												onChange={(event) => {
													const status = event.target.value as GraphicsFeatureTaskStatus
													const draft = { ...getDraft(task), status }
													setDrafts((current) => ({ ...current, [task.id]: draft }))
													onTaskStatusChange?.(task.id, status, draft.statusNote)
												}}>
												{taskStatuses.map((status) => (
													<option key={status} value={status}>
														{status}
													</option>
												))}
											</select>
										</div>
									</div>
									<textarea
										aria-label={`${task.id} status note`}
										className="mt-2 min-h-8 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-foreground"
										value={getDraft(task).statusNote}
										placeholder="Add a status note"
										onChange={(event) =>
											setDrafts((current) => ({
												...current,
												[task.id]: { ...getDraft(task), statusNote: event.target.value },
											}))
										}
										onBlur={(event) =>
											onTaskStatusChange?.(task.id, getDraft(task).status, event.target.value)
										}
									/>
									<textarea
										aria-label={`${task.id} completion conditions`}
										className="mt-2 min-h-8 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-foreground"
										value={getDraft(task).completionConditions.join("\n")}
										placeholder="One completion condition per line"
										onChange={(event) =>
											setDrafts((current) => ({
												...current,
												[task.id]: {
													...getDraft(task),
													completionConditions: event.target.value.split("\n"),
												},
											}))
										}
										onBlur={() => {
											const draft = getDraft(task)
											onTaskEdit?.(task.id, draft.title, draft.completionConditions)
										}}
									/>
									<p className="mt-1 text-vscode-descriptionForeground">
										Depends on: {task.dependsOn.join(", ") || "none"} · Output:{" "}
										{task.outputs.join(", ")}
									</p>
								</div>
							))}
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
							<h4 className="font-semibold text-vscode-foreground">Asset contract</h4>
							<p className="mt-1 text-vscode-descriptionForeground">
								{plan.assetContract.requirements.join(" ")}
							</p>
						</div>
						<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
							<h4 className="font-semibold text-vscode-foreground">Acceptance</h4>
							<p className="mt-1 text-vscode-descriptionForeground">
								{plan.acceptancePlan
									.map((check) => `${check.dimension}: ${check.evidence}`)
									.join(" · ")}
							</p>
						</div>
					</div>
					{plan.risks.some((risk) => risk.reviewGate) && (
						<div className="flex items-start gap-2 rounded-md border border-vscode-inputValidation-warningBorder p-3 text-xs text-vscode-descriptionForeground">
							<ShieldAlert className="mt-0.5 size-4 shrink-0" />
							<span>
								{plan.risks
									.filter((risk) => risk.reviewGate)
									.map((risk) => risk.reviewGate)
									.join(" ")}
							</span>
						</div>
					)}
				</>
			) : (
				<p className="text-xs text-vscode-descriptionForeground">
					Generate a solution recommendation, then create the implementation plan.
				</p>
			)}
		</section>
	)
}
