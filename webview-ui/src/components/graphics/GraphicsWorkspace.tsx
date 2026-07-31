import React, { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Box, Check, Cpu, FileCode2, Puzzle, Sparkles } from "lucide-react"

import type {
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
	GraphicsFeaturePlanMergeConflict,
	GraphicsFeatureTaskOwner,
	GraphicsFeatureTaskStatus,
	GraphicsProjectProfile,
	GraphicsProviderStatusPayload,
	GraphicsSolutionRecommendation,
	GraphicsWebviewPersistedState,
	GraphicsWorkspaceCapability,
	GraphicsWorkspaceSection,
} from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { Button, Input, Textarea } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Tab, TabContent, TabHeader, TabList, TabTrigger } from "@src/components/common/Tab"
import { GraphicsFeaturePlanView } from "./GraphicsFeaturePlanView"
import { GraphicsProjectProfileCard } from "./GraphicsProjectProfileCard"
import { GraphicsSolutionRecommendationCard } from "./GraphicsSolutionRecommendationCard"

interface GraphicsWorkspaceProps {
	onDone: () => void
}

const coreCapabilities: GraphicsWorkspaceCapability[] = [
	{
		id: "feature-planning",
		label: "graphics:capabilities.featurePlanning",
		description: "graphics:capabilities.featurePlanningDescription",
		availability: "available",
	},
	{
		id: "source-analysis",
		label: "graphics:capabilities.sourceAnalysis",
		description: "graphics:capabilities.sourceAnalysisDescription",
		availability: "available",
	},
]

const statusTone: Record<GraphicsWorkspaceCapability["availability"], string> = {
	available: "text-vscode-testing-iconPassed",
	unavailable: "text-vscode-descriptionForeground",
	degraded: "text-vscode-editorWarning-foreground",
	unknown: "text-vscode-descriptionForeground",
}

const CapabilityCard = ({ capability }: { capability: GraphicsWorkspaceCapability }) => {
	const { t } = useAppTranslation()
	const translated = (value: string | undefined) => (value?.includes(":") ? t(value) : value)

	return (
		<div className="rounded-lg border border-vscode-panel-border bg-vscode-editor-background p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold text-vscode-foreground">{translated(capability.label)}</h3>
					<p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">
						{translated(capability.description)}
					</p>
				</div>
				<span className={`text-xs capitalize ${statusTone[capability.availability]}`}>
					{t(`graphics:availability.${capability.availability}`)}
				</span>
			</div>
			{capability.reason && (
				<p className="mt-3 text-xs text-vscode-descriptionForeground">{translated(capability.reason)}</p>
			)}
		</div>
	)
}

const emptyFeatureBrief: GraphicsFeatureBrief = {
	version: 1,
	title: "",
	visualGoal: "",
	lifecycle: "",
	artControls: "",
	targetPlatforms: "",
	performanceBudget: "",
	compatibilityRequirements: "",
	acceptanceCriteria: "",
}

const loadFeatureBrief = (): GraphicsFeatureBrief => {
	const state = vscode.getState() as GraphicsWebviewPersistedState | undefined
	const brief = state?.graphicsWorkspace?.featureBrief
	return brief?.version === 1 ? { ...emptyFeatureBrief, ...brief } : emptyFeatureBrief
}

const persistFeatureBriefLocally = (featureBrief: GraphicsFeatureBrief) => {
	const currentState = (vscode.getState() as GraphicsWebviewPersistedState | undefined) ?? {}
	vscode.setState({
		...currentState,
		graphicsWorkspace: {
			...currentState.graphicsWorkspace,
			featureBrief,
		},
	})
}

