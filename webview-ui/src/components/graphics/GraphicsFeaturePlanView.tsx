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
	onPlanEdit?: (title: string, briefSummary: string) => void
	onPlanSectionEdit?: (
		section: "pipelineDesign" | "shaderDesign" | "clientDesign",
		summary: string,
		details: string[],
	) => void
	onAssetContractEdit?: (requirements: string[], validationRules: string[]) => void
	onPerformanceBudgetEdit?: (summary: string, details: string[]) => void
	onDecisionEdit?: (rationale: string[], alternatives: Array<{ level: string; reasonNotSelected: string }>) => void
	onCompatibilityEdit?: (compatibility: Array<{ target: string; strategy: string; fallback: string }>) => void
	onPlanContextEdit?: (context: {
		projectContext: string[]
		openQuestions: string[]
		risks: GraphicsFeaturePlan["risks"]
		acceptancePlan: GraphicsFeaturePlan["acceptancePlan"]
	}) => void
}

const DesignSection = ({
	sectionKey,
	title,
	section,
	onEdit,
}: {
	sectionKey: "pipelineDesign" | "shaderDesign" | "clientDesign"
	title: string
	section: GraphicsFeaturePlanSection
	onEdit?: (section: "pipelineDesign" | "shaderDesign" | "clientDesign", summary: string, details: string[]) => void
}) => {
	const [summary, setSummary] = useState(section.summary)
	const [details, setDetails] = useState(section.details)
	useEffect(() => {
		setSummary(section.summary)
		setDetails(section.details)
	}, [section])
	return (
		<div className="rounded-md border border-vscode-panel-border p-3">
			<h4 className="text-xs font-semibold text-vscode-foreground">{title}</h4>
			<textarea
				aria-label={`${title} summary`}
				className="mt-1 min-h-12 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-descriptionForeground"
				value={summary}
				onChange={(event) => setSummary(event.target.value)}
				onBlur={() => onEdit?.(sectionKey, summary, details)}
			/>
			<textarea
				aria-label={`${title} details`}
				className="mt-2 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-descriptionForeground"
				value={details.join("\n")}
				onChange={(event) => setDetails(event.target.value.split("\n"))}
				onBlur={() => onEdit?.(sectionKey, summary, details)}
			/>
		</div>
	)
}

const PerformanceBudgetSection = ({
	section,
	onEdit,
}: {
	section: GraphicsFeaturePlan["performanceBudget"]
	onEdit?: (summary: string, details: string[]) => void
}) => {
	const [summary, setSummary] = useState(section.summary)
	const [details, setDetails] = useState(section.details)
	useEffect(() => {
		setSummary(section.summary)
		setDetails(section.details)
	}, [section])
	return (
		<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">Performance budget</h4>
			<textarea
				aria-label="Performance budget summary"
				className="mt-1 min-h-12 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={summary}
				onChange={(event) => setSummary(event.target.value)}
				onBlur={() => onEdit?.(summary, details)}
			/>
			<textarea
				aria-label="Performance budget details"
				className="mt-2 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={details.join("\n")}
				onChange={(event) => setDetails(event.target.value.split("\n"))}
				onBlur={() => onEdit?.(summary, details)}
			/>
		</div>
	)
}

const AssetContractSection = ({
	contract,
	onEdit,
}: {
	contract: GraphicsFeaturePlan["assetContract"]
	onEdit?: (requirements: string[], validationRules: string[]) => void
}) => {
	const [requirements, setRequirements] = useState(contract.requirements)
	const [validationRules, setValidationRules] = useState(contract.validationRules)
	useEffect(() => {
		setRequirements(contract.requirements)
		setValidationRules(contract.validationRules)
	}, [contract])
	return (
		<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">Asset contract</h4>
			<textarea
				aria-label="Asset requirements"
				className="mt-1 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={requirements.join("\n")}
				onChange={(event) => setRequirements(event.target.value.split("\n"))}
				onBlur={() => onEdit?.(requirements, validationRules)}
			/>
			<textarea
				aria-label="Asset validation rules"
				className="mt-2 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={validationRules.join("\n")}
				onChange={(event) => setValidationRules(event.target.value.split("\n"))}
				onBlur={() => onEdit?.(requirements, validationRules)}
			/>
		</div>
	)
}

