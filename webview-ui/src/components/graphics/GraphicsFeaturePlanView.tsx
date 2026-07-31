import { useEffect, useState } from "react"
import type {
	GraphicsFeaturePlan,
	GraphicsFeaturePlanSection,
	GraphicsFeatureTask,
	GraphicsFeatureTaskExecution,
	GraphicsFeatureTaskOwner,
	GraphicsFeatureTaskStatus,
} from "@roo-code/types"
import { ClipboardList, LoaderCircle, ShieldAlert } from "lucide-react"
import { Button } from "@src/components/ui/button"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface GraphicsFeaturePlanViewProps {
	plan: GraphicsFeaturePlan | null
	loading: boolean
	onTaskStatusChange?: (taskId: string, status: GraphicsFeatureTaskStatus, statusNote?: string) => void
	onTaskExecute?: (taskId: string, executor: "agent" | "human", role: GraphicsFeatureTaskOwner) => void
	onTaskCancel?: (taskId: string, executionId?: string) => void
	onTaskRetry?: (taskId: string, executionId?: string) => void
	onTaskEdit?: (taskId: string, title: string, completionConditions: string[], owner: GraphicsFeatureTaskOwner) => void
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
	const { t } = useAppTranslation()
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
				aria-label={t("graphics:plan.designSummary", { title })}
				className="mt-1 min-h-12 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-descriptionForeground"
				value={summary}
				onChange={(event) => setSummary(event.target.value)}
				onBlur={() => onEdit?.(sectionKey, summary, details)}
			/>
			<textarea
				aria-label={t("graphics:plan.designDetails", { title })}
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
	const { t } = useAppTranslation()
	const [summary, setSummary] = useState(section.summary)
	const [details, setDetails] = useState(section.details)
	useEffect(() => {
		setSummary(section.summary)
		setDetails(section.details)
	}, [section])
	return (
		<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">{t("graphics:plan.performanceBudget")}</h4>
			<textarea
				aria-label={t("graphics:plan.performanceSummary")}
				className="mt-1 min-h-12 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={summary}
				onChange={(event) => setSummary(event.target.value)}
				onBlur={() => onEdit?.(summary, details)}
			/>
			<textarea
				aria-label={t("graphics:plan.performanceDetails")}
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
	const { t } = useAppTranslation()
	const [requirements, setRequirements] = useState(contract.requirements)
	const [validationRules, setValidationRules] = useState(contract.validationRules)
	useEffect(() => {
		setRequirements(contract.requirements)
		setValidationRules(contract.validationRules)
	}, [contract])
	return (
		<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">{t("graphics:plan.assetContract")}</h4>
			<textarea
				aria-label={t("graphics:plan.assetRequirements")}
				className="mt-1 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={requirements.join("\n")}
				onChange={(event) => setRequirements(event.target.value.split("\n"))}
				onBlur={() => onEdit?.(requirements, validationRules)}
			/>
			<textarea
				aria-label={t("graphics:plan.assetValidationRules")}
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
	const { t } = useAppTranslation()
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
			<h4 className="font-semibold text-vscode-foreground">{t("graphics:plan.technicalDecision")}</h4>
			<textarea
				aria-label={t("graphics:plan.decisionRationale")}
				className="mt-1 min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-vscode-descriptionForeground"
				value={rationale.join("\n")}
				onChange={(event) => setRationale(event.target.value.split("\n"))}
				onBlur={emitEdit}
			/>
			<p className="mt-2 text-vscode-descriptionForeground">{t("graphics:plan.alternativeFormat")}</p>
			<textarea
				aria-label={t("graphics:plan.decisionAlternatives")}
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
	const { t } = useAppTranslation()
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
			<h4 className="font-semibold text-vscode-foreground">{t("graphics:plan.planningContext")}</h4>
			<textarea
				aria-label={t("graphics:plan.projectContext")}
				className="min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1"
				value={projectContext}
				onChange={(event) => setProjectContext(event.target.value)}
				onBlur={emitEdit}
			/>
			<textarea
				aria-label={t("graphics:plan.openQuestions")}
				className="min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1"
				value={openQuestions}
				onChange={(event) => setOpenQuestions(event.target.value)}
				onBlur={emitEdit}
			/>
			<p className="text-vscode-descriptionForeground">{t("graphics:plan.risksFormat")}</p>
			<textarea
				aria-label={t("graphics:plan.risks")}
				className="min-h-16 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1"
				value={risks}
				onChange={(event) => setRisks(event.target.value)}
				onBlur={emitEdit}
			/>
			<p className="text-vscode-descriptionForeground">{t("graphics:plan.acceptanceFormat")}</p>
			<textarea
				aria-label={t("graphics:plan.acceptancePlan")}
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
	const { t } = useAppTranslation()
	const [value, setValue] = useState(
		compatibility.map((item) => `${item.target} | ${item.strategy} | ${item.fallback}`).join("\n"),
	)
	useEffect(
		() => setValue(compatibility.map((item) => `${item.target} | ${item.strategy} | ${item.fallback}`).join("\n")),
		[compatibility],
	)
	return (
		<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
			<h4 className="font-semibold text-vscode-foreground">{t("graphics:plan.compatibility")}</h4>
			<p className="mt-1 text-vscode-descriptionForeground">{t("graphics:plan.compatibilityFormat")}</p>
			<textarea
				aria-label={t("graphics:plan.compatibilityTargets")}
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
	onTaskExecute,
	onTaskCancel,
	onTaskRetry,
	onTaskEdit,
	onPlanEdit,
	onPlanSectionEdit,
	onAssetContractEdit,
	onPerformanceBudgetEdit,
	onDecisionEdit,
	onCompatibilityEdit,
	onPlanContextEdit,
}: GraphicsFeaturePlanViewProps) => {
	const { t } = useAppTranslation()
	const [planTitle, setPlanTitle] = useState(plan?.title ?? "")
	const [planSummary, setPlanSummary] = useState(plan?.briefSummary ?? "")
	const [executionChoices, setExecutionChoices] = useState<
		Record<string, { executor: "agent" | "human"; role: GraphicsFeatureTaskOwner }>
	>({})
	const [drafts, setDrafts] = useState<
		Record<
			string,
			{ status: GraphicsFeatureTaskStatus; statusNote: string; title: string; completionConditions: string[]; owner: GraphicsFeatureTaskOwner }
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
						owner: task.owner,
					},
				]),
			),
		)
		setExecutionChoices((current) =>
			Object.fromEntries(
				plan.tasks.map((task) => [
					task.id,
					current[task.id] ?? { executor: "agent", role: task.owner },
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
			owner: task.owner,
		}

	const getExecution = (taskId: string): GraphicsFeatureTaskExecution | undefined =>
		plan?.executions
			?.filter((execution) => execution.taskId === taskId)
			.slice(-1)[0]

	const getBlockedDependencies = (task: GraphicsFeatureTask): string[] =>
		task.dependsOn.filter((dependencyId) => plan?.tasks.find((candidate) => candidate.id === dependencyId)?.status !== "completed")

	return (
		<section
			className="space-y-4 rounded-lg border border-vscode-panel-border p-4"
			aria-label={t("graphics:plan.ariaLabel")}>
			<div className="flex items-start gap-3">
				<ClipboardList className="mt-0.5 size-4 text-vscode-focusBorder" />
				<div>
					<h3 className="text-sm font-semibold text-vscode-foreground">{t("graphics:plan.title")}</h3>
					<p className="mt-1 text-xs text-vscode-descriptionForeground">{t("graphics:plan.description")}</p>
				</div>
			</div>
			{loading ? (
				<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground" role="status">
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					{t("graphics:plan.loading")}
				</div>
			) : plan ? (
				<>
					<div className="rounded-md border border-vscode-focusBorder/40 bg-vscode-focusBorder/10 p-3">
						<input
							aria-label={t("graphics:plan.titleField")}
							className="w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs font-semibold text-vscode-foreground"
							value={planTitle}
							onChange={(event) => setPlanTitle(event.target.value)}
							onBlur={() => onPlanEdit?.(planTitle, planSummary)}
						/>
						<textarea
							aria-label={t("graphics:plan.summaryField")}
							className="mt-1 min-h-12 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-descriptionForeground"
							value={planSummary}
							onChange={(event) => setPlanSummary(event.target.value)}
							onBlur={() => onPlanEdit?.(planTitle, planSummary)}
						/>
						<p className="mt-2 text-xs text-vscode-descriptionForeground">
							{t("graphics:plan.decisionSummary", {
								level: plan.decision.recommendedLevel,
								tasks: plan.tasks.length,
								revision: plan.revision,
							})}
						</p>
					</div>
					<div className="grid gap-3 md:grid-cols-3">
						<DesignSection
							sectionKey="pipelineDesign"
							title={t("graphics:plan.pipeline")}
							section={plan.pipelineDesign}
							onEdit={onPlanSectionEdit}
						/>
						<DesignSection
							sectionKey="shaderDesign"
							title={t("graphics:plan.shader")}
							section={plan.shaderDesign}
							onEdit={onPlanSectionEdit}
						/>
						<DesignSection
							sectionKey="clientDesign"
							title={t("graphics:plan.clientLifecycle")}
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
						<h4 className="text-xs font-semibold text-vscode-foreground">
							{t("graphics:plan.implementationTasks")}
						</h4>
						<div className="mt-2 space-y-2">
							{plan.tasks.map((task) => {
								const execution = getExecution(task.id)
								const blockedDependencies = getBlockedDependencies(task)
								const isRunning = execution?.status === "queued" || execution?.status === "running"
								return (
								<div key={task.id} className="rounded-md border border-vscode-panel-border p-3 text-xs">
									<div className="flex items-center justify-between gap-3">
										<input
											aria-label={t("graphics:plan.taskTitle", { taskId: task.id })}
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
												onTaskEdit?.(task.id, draft.title, draft.completionConditions, draft.owner)
											}}
										/>
										<div className="flex flex-wrap items-center justify-end gap-2">
											<select
												aria-label={`${t("graphics:plan.owner")} ${task.id}`}
												className="rounded border border-vscode-panel-border bg-vscode-input-background px-1 py-0.5 text-xs text-vscode-foreground"
												value={getDraft(task).owner}
												disabled={isRunning}
												onChange={(event) =>
													setDrafts((current) => ({
														...current,
														[task.id]: { ...getDraft(task), owner: event.target.value as GraphicsFeatureTaskOwner },
													}))
												}
											>
												{(["graphics", "client", "technical-art", "qa", "design"] as GraphicsFeatureTaskOwner[]).map((owner) => (
													<option key={owner} value={owner}>
														{t(`graphics:plan.role${owner === "technical-art" ? "TechnicalArt" : owner === "qa" ? "Qa" : owner.charAt(0).toUpperCase() + owner.slice(1)}`)}
													</option>
												))}
											</select>
											<select
												aria-label={`${t("graphics:plan.executor")} ${task.id}`}
												className="rounded border border-vscode-panel-border bg-vscode-input-background px-1 py-0.5 text-xs text-vscode-foreground"
												value={executionChoices[task.id]?.executor ?? "agent"}
												disabled={isRunning}
												onChange={(event) =>
													setExecutionChoices((current) => ({
														...current,
														[task.id]: {
															executor: event.target.value as "agent" | "human",
															role: current[task.id]?.role ?? task.owner,
														},
													}))
												}>
													<option value="agent">{t("graphics:plan.executor")} · {t("graphics:plan.agent")}</option>
													<option value="human">{t("graphics:plan.executor")} · {t("graphics:plan.human")}</option>
												</select>
											<select
												aria-label={`${t("graphics:plan.role")} ${task.id}`}
												className="rounded border border-vscode-panel-border bg-vscode-input-background px-1 py-0.5 text-xs text-vscode-foreground"
												value={executionChoices[task.id]?.role ?? task.owner}
												disabled={isRunning}
												onChange={(event) =>
													setExecutionChoices((current) => ({
														...current,
														[task.id]: {
															executor: current[task.id]?.executor ?? "agent",
															role: event.target.value as GraphicsFeatureTaskOwner,
														},
													}))
												}>
													{(["graphics", "client", "technical-art", "qa", "design"] as GraphicsFeatureTaskOwner[]).map(
														(role) => (
															<option key={role} value={role}>
																{t(`graphics:plan.role${role === "technical-art" ? "TechnicalArt" : role === "qa" ? "Qa" : role.charAt(0).toUpperCase() + role.slice(1)}`)}
															</option>
														),
													)}
												</select>
											<button
												disabled={blockedDependencies.length > 0 || isRunning}
												aria-label={t("graphics:plan.executeAria", { taskId: task.id })}
												className="rounded border border-vscode-panel-border px-2 py-0.5 text-xs text-vscode-foreground"
												type="button"
												onClick={() =>
													onTaskExecute?.(
														task.id,
														executionChoices[task.id]?.executor ?? "agent",
														executionChoices[task.id]?.role ?? task.owner,
													)}>
													{t("graphics:plan.execute")}
												</button>
											{execution && isRunning && (
												<button
													type="button"
													aria-label={t("graphics:plan.cancelAria", { taskId: task.id })}
													onClick={() => onTaskCancel?.(task.id, execution.executionId)}>
													{t("graphics:plan.cancel")}
												</button>
											)}
											{execution && (execution.status === "failed" || execution.status === "cancelled") && (
												<button
													type="button"
													aria-label={t("graphics:plan.retryAria", { taskId: task.id })}
													onClick={() => onTaskRetry?.(task.id, execution.executionId)}>
													{t("graphics:plan.retry")}
												</button>
											)}
											<select
												aria-label={t("graphics:plan.status", { taskId: task.id })}
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
										aria-label={t("graphics:plan.statusNote", { taskId: task.id })}
										className="mt-2 min-h-8 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-foreground"
										value={getDraft(task).statusNote}
										placeholder={t("graphics:plan.statusNotePlaceholder")}
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
										aria-label={t("graphics:plan.completionConditions", { taskId: task.id })}
										className="mt-2 min-h-8 w-full rounded border border-vscode-panel-border bg-vscode-input-background px-2 py-1 text-xs text-vscode-foreground"
										value={getDraft(task).completionConditions.join("\n")}
										placeholder={t("graphics:plan.completionPlaceholder")}
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
											onTaskEdit?.(task.id, draft.title, draft.completionConditions, draft.owner)
										}}
									/>
									{blockedDependencies.length > 0 && (
										<p className="mt-1 text-vscode-inputValidation-warningForeground">
											{t("graphics:plan.blocked", { dependencies: blockedDependencies.join(", ") })}
										</p>
									)}
									{execution && (
										<div className="mt-2 space-y-1 text-vscode-descriptionForeground">
											<p>{t("graphics:plan.executionStatus", { status: execution.status })}</p>
											{execution.startedAt ? <p>{t("graphics:plan.executionStarted", { time: new Date(execution.startedAt).toLocaleString() })}</p> : null}
											{execution.finishedAt ? <p>{t("graphics:plan.executionFinished", { time: new Date(execution.finishedAt).toLocaleString() })}</p> : null}
											{execution.output?.length ? (
												<div>
													<p className="font-medium">{t("graphics:plan.executionOutput", { output: "" })}</p>
													<ul className="list-disc space-y-0.5 pl-4">
														{execution.output.map((output, index) => <li key={`${execution.executionId}-output-${index}`}>{output}</li>)}
													</ul>
												</div>
											) : null}
											{execution.error ? <p className="text-vscode-errorForeground">{t("graphics:plan.executionError", { error: execution.error })}</p> : null}
											{execution.logs?.length ? (
												<div>
													<p className="font-medium">{t("graphics:plan.executionLogs", { logs: "" })}</p>
													<ul className="list-disc space-y-0.5 pl-4">
														{execution.logs.map((log, index) => <li key={`${execution.executionId}-log-${index}`}>{log.message}</li>)}
													</ul>
												</div>
											) : null}
										</div>
									)}
									<p className="mt-1 text-vscode-descriptionForeground">
										{t("graphics:plan.dependencies", {
											dependencies: task.dependsOn.join(", ") || t("graphics:plan.none"),
										})}{" "}
										{t("graphics:plan.output", { output: task.outputs.join(", ") })}
									</p>
								</div>
								)
							})}
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-md border border-vscode-panel-border p-3 text-xs">
							<h4 className="font-semibold text-vscode-foreground">{t("graphics:plan.acceptance")}</h4>
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
				<p className="text-xs text-vscode-descriptionForeground">{t("graphics:plan.empty")}</p>
			)}
		</section>
	)
}