const briefFields: Array<{
	key: Exclude<keyof GraphicsFeatureBrief, "version" | "updatedAt">
	label: string
	placeholder: string
	singleLine?: boolean
}> = [
	{
		key: "title",
		label: "graphics:brief.fields.title.label",
		placeholder: "graphics:brief.fields.title.placeholder",
		singleLine: true,
	},
	{
		key: "visualGoal",
		label: "graphics:brief.fields.visualGoal.label",
		placeholder: "graphics:brief.fields.visualGoal.placeholder",
	},
	{
		key: "lifecycle",
		label: "graphics:brief.fields.lifecycle.label",
		placeholder: "graphics:brief.fields.lifecycle.placeholder",
	},
	{
		key: "artControls",
		label: "graphics:brief.fields.artControls.label",
		placeholder: "graphics:brief.fields.artControls.placeholder",
	},
	{
		key: "targetPlatforms",
		label: "graphics:brief.fields.targetPlatforms.label",
		placeholder: "graphics:brief.fields.targetPlatforms.placeholder",
	},
	{
		key: "performanceBudget",
		label: "graphics:brief.fields.performanceBudget.label",
		placeholder: "graphics:brief.fields.performanceBudget.placeholder",
	},
	{
		key: "compatibilityRequirements",
		label: "graphics:brief.fields.compatibilityRequirements.label",
		placeholder: "graphics:brief.fields.compatibilityRequirements.placeholder",
	},
	{
		key: "acceptanceCriteria",
		label: "graphics:brief.fields.acceptanceCriteria.label",
		placeholder: "graphics:brief.fields.acceptanceCriteria.placeholder",
	},
]