const DecisionSection = ({
	decision,
	onEdit,
}: {
	decision: GraphicsFeaturePlan["decision"]
	onEdit?: (rationale: string[], alternatives: Array<{ level: string; reasonNotSelected: string }>) => void
}) => {
	const [rationale, setRationale] = useState(decision.rationale)
	const [alternatives, setAlternatives] = useState(
		decision.alternatives
			.map((alternative) => `${alternative.level} | ${alternative.reasonNotSelected}`)
			.join("\n"),
	)
	useEffect(() => {
		setRationale(decision.rationale)
		setAlternatives(
			decision.alternatives
				.map((alternative) => `${alternative.level} | ${alternative.reasonNotSelected}`)
				.join("\n"),
		)
	}, [decision])
	const emitEdit = () =>
		onEdit?.(
			rationale,
			alternatives
				.split("\n")
				.map((line) => line.split("|").map((part) => part.trim()))
				.filter((parts) => parts.length === 2)
				.map(([level, reasonNotSelected]) => ({ level, reasonNotSelected })),
		)
	return (
		<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">Technical decision</h4>
			<textarea
				aria-label="Decision rationale"
				className="mt-1 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={rationale.join("\n")}
				onChange={(event) => setRationale(event.target.value.split("\n"))}
				onBlur={emitEdit}
			/>
			<p className="mt-2 text-vscode-descriptionForeground">
				One alternative per line: level | reason not selected
			</p>
			<textarea
				aria-label="Decision alternatives"
				className="mt-1 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={alternatives}
				onChange={(event) => setAlternatives(event.target.value)}
				onBlur={emitEdit}
			/>
		</div>
	)
}

/** Provides line-based editors for context, questions, risks, and acceptance evidence. */
const PlanContextSection = ({
	plan,
	onEdit,
}: {
	plan: GraphicsFeaturePlan
	onEdit?: GraphicsFeaturePlanViewProps["onPlanContextEdit"]
}) => {
	const [projectContext, setProjectContext] = useState(plan.projectContext.join("\n"))
	const [openQuestions, setOpenQuestions] = useState(plan.openQuestions.join("\n"))
	const [risks, setRisks] = useState(plan.risks.map(serializeRisk).join("\n"))
	const [acceptancePlan, setAcceptancePlan] = useState(plan.acceptancePlan.map(serializeAcceptance).join("\n"))
	useEffect(() => {
		setProjectContext(plan.projectContext.join("\n"))
		setOpenQuestions(plan.openQuestions.join("\n"))
		setRisks(plan.risks.map(serializeRisk).join("\n"))
		setAcceptancePlan(plan.acceptancePlan.map(serializeAcceptance).join("\n"))
	}, [plan])
	const emitEdit = () =>
		onEdit?.({
			projectContext: parseLines(projectContext),
			openQuestions: parseLines(openQuestions),
			risks: risks
				.split("\n")
				.map((line) => line.split("|").map((part) => part.trim()))
				.filter((parts) => parts.length === 5)
				.map(([id, title, impact, mitigation, reviewGate]) => ({
					id,
					title,
					impact: impact as GraphicsFeaturePlan["risks"][number]["impact"],
					mitigation,
					...(reviewGate ? { reviewGate } : {}),
				})),
			acceptancePlan: acceptancePlan
				.split("\n")
				.map((line) => line.split("|").map((part) => part.trim()))
				.filter((parts) => parts.length === 4)
				.map(([id, dimension, criterion, evidence]) => ({
					id,
					dimension: dimension as GraphicsFeaturePlan["acceptancePlan"][number]["dimension"],
					criterion,
					evidence: evidence as GraphicsFeaturePlan["acceptancePlan"][number]["evidence"],
				})),
		})
	return (
		<div className="space-y-3 rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">Planning context and validation</h4>
			<textarea
				aria-label="Project context"
				className="min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1"
				value={projectContext}
				onChange={(event) => setProjectContext(event.target.value)}
				onBlur={emitEdit}
			/>
			<textarea
				aria-label="Open questions"
				className="min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1"
				value={openQuestions}
				onChange={(event) => setOpenQuestions(event.target.value)}
				onBlur={emitEdit}
			/>
			<p className="text-vscode-descriptionForeground">Risks: id | title | impact | mitigation | review gate</p>
			<textarea
				aria-label="Plan risks"
				className="min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1"
				value={risks}
				onChange={(event) => setRisks(event.target.value)}
				onBlur={emitEdit}
			/>
			<p className="text-vscode-descriptionForeground">Acceptance: id | dimension | criterion | evidence</p>
			<textarea
				aria-label="Acceptance plan"
				className="min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1"
				value={acceptancePlan}
				onChange={(event) => setAcceptancePlan(event.target.value)}
				onBlur={emitEdit}
			/>
		</div>
	)
}