const FeatureHome = () => {
	const { t } = useAppTranslation()
	const [initialLocalBrief] = useState<GraphicsFeatureBrief>(loadFeatureBrief)
	const [featureBrief, setFeatureBrief] = useState<GraphicsFeatureBrief>(initialLocalBrief)
	const [projectProfile, setProjectProfile] = useState<GraphicsProjectProfile | null>(null)
	const [profileLoading, setProfileLoading] = useState(true)
	const [solutionRecommendation, setSolutionRecommendation] = useState<GraphicsSolutionRecommendation | null>(null)
	const [solutionLoading, setSolutionLoading] = useState(false)
	const [featurePlan, setFeaturePlan] = useState<GraphicsFeaturePlan | null>(null)
	const [planLoading, setPlanLoading] = useState(false)
	const [saved, setSaved] = useState(false)
	const [announcement, setAnnouncement] = useState("")
	const lastFocusedElement = useRef<HTMLElement | null>(null)
	const planRegionRef = useRef<HTMLDivElement | null>(null)
	// Preserve base/local/shared versions so conflict resolution never discards unsaved work.
	const [planBase, setPlanBase] = useState<GraphicsFeaturePlan | undefined>()
	const [planConflict, setPlanConflict] = useState<{
		currentPlan?: GraphicsFeaturePlan
		error?: string
	} | null>(null)
	// Keep the complete preview separate from the banner so every field choice can
	// accumulate without losing the merged candidate returned by the Extension Host.
	const [mergePreview, setMergePreview] = useState<{
		baseRevision: number
		currentRevision: number
		mergedPlan?: GraphicsFeaturePlan
		conflicts: GraphicsFeaturePlanMergeConflict[]
	} | null>(null)
	const [mergeChoices, setMergeChoices] = useState<Record<string, "local" | "shared">>({})

	const requestProjectProfile = () => {
		setProfileLoading(true)
		vscode.postMessage({ type: "requestGraphicsProjectProfile" })
	}

	useEffect(() => {
		let migrationRequested = false
		const onMessage = (event: MessageEvent) => {
			if (
				event.data?.type === "graphicsFeaturePlan" ||
				event.data?.type === "graphicsFeaturePlanUpdated" ||
				event.data?.type === "graphicsFeaturePlanRecovered" ||
				event.data?.type === "graphicsFeaturePlanEdited" ||
				event.data?.type === "graphicsFeatureTaskExecutionUpdated"
			) {
				const nextPlan = event.data.graphicsFeaturePlan as GraphicsFeaturePlan
				setFeaturePlan(nextPlan)
				if (event.data?.type === "graphicsFeaturePlanRecovered") {
					setAnnouncement(t("graphics:workspace.announcements.reloaded"))
				}
				// A functional update avoids a stale effect closure when recovery and
				// execution updates arrive in the same event loop turn.
				setPlanBase((current) => current ?? nextPlan)
				setPlanConflict(null)
				if (event.data?.type === "graphicsFeaturePlanEdited") {
					setMergePreview(null)
					setMergeChoices({})
				}
				setPlanLoading(false)
				return
			}
			if (event.data?.type === "graphicsFeaturePlanConflict") {
				// Do not replace the local draft here. Keeping both versions in state lets
				// the conflict banner offer an explicit reload decision instead of silently
				// discarding edits from this window.
				setAnnouncement(t("graphics:workspace.announcements.conflict"))
				setPlanConflict({
					currentPlan: event.data.graphicsFeaturePlanConflict?.currentPlan ?? event.data.graphicsFeaturePlan,
					error: event.data.graphicsFeaturePlanError,
				})
				setMergePreview(null)
				setMergeChoices({})
				return
			}
			if (event.data?.type === "graphicsFeaturePlanMergePreview") {
				const preview = event.data.graphicsFeaturePlanMergePreview
				setMergePreview(preview ?? null)
				setPlanConflict((current) => ({
					...current,
					currentPlan: current?.currentPlan,
				}))
				setPlanLoading(false)
				return
			}
			if (event.data?.type === "graphicsFeaturePlanExternalChange") {
				// The extension watcher only signals that the file changed. Re-read the
				// project snapshot through the normal recovery path instead of trusting a
				// stale local plan or assuming the event contains the new payload.
				setAnnouncement(t("graphics:workspace.announcements.reloading"))
				setPlanLoading(true)
				vscode.postMessage({ type: "requestGraphicsFeaturePlanRecovery" })
				return
			}
			if (event.data?.type === "graphicsSolutionRecommendation") {
				setSolutionRecommendation(event.data.graphicsSolutionRecommendation as GraphicsSolutionRecommendation)
				setSolutionLoading(false)
				return
			}
			if (event.data?.type === "graphicsProjectProfile") {
				setProjectProfile(event.data.graphicsProjectProfile as GraphicsProjectProfile)
				setProfileLoading(false)
				return
			}
			if (event.data?.type !== "graphicsFeatureBrief") {
				return
			}

			const workspaceBrief = event.data.graphicsFeatureBrief as GraphicsFeatureBrief | undefined
			if (workspaceBrief?.version === 1) {
				const normalizedBrief = { ...emptyFeatureBrief, ...workspaceBrief }
				setFeatureBrief(normalizedBrief)
				persistFeatureBriefLocally(normalizedBrief)
				setSaved(true)
			} else if (initialLocalBrief.updatedAt && !migrationRequested) {
				migrationRequested = true
				vscode.postMessage({
					type: "saveGraphicsFeatureBrief",
					graphicsFeatureBrief: initialLocalBrief,
				})
			}
		}

		window.addEventListener("message", onMessage)
		vscode.postMessage({ type: "requestGraphicsFeatureBrief" })
		vscode.postMessage({ type: "requestGraphicsFeaturePlanRecovery" })
		vscode.postMessage({ type: "requestGraphicsProjectProfile" })
		return () => window.removeEventListener("message", onMessage)
	}, [initialLocalBrief])

	useEffect(() => {
		if (planConflict) {
			planRegionRef.current?.focus()
		}
	}, [planConflict])

	const updateField = (key: (typeof briefFields)[number]["key"], value: string) => {
		setFeatureBrief((current) => ({ ...current, [key]: value }))
		setSolutionRecommendation(null)
		setFeaturePlan(null)
		setSaved(false)
	}

	const requestSolutionRecommendation = () => {
		setSolutionLoading(true)
		vscode.postMessage({
			type: "requestGraphicsSolutionRecommendation",
			graphicsFeatureBrief: featureBrief,
		})
	}

	const executeTask = (taskId: string, executor: "agent" | "human", role: GraphicsFeatureTaskOwner) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "executeGraphicsFeatureTask",
			graphicsFeatureTaskId: taskId,
			graphicsFeatureTaskExecutor: executor,
			graphicsFeatureTaskRole: role,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	/** Sends cancellation for a specific Graphics execution, never the active chat task. */
	const cancelTaskExecution = (taskId: string, executionId?: string) => {
		vscode.postMessage({
			type: "cancelGraphicsFeatureTaskExecution",
			graphicsFeatureTaskId: taskId,
			graphicsFeatureExecutionId: executionId,
		})
	}

	/** Requests a fresh attempt while keeping the previous attempt in execution history. */
	const retryTaskExecution = (taskId: string, executionId?: string) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "retryGraphicsFeatureTaskExecution",
			graphicsFeatureTaskId: taskId,
			graphicsFeatureExecutionId: executionId,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updateTaskStatus = (taskId: string, status: GraphicsFeatureTaskStatus, statusNote?: string) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeatureTaskStatus",
			graphicsFeatureTaskId: taskId,
			graphicsFeatureTaskStatus: status,
			...(statusNote ? { graphicsFeatureTaskStatusNote: statusNote } : {}),
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updateTask = (
		taskId: string,
		title: string,
		completionConditions: string[],
		owner: GraphicsFeatureTaskOwner,
	) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeatureTask",
			graphicsFeatureTaskId: taskId,
			graphicsFeatureTaskTitle: title,
			graphicsFeatureTaskCompletionConditions: completionConditions,
			graphicsFeatureTaskOwner: owner,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updatePlan = (title: string, briefSummary: string) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeaturePlan",
			graphicsFeaturePlanTitle: title,
			graphicsFeaturePlanBriefSummary: briefSummary,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updateAssetContract = (requirements: string[], validationRules: string[]) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeatureAssetContract",
			graphicsFeatureAssetRequirements: requirements,
			graphicsFeatureAssetValidationRules: validationRules,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updatePerformanceBudget = (summary: string, details: string[]) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeaturePerformanceBudget",
			graphicsFeaturePerformanceBudgetSummary: summary,
			graphicsFeaturePerformanceBudgetDetails: details,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updateDecision = (rationale: string[], alternatives: Array<{ level: string; reasonNotSelected: string }>) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeatureDecision",
			graphicsFeatureDecisionRationale: rationale,
			graphicsFeatureDecisionAlternatives: alternatives,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updateCompatibility = (compatibility: Array<{ target: string; strategy: string; fallback: string }>) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeatureCompatibility",
			graphicsFeatureCompatibility: compatibility,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	/** Sends all editable planning-context sections with the revision currently visible in the Webview. */
	const updatePlanContext = (context: {
		projectContext: string[]
		openQuestions: string[]
		risks: GraphicsFeaturePlan["risks"]
		acceptancePlan: GraphicsFeaturePlan["acceptancePlan"]
	}) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeaturePlanContext",
			graphicsFeatureProjectContext: context.projectContext,
			graphicsFeatureOpenQuestions: context.openQuestions,
			graphicsFeatureRisks: context.risks,
			graphicsFeatureAcceptancePlan: context.acceptancePlan,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const updatePlanSection = (
		section: "pipelineDesign" | "shaderDesign" | "clientDesign",
		summary: string,
		details: string[],
	) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeaturePlanSection",
			graphicsFeaturePlanSection: section,
			graphicsFeaturePlanSectionSummary: summary,
			graphicsFeaturePlanSectionDetails: details,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const requestFeaturePlan = () => {
		setPlanLoading(true)
		setAnnouncement(t("graphics:workspace.announcements.loading"))
		vscode.postMessage({
			type: "requestGraphicsFeaturePlan",
			graphicsFeatureBrief: featureBrief,
		})
	}

	const saveFeatureBrief = () => {
		const nextBrief = { ...featureBrief, updatedAt: new Date().toISOString() }
		persistFeatureBriefLocally(nextBrief)
		vscode.postMessage({ type: "saveGraphicsFeatureBrief", graphicsFeatureBrief: nextBrief })
		setFeatureBrief(nextBrief)
		setSaved(true)
		setAnnouncement(t("graphics:workspace.announcements.saved"))
	}

	return (
		<div className="space-y-5" data-testid="graphics-feature-home">
			<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
				{announcement}
			</div>
			<section className="rounded-xl border border-vscode-focusBorder/40 bg-vscode-editor-background p-5">
				<div className="flex items-start gap-3">
					<Sparkles className="mt-0.5 size-5 text-vscode-focusBorder" />
					<div>
						<h2 className="text-base font-semibold text-vscode-foreground">
							{t("graphics:featureHome.title")}
						</h2>
						<p className="mt-1 text-sm leading-relaxed text-vscode-descriptionForeground">
							{t("graphics:featureHome.description")}
						</p>
					</div>
				</div>
			</section>

			<GraphicsProjectProfileCard
				profile={projectProfile}
				loading={profileLoading}
				onRefresh={requestProjectProfile}
			/>

			<section
				className="space-y-4 rounded-lg border border-vscode-panel-border p-4"
				aria-label={t("graphics:brief.title")}>
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-semibold text-vscode-foreground">{t("graphics:brief.title")}</h3>
						<p className="mt-1 text-xs text-vscode-descriptionForeground">
							{t("graphics:brief.description")}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={requestSolutionRecommendation}
							disabled={solutionLoading || !featureBrief.title.trim()}
							aria-label={t("graphics:brief.compareSolutionsAria")}>
							{t("graphics:brief.compareSolutions")}
						</Button>
						<Button
							size="sm"
							onClick={saveFeatureBrief}
							aria-label={t("graphics:brief.saveAria")}
							type="button">
							{saved && <Check className="size-4" />}
							{saved ? t("graphics:brief.saved") : t("graphics:brief.saveDraft")}
						</Button>
					</div>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					{briefFields.map((field) => (
						<label key={field.key} className={field.key === "title" ? "md:col-span-2" : "space-y-1.5"}>
							<span className="text-xs font-medium text-vscode-foreground">{t(field.label)}</span>
							{field.singleLine ? (
								<Input
									value={featureBrief[field.key]}
									onChange={(event) => updateField(field.key, event.target.value)}
									placeholder={t(field.placeholder)}
								/>
							) : (
								<Textarea
									value={featureBrief[field.key]}
									onChange={(event) => updateField(field.key, event.target.value)}
									placeholder={t(field.placeholder)}
								/>
							)}
						</label>
					))}
				</div>
			</section>

			<GraphicsSolutionRecommendationCard recommendation={solutionRecommendation} loading={solutionLoading} />

			<div className="flex justify-end">
				<Button
					variant="secondary"
					size="sm"
					onClick={requestFeaturePlan}
					disabled={!solutionRecommendation || planLoading}
					aria-label={t("graphics:brief.createPlanAria")}>
					{t("graphics:brief.createPlan")}
				</Button>
			</div>
			{planConflict ? (
				<div
					ref={planRegionRef}
					tabIndex={-1}
					className="rounded-md border border-vscode-editorWarning-foreground/60 bg-vscode-editorWarning-background/20 p-3 text-xs"
					role="alert">
					<p className="font-semibold text-vscode-editorWarning-foreground">
						{t("graphics:plan.conflictTitle")}
					</p>
					<p className="mt-1 text-vscode-descriptionForeground">
						{planConflict.error ?? t("graphics:plan.conflictDescription")}
					</p>
					<div className="mt-2 flex flex-wrap gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled={!planConflict.currentPlan}
							onClick={() => {
								lastFocusedElement.current = document.activeElement as HTMLElement | null
								if (planConflict.currentPlan) {
									setFeaturePlan(planConflict.currentPlan)
									setPlanBase(planConflict.currentPlan)
								}
								setAnnouncement(t("graphics:workspace.announcements.reloaded"))
								setPlanConflict(null)
								requestAnimationFrame(() => {
									lastFocusedElement.current?.focus()
									lastFocusedElement.current = null
								})
								setMergePreview(null)
								setMergeChoices({})
							}}>
							{t("graphics:plan.reloadShared")}
						</Button>
						<Button
							variant="secondary"
							size="sm"
							disabled={!planBase || !featurePlan || !planConflict.currentPlan}
							onClick={() => {
								if (!planBase || !featurePlan || !planConflict.currentPlan) return
								setMergePreview(null)
								setMergeChoices({})
								setPlanLoading(true)
								vscode.postMessage({
									type: "previewGraphicsFeaturePlanMerge",
									graphicsFeaturePlanBase: planBase,
									graphicsFeaturePlanLocal: featurePlan,
								})
							}}>
							{t("graphics:plan.previewMerge")}
						</Button>
						{mergePreview?.conflicts.length ? (
							<div
								className="mt-2 w-full space-y-2"
								role="group"
								aria-label={t("graphics:plan.mergeConflicts", { count: mergePreview.conflicts.length })}>
								<p className="text-vscode-editorWarning-foreground">
									{t("graphics:plan.mergeConflicts", { count: mergePreview.conflicts.length })}
								</p>
								{mergePreview.conflicts.map((conflict) => (
									<div key={conflict.path} className="rounded border border-vscode-panel-border p-2">
										<code className="text-vscode-foreground">{conflict.path}</code>
										<div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
											<div>
												<span className="font-semibold">{t("graphics:plan.mergeBase")}</span>
												<pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-vscode-descriptionForeground">
													{JSON.stringify(conflict.baseValue, null, 2)}
												</pre>
											</div>
											<div>
												<span className="font-semibold">{t("graphics:plan.mergeLocal")}</span>
												<pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-vscode-foreground">
													{JSON.stringify(conflict.localValue, null, 2)}
												</pre>
											</div>
											<div>
												<span className="font-semibold">{t("graphics:plan.mergeShared")}</span>
												<pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-vscode-foreground">
													{JSON.stringify(conflict.currentValue, null, 2)}
												</pre>
											</div>
										</div>
										<div className="mt-2 flex flex-wrap items-center gap-2">
											<Button
												variant={mergeChoices[conflict.path] === "local" ? "secondary" : "ghost"}
												size="sm"
												onClick={() =>
													setMergeChoices((current) => ({ ...current, [conflict.path]: "local" }))
												}>
												{t("graphics:plan.useLocal")}
											</Button>
											<Button
												variant={mergeChoices[conflict.path] === "shared" ? "secondary" : "ghost"}
												size="sm"
												onClick={() =>
													setMergeChoices((current) => ({ ...current, [conflict.path]: "shared" }))
												}>
												{t("graphics:plan.useShared")}
											</Button>
											{mergeChoices[conflict.path] ? (
												<span className="text-vscode-descriptionForeground">
													{t("graphics:plan.choiceSelected", { choice: mergeChoices[conflict.path] })}
												</span>
											) : null}
										</div>
									</div>
								))}
								<Button
									variant="secondary"
									size="sm"
									disabled={!planBase || !featurePlan || Object.keys(mergeChoices).length < mergePreview.conflicts.length}
									onClick={() => {
										if (!planBase || !featurePlan) return
										vscode.postMessage({
											type: "mergeGraphicsFeaturePlan",
											graphicsFeaturePlanBase: planBase,
											graphicsFeaturePlanLocal: featurePlan,
											graphicsFeaturePlanChoices: mergeChoices,
										})
									}}>
									{t("graphics:plan.saveMerged")}
								</Button>
							</div>
						) : null}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setAnnouncement(t("graphics:workspace.announcements.localDraft"))
								setPlanConflict(null)
								requestAnimationFrame(() => {
									lastFocusedElement.current?.focus()
									lastFocusedElement.current = null
								})
								setMergePreview(null)
								setMergeChoices({})
							}}>
							{t("graphics:plan.keepLocalDraft")}
						</Button>
					</div>
				</div>
			) : null}
			<GraphicsFeaturePlanView
				plan={featurePlan}
				loading={planLoading}
				onTaskStatusChange={updateTaskStatus}
				onTaskExecute={executeTask}
				onTaskCancel={cancelTaskExecution}
				onTaskRetry={retryTaskExecution}
				onTaskEdit={updateTask}
				onPlanEdit={updatePlan}
				onPlanSectionEdit={updatePlanSection}
				onAssetContractEdit={updateAssetContract}
				onPerformanceBudgetEdit={updatePerformanceBudget}
				onDecisionEdit={updateDecision}
				onCompatibilityEdit={updateCompatibility}
				onPlanContextEdit={updatePlanContext}
			/>

			<div className="grid gap-3 md:grid-cols-2">
				{coreCapabilities.map((capability) => (
					<CapabilityCard key={capability.id} capability={capability} />
				))}
			</div>
		</div>
	)
}

const AssetValidation = () => {
	const { t } = useAppTranslation()

	return (
		<div className="space-y-4" data-testid="graphics-asset-validation">
			<CapabilityCard
				capability={{
					id: "asset-validation",
					label: "graphics:capabilities.assetValidation",
					description: "graphics:capabilities.assetValidationDescription",
					availability: "unavailable",
					reason: "graphics:capabilities.assetValidationReason",
				}}
			/>
			<div className="rounded-lg border border-dashed border-vscode-panel-border p-5 text-sm text-vscode-descriptionForeground">
				<Box className="mb-3 size-5" aria-hidden="true" />
				{t("graphics:capabilities.assetRoadmap")}
			</div>
		</div>
	)
}

const RuntimeInvestigation = () => {
	const { t } = useAppTranslation()
	const [loading, setLoading] = useState(true)
	const [status, setStatus] = useState<GraphicsProviderStatusPayload | null>(null)

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.data?.type === "graphicsProviderStatus") {
				setStatus(event.data.values as GraphicsProviderStatusPayload)
				setLoading(false)
			}
		}

		window.addEventListener("message", onMessage)
		vscode.postMessage({ type: "requestGraphicsProviderStatus" })
		return () => window.removeEventListener("message", onMessage)
	}, [])

	const selectedProvider = status?.providers.find((provider) => provider.providerId === status.selectedProviderId)
	const availableProvider = selectedProvider ?? status?.providers.find((provider) => provider.status === "available")
	const runtimeAvailable = availableProvider?.status === "available" || availableProvider?.status === "no-capture"

	const runtimeCapability: GraphicsWorkspaceCapability = {
		id: "runtime-capture",
		label: "graphics:capabilities.runtimeGpu",
		description: "graphics:capabilities.runtimeGpuDescription",
		availability: loading ? "unknown" : runtimeAvailable ? "available" : "unavailable",
		providerId: availableProvider?.providerId,
		providerName: availableProvider?.providerName,
		reason: loading
			? "graphics:capabilities.checkingProviders"
			: runtimeAvailable
				? t("graphics:capabilities.runtimeProviderReady", {
						provider: availableProvider?.providerName ?? t("graphics:capabilities.runtimeProvider"),
						suffix:
							availableProvider?.status === "no-capture"
								? t("graphics:capabilities.noCaptureSuffix")
								: "",
					})
				: "graphics:capabilities.runtimeUnavailable",
	}

	return (
		<div className="space-y-4" data-testid="graphics-runtime-investigation">
			<CapabilityCard capability={runtimeCapability} />
			{!loading && !runtimeAvailable && (
				<div className="rounded-lg border border-dashed border-vscode-panel-border p-5">
					<Cpu className="mb-3 size-5 text-vscode-descriptionForeground" aria-hidden="true" />
					<h3 className="text-sm font-semibold text-vscode-foreground">
						{t("graphics:capabilities.runtimeOptional")}
					</h3>
					<p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">
						{t("graphics:capabilities.runtimeOptionalDescription")}
					</p>
				</div>
			)}
		</div>
	)
}