const CompatibilitySection = ({
	compatibility,
	onEdit,
}: {
	compatibility: GraphicsFeaturePlan["compatibility"]
	onEdit?: (compatibility: Array<{ target: string; strategy: string; fallback: string }>) => void
}) => {
	const [value, setValue] = useState(
		compatibility.map((item) => `${item.target} | ${item.strategy} | ${item.fallback}`).join("\n"),
	)
	useEffect(
		() => setValue(compatibility.map((item) => `${item.target} | ${item.strategy} | ${item.fallback}`).join("\n")),
		[compatibility],
	)
	return (
		<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">Compatibility targets</h4>
			<p className="mt-1 text-vscode-descriptionForeground">One target per line: target | strategy | fallback</p>
			<textarea
				aria-label="Compatibility targets"
				className="mt-1 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={value}
				onChange={(event) => setValue(event.target.value)}
				onBlur={() =>
					onEdit?.(
						value
							.split("\n")
							.map((line) => line.split("|").map((part) => part.trim()))
							.filter((parts) => parts.length === 3)
							.map(([target, strategy, fallback]) => ({ target, strategy, fallback })),
					)
				}
			/>
		</div>
	)
}

/** Converts editable line-oriented text into normalized values at the Extension Host boundary. */
const parseLines = (value: string): string[] => value.split("\n")

/** Serializes structured rows into a compact format that remains easy to edit in a Webview textarea. */
const serializeRisk = (risk: GraphicsFeaturePlan["risks"][number]): string =>
	[risk.id, risk.title, risk.impact, risk.mitigation, risk.reviewGate ?? ""].join(" | ")

/** Serializes acceptance rows using the same stable delimiter contract as risk rows. */
const serializeAcceptance = (check: GraphicsFeaturePlan["acceptancePlan"][number]): string =>
	[check.id, check.dimension, check.criterion, check.evidence].join(" | ")

const taskStatuses: GraphicsFeatureTaskStatus[] = ["pending", "in-progress", "blocked", "completed", "skipped"]

export const GraphicsFeaturePlanView = ({
	plan,
	loading,
	onTaskStatusChange,
	onTaskEdit,
	onPlanEdit,
	onPlanSectionEdit,
	onAssetContractEdit,
	onPerformanceBudgetEdit,
	onDecisionEdit,
	onCompatibilityEdit,
	onPlanContextEdit,
}: GraphicsFeaturePlanViewProps) => {
	const [planTitle, setPlanTitle] = useState(plan?.title ?? "")
	const [planSummary, setPlanSummary] = useState(plan?.briefSummary ?? "")
	const [drafts, setDrafts] = useState<
		Record<
			string,
			{ status: GraphicsFeatureTaskStatus; statusNote: string; title: string; completionConditions: string[] }
		>
	>({})

	useEffect(() => {
		if (!plan) return
		setPlanTitle(plan.title)
		setPlanSummary(plan.briefSummary)
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
						<input
							aria-label="Feature plan title"
							className="w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs font-semibold text-vscode-foreground"
							value={planTitle}
							onChange={(event) => setPlanTitle(event.target.value)}
							onBlur={() => onPlanEdit?.(planTitle, planSummary)}
						/>
						<textarea
							aria-label="Feature plan summary"
							className="mt-1 min-h-12 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-descriptionForeground"
							value={planSummary}
							onChange={(event) => setPlanSummary(event.target.value)}
							onBlur={() => onPlanEdit?.(planTitle, planSummary)}
						/>
						<p className="mt-2 text-xs text-vscode-descriptionForeground">
							Decision: {plan.decision.recommendedLevel} · {plan.tasks.length} dependency-ordered tasks ·
							revision {plan.revision}
						</p>
					</div>
					<div className="grid gap-3 md:grid-cols-3">
						<DesignSection
							sectionKey="pipelineDesign"
							title="Pipeline"
							section={plan.pipelineDesign}
							onEdit={onPlanSectionEdit}
						/>
						<DesignSection
							sectionKey="shaderDesign"
							title="Shader"
							section={plan.shaderDesign}
							onEdit={onPlanSectionEdit}
						/>
						<DesignSection
							sectionKey="clientDesign"
							title="Client lifecycle"
							section={plan.clientDesign}
							onEdit={onPlanSectionEdit}
						/>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<PerformanceBudgetSection section={plan.performanceBudget} onEdit={onPerformanceBudgetEdit} />
						<AssetContractSection contract={plan.assetContract} onEdit={onAssetContractEdit} />
					</div>
					<DecisionSection decision={plan.decision} onEdit={onDecisionEdit} />
					<CompatibilitySection compatibility={plan.compatibility} onEdit={onCompatibilityEdit} />
					<PlanContextSection plan={plan} onEdit={onPlanContextEdit} />
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