export const GraphicsWorkspace = ({ onDone }: GraphicsWorkspaceProps) => {
	const { t } = useAppTranslation()
	const [section, setSection] = useState<GraphicsWorkspaceSection>("feature")
	const sectionIcon = useMemo(() => ({ feature: FileCode2, assets: Box, runtime: Puzzle })[section], [section])
	const SectionIcon = sectionIcon

	return (
		<Tab data-testid="graphics-workspace">
			<TabHeader className="space-y-3 bg-vscode-sideBar-background">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<SectionIcon className="size-5" />
						<div>
							<h1 className="text-base font-semibold text-vscode-foreground">
								{t("graphics:workspace.title")}
							</h1>
							<p className="text-xs text-vscode-descriptionForeground">
								{t("graphics:workspace.subtitle")}
							</p>
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={onDone}
						aria-label={t("graphics:workspace.backToChat")}
						type="button">
						<ArrowLeft aria-hidden="true" />
						{t("graphics:workspace.backToChat")}
					</Button>
				</div>
				<TabList
					value={section}
					onValueChange={(value) => setSection(value as GraphicsWorkspaceSection)}
					className="gap-1">
					<TabTrigger
						id="tab-feature"
						value="feature"
						className="rounded-md px-3 py-1.5 text-xs"
						style={
							section === "feature"
								? { background: "var(--vscode-list-activeSelectionBackground)" }
								: undefined
						}>
						{t("graphics:workspace.tabs.feature")}
					</TabTrigger>
					<TabTrigger
						id="tab-assets"
						value="assets"
						className="rounded-md px-3 py-1.5 text-xs"
						style={
							section === "assets"
								? { background: "var(--vscode-list-activeSelectionBackground)" }
								: undefined
						}>
						{t("graphics:workspace.tabs.assets")}
					</TabTrigger>
					<TabTrigger
						id="tab-runtime"
						value="runtime"
						className="rounded-md px-3 py-1.5 text-xs"
						style={
							section === "runtime"
								? { background: "var(--vscode-list-activeSelectionBackground)" }
								: undefined
						}>
						{t("graphics:workspace.tabs.runtime")}
					</TabTrigger>
				</TabList>
			</TabHeader>
			<TabContent>
				<div
					id="tab-feature-panel"
					role="tabpanel"
					tabIndex={0}
					aria-labelledby="tab-feature"
					hidden={section !== "feature"}>
					{section === "feature" && <FeatureHome />}
				</div>
				<div
					id="tab-assets-panel"
					role="tabpanel"
					tabIndex={0}
					aria-labelledby="tab-assets"
					hidden={section !== "assets"}>
					{section === "assets" && <AssetValidation />}
				</div>
				<div
					id="tab-runtime-panel"
					role="tabpanel"
					tabIndex={0}
					aria-labelledby="tab-runtime"
					hidden={section !== "runtime"}>
					{section === "runtime" && <RuntimeInvestigation />}
				</div>
				{false && section === "feature" && <FeatureHome />}
			</TabContent>
		</Tab>
	)
}

export default GraphicsWorkspace
