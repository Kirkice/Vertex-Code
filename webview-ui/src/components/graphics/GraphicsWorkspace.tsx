import React, { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Box, Check, Cpu, FileCode2, Puzzle, Sparkles } from "lucide-react"

import type {
	EventDetailsResult,
	FrameSummaryResult,
	GraphicsAssetArtifactPayload,
	GraphicsAssetInventoryPayload,
	GraphicsAssetProviderStatusPayload,
	GraphicsCaptureOperationPayload,
	GraphicsCaptureStatusPayload,
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
	GraphicsFeaturePlanMergeConflict,
	GraphicsFeatureTaskOwner,
	GraphicsFeatureTaskStatus,
	GraphicsProjectProfile,
	GraphicsProviderStatusPayload,
	GraphicsLaunchProfile,
	GraphicsInvestigationSession,
	GraphicsValidationReport,
	PipelineStateResult,
	SelectionContextResult,
	ShaderInfoResult,
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
	const [loading, setLoading] = useState(true)
	const [status, setStatus] = useState<GraphicsAssetProviderStatusPayload | null>(null)
	const [path, setPath] = useState("")
	const [artifact, setArtifact] = useState<GraphicsAssetArtifactPayload | null>(null)
	const [inventory, setInventory] = useState<GraphicsAssetInventoryPayload | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const message = event.data
			if (message?.type === "graphicsAssetProviderStatus") {
				setStatus(message.graphicsAssetProviderStatus ?? null)
				setLoading(false)
			}
			if (message?.type === "graphicsAssetArtifactLoaded") {
				const result = message.graphicsAssetArtifactLoaded
				if (result?.success && result.data) {
					setArtifact(result.data)
					setError(null)
					vscode.postMessage({ type: "requestGraphicsAssetInventory", graphicsAssetArtifactId: result.data.artifactId })
				} else setError(result?.error ?? t("graphics:capabilities.assetLoadFailed"))
			}
			if (message?.type === "graphicsAssetInventory") {
				const result = message.graphicsAssetInventory
				if (result?.success && result.data) setInventory(result.data)
				else setError(result?.error ?? t("graphics:capabilities.assetInventoryFailed"))
			}
		}
		window.addEventListener("message", onMessage)
		vscode.postMessage({ type: "requestGraphicsAssetProviderStatus" })
		return () => window.removeEventListener("message", onMessage)
	}, [t])

	const availability = loading ? "unknown" : status?.availability ?? "unavailable"
	const providerCapability: GraphicsWorkspaceCapability = {
		id: "asset-validation",
		label: "graphics:capabilities.assetValidation",
		description: "graphics:capabilities.assetValidationDescription",
		availability,
		providerId: status?.providerId,
		providerName: status?.providerName,
		reason: loading
			? "graphics:capabilities.checkingAssetStudio"
			: status?.message ?? "graphics:capabilities.assetValidationReason",
	}

	return (
		<div className="space-y-4" data-testid="graphics-asset-validation">
			<CapabilityCard capability={providerCapability} />
			<div className="rounded-lg border border-vscode-panel-border bg-vscode-editor-background p-4">
				<div className="flex flex-col gap-2 md:flex-row md:items-end">
					<label className="flex-1 text-xs text-vscode-descriptionForeground">
						{t("graphics:capabilities.assetPath")}
						<Input value={path} onChange={(event) => setPath(event.target.value)} placeholder="Build/game.bundle" />
					</label>
					<Button
						type="button"
						disabled={!path.trim() || availability === "unavailable"}
						onClick={() => vscode.postMessage({ type: "loadGraphicsAssetArtifact", graphicsAssetPath: path.trim(), graphicsAssetKind: "unknown" })}>
						{t("graphics:capabilities.loadAsset")}
					</Button>
				</div>
				{status?.diagnostics.length ? <p className="mt-3 text-xs text-vscode-editorWarning-foreground">{status.diagnostics.join(" ")}</p> : null}
				{error ? <p className="mt-3 text-xs text-vscode-editorError-foreground">{error}</p> : null}
			</div>
			{artifact && (
				<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
					<div className="font-semibold text-vscode-foreground">{artifact.path}</div>
					<div className="mt-1 text-vscode-descriptionForeground">{t("graphics:capabilities.assetCount")}: {inventory?.totals.assetCount ?? "—"}</div>
					<div className="text-vscode-descriptionForeground">{t("graphics:capabilities.assetMemory")}: {inventory?.totals.memoryBytes ?? "—"}</div>
					{inventory && <div className="mt-2 text-vscode-descriptionForeground">{Object.entries(inventory.totals.byKind).map(([kind, count]) => `${kind}: ${count}`).join(" · ")}</div>}
				</div>
			)}
			{!artifact && !loading && <div className="rounded-lg border border-dashed border-vscode-panel-border p-5 text-sm text-vscode-descriptionForeground"><Box className="mb-3 size-5" aria-hidden="true" />{t("graphics:capabilities.assetRoadmap")}</div>}
		</div>
	)
}

const RuntimeInvestigation = () => {
	const { t } = useAppTranslation()
	const [loading, setLoading] = useState(true)
	const [status, setStatus] = useState<GraphicsProviderStatusPayload | null>(null)
	const [captureStatus, setCaptureStatus] = useState<GraphicsCaptureStatusPayload | null>(null)
	const [frameSummary, setFrameSummary] = useState<GraphicsCaptureOperationPayload<FrameSummaryResult> | null>(null)
	const [selection, setSelection] = useState<GraphicsCaptureOperationPayload<SelectionContextResult> | null>(null)
	const [eventDetails, setEventDetails] = useState<GraphicsCaptureOperationPayload<EventDetailsResult> | null>(null)
	const [pipelineState, setPipelineState] = useState<GraphicsCaptureOperationPayload<PipelineStateResult> | null>(null)
	const [shaderInfo, setShaderInfo] = useState<GraphicsCaptureOperationPayload<ShaderInfoResult> | null>(null)
	const [eventId, setEventId] = useState("")
	const [shaderStage, setShaderStage] = useState("pixel")
	const [resourceId, setResourceId] = useState("")
	const [compareEventIdA, setCompareEventIdA] = useState("")
	const [compareEventIdB, setCompareEventIdB] = useState("")
	const [selectedProviderId, setSelectedProviderId] = useState("")
	const [mappingKind, setMappingKind] = useState<"shader" | "pass" | "draw" | "resource">("shader")
	const [mappingIdentifier, setMappingIdentifier] = useState("")
	const [diagnosticLoading, setDiagnosticLoading] = useState(false)
	const [diagnosticResult, setDiagnosticResult] = useState<any>(null)
	const [profiles, setProfiles] = useState<GraphicsLaunchProfile[]>([])
	const [selectedProfileId, setSelectedProfileId] = useState("")
	const [session, setSession] = useState<GraphicsInvestigationSession | null>(null)
	const [validationReport, setValidationReport] = useState<GraphicsValidationReport | null>(null)
	const [operationId, setOperationId] = useState("")
	const [operationStage, setOperationStage] = useState("")

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const message = event.data
			switch (message?.type) {
				case "graphicsProviderStatus":
					setStatus(message.values as GraphicsProviderStatusPayload)
					setLoading(false)
					break
				case "graphicsCaptureStatus":
					setCaptureStatus(message.graphicsCaptureStatus as GraphicsCaptureStatusPayload)
					break
				case "graphicsFrameSummary":
					setFrameSummary(message.graphicsFrameSummary as GraphicsCaptureOperationPayload<FrameSummaryResult>)
					break
				case "graphicsSelectionContext":
					setSelection(message.graphicsSelectionContext as GraphicsCaptureOperationPayload<SelectionContextResult>)
					break
				case "graphicsEventDetails":
					setEventDetails(message.graphicsEventDetails as GraphicsCaptureOperationPayload<EventDetailsResult>)
					break
				case "graphicsPipelineState":
					setPipelineState(message.graphicsPipelineState as GraphicsCaptureOperationPayload<PipelineStateResult>)
					break
				case "graphicsShaderInfo":
					setShaderInfo(message.graphicsShaderInfo as GraphicsCaptureOperationPayload<ShaderInfoResult>)
					break
				case "graphicsWorkflowStarted":
					setDiagnosticLoading(true)
					break
				case "graphicsLaunchProfiles":
					setProfiles(message.graphicsLaunchProfiles ?? [])
					break
				case "graphicsInvestigationSession":
					setSession(message.graphicsInvestigationSession ?? null)
					break
				case "graphicsOperationProgress":
					setOperationStage(message.values?.stage ?? "")
					break
				case "graphicsResult":
					setDiagnosticLoading(false)
					setDiagnosticResult(message.values ?? message.graphicsResult ?? null)
					if (message.values?.result?.rawData?.report) setValidationReport(message.values.result.rawData.report as GraphicsValidationReport)
					break
				case "graphicsValidationReport":
					setValidationReport(message.graphicsValidationReport ?? null)
					break
				case "graphicsProviderSelected":
					setSelectedProviderId(message.values?.providerId ?? "")
					vscode.postMessage({ type: "requestGraphicsProviderStatus" })
					vscode.postMessage({ type: "requestGraphicsCaptureStatus" })
					break
			}
		}

		window.addEventListener("message", onMessage)
		vscode.postMessage({ type: "requestGraphicsProviderStatus" })
		vscode.postMessage({ type: "requestGraphicsCaptureStatus" })
		vscode.postMessage({ type: "requestGraphicsLaunchProfiles" })
		return () => window.removeEventListener("message", onMessage)
	}, [])

	const selectedProviderIdFromStatus = status?.selectedProviderId ?? ""
	const selectedProvider = status?.providers.find((provider) => provider.providerId === (selectedProviderId || selectedProviderIdFromStatus))
	const availableProvider = selectedProvider ?? status?.providers.find((provider) => provider.status === "available" || provider.status === "no-capture")
	const runtimeAvailable = availableProvider?.status === "available" || availableProvider?.status === "no-capture"
	const frame = frameSummary?.data
	const selectedEvent = selection?.data
	const inspectedEvent = eventDetails?.data
	const request = (type: "requestGraphicsFrameSummary" | "requestGraphicsSelectionContext") => vscode.postMessage({ type })

	const runtimeCapability: GraphicsWorkspaceCapability = {
		id: "runtime-capture",
		label: "graphics:capabilities.runtimeGpu",
		description: "graphics:capabilities.runtimeGpuDescription",
		availability: loading ? "unknown" : runtimeAvailable ? "available" : "unavailable",
		providerId: availableProvider?.providerId,
		providerName: availableProvider?.providerName,
		reason: loading ? "graphics:capabilities.checkingProviders" : captureStatus?.message ?? "graphics:capabilities.runtimeUnavailable",
	}

	const runDiagnostic = (intent: string, extra: Record<string, unknown> = {}) => {
		setDiagnosticLoading(true)
		vscode.postMessage({
			type: "runGraphicsWorkflow",
			graphicsIntent: intent,
			graphicsEventId: eventId || undefined,
			graphicsShaderStage: shaderStage || undefined,
			graphicsResourceId: resourceId || undefined,
			graphicsEventIdA: compareEventIdA || undefined,
			graphicsEventIdB: compareEventIdB || undefined,
			graphicsMappingKind: mappingKind,
			graphicsMappingIdentifier: mappingIdentifier || undefined,
			...extra,
		})
	}

	return (
		<div className="space-y-4" data-testid="graphics-runtime-investigation">
			<CapabilityCard capability={runtimeCapability} />
			{runtimeAvailable && (
				<>
					<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
						<div className="font-semibold text-vscode-foreground">Launch and capture</div>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<select aria-label="Launch profile" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} className="min-w-48 rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1 text-vscode-input-foreground">
								<option value="">Select profile</option>
								{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
							</select>
							<Button type="button" size="sm" disabled={!selectedProfileId || diagnosticLoading} onClick={() => { const id = crypto.randomUUID(); setOperationId(id); setDiagnosticLoading(true); vscode.postMessage({ type: "runGraphicsLaunchAndCapture", graphicsProfileId: selectedProfileId, graphicsOperationId: id, graphicsSessionId: session?.id }) }}>{diagnosticLoading ? `Running${operationStage ? ` · ${operationStage}` : ""}` : "Launch and capture"}</Button>
							<Button type="button" size="sm" variant="secondary" disabled={!operationId} onClick={() => vscode.postMessage({ type: "cancelGraphicsOperation", graphicsOperationId: operationId })}>Cancel</Button>
							<Button type="button" size="sm" variant="secondary" onClick={() => vscode.postMessage({ type: "invalidateGraphicsCache" })}>Refresh cache</Button>
						</div>
						{session && <div className="mt-2 text-vscode-descriptionForeground">Session {session.id} · {session.status} · revision {session.revision}</div>}
					</div>
					<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
						<div className="font-semibold text-vscode-foreground">Re-capture validation</div>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<Button type="button" size="sm" disabled={!selectedProfileId || !session?.baselineCapture || diagnosticLoading} onClick={() => { const id = crypto.randomUUID(); setOperationId(id); setDiagnosticLoading(true); vscode.postMessage({ type: "runGraphicsRecaptureValidation", graphicsProfileId: selectedProfileId, graphicsOperationId: id, graphicsSessionId: session?.id, graphicsCaptureArtifact: session?.baselineCapture }) }}>Validate candidate capture</Button>
							{validationReport && <span className="text-vscode-descriptionForeground">{validationReport.status} · confidence {validationReport.confidence} · {validationReport.summary}</span>}
						</div>
						{validationReport?.metrics.map((metric) => <div key={metric.name} className="mt-1 text-vscode-descriptionForeground">{metric.name}: {metric.before ?? "—"} → {metric.after ?? "—"}{metric.improved === undefined ? "" : metric.improved ? " · improved" : " · not improved"}</div>)}
					</div>
					<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
						<div className="font-semibold text-vscode-foreground">{t("graphics:capabilities.provider")}</div>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<select
								aria-label={t("graphics:capabilities.selectProvider")}
								value={selectedProviderId || selectedProviderIdFromStatus}
								onChange={(event) => {
									const providerId = event.target.value
									setSelectedProviderId(providerId)
									vscode.postMessage({ type: "selectGraphicsProvider", graphicsProviderId: providerId })
								}}
								className="min-w-48 rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1 text-vscode-input-foreground">
								<option value="">{t("graphics:capabilities.selectProvider")}</option>
								{status?.providers.map((provider) => (
									<option key={provider.providerId} value={provider.providerId}>
										{provider.providerName} · {provider.status}
									</option>
								))}
							</select>
							{selectedProvider?.message && <span className="text-vscode-descriptionForeground">{selectedProvider.message}</span>}
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
							<div className="font-semibold text-vscode-foreground">{t("graphics:capabilities.captureStatus")}</div>
							<div className="mt-2 text-vscode-descriptionForeground">{captureStatus?.status ?? "—"} · {captureStatus?.api ?? "API —"}</div>
							<div className="text-vscode-descriptionForeground">{captureStatus?.providerName ?? availableProvider?.providerName ?? "—"}</div>
							<div className="text-vscode-descriptionForeground">{captureStatus?.capturePath ?? t("graphics:capabilities.noCapture")}</div>
							<div className="text-vscode-descriptionForeground">{captureStatus?.gpu ?? "GPU —"} · {captureStatus?.width ?? "—"}×{captureStatus?.height ?? "—"} · frame {captureStatus?.frameNumber ?? "—"}</div>
						</div>
						<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
							<div className="font-semibold text-vscode-foreground">{t("graphics:capabilities.frameOverview")}</div>
							<div className="mt-2 text-vscode-descriptionForeground">{frame?.totalDurationMs ?? "—"} ms · {frame?.passes?.length ?? 0} passes · {frame?.hotEvents?.length ?? 0} hot events</div>
							{frame?.hotEvents?.slice(0, 3).map((hotEvent) => <div key={hotEvent.eventId} className="mt-1 text-vscode-descriptionForeground">#{hotEvent.eventId} {hotEvent.name ?? "Event"} · {hotEvent.durationMs ?? "—"} ms</div>)}
							{frameSummary?.error && <div className="mt-2 text-vscode-errorForeground">{frameSummary.error}</div>}
							<Button type="button" size="sm" className="mt-3" onClick={() => request("requestGraphicsFrameSummary")}>{t("graphics:capabilities.refreshFrame")}</Button>
						</div>
					</div>
					<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
						<div className="font-semibold text-vscode-foreground">{t("graphics:capabilities.selectedEvent")}</div>
						<div className="mt-2 flex flex-wrap gap-2">
							<Input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="Event ID" />
							<Button type="button" size="sm" disabled={!eventId} onClick={() => vscode.postMessage({ type: "requestGraphicsEventDetails", graphicsEventId: eventId })}>{t("graphics:capabilities.inspectEvent")}</Button>
							<Button type="button" size="sm" variant="secondary" onClick={() => request("requestGraphicsSelectionContext")}>{t("graphics:capabilities.refreshSelection")}</Button>
						</div>
						<div className="mt-2 text-vscode-descriptionForeground">{selectedEvent?.eventName ?? inspectedEvent?.name ?? "—"}</div>
						<div className="text-vscode-descriptionForeground">{inspectedEvent?.durationMs ?? "—"} ms · {inspectedEvent?.drawCallCount ?? "—"} draw calls · {inspectedEvent?.primitiveCount ?? "—"} primitives</div>
						{eventDetails?.error && <div className="mt-2 text-vscode-errorForeground">{eventDetails.error}</div>}
						<div className="mt-3 grid gap-3 md:grid-cols-2">
							<div className="rounded border border-vscode-panel-border p-3">
								<div className="font-semibold">{t("graphics:capabilities.pipeline")}</div>
								<Button type="button" size="sm" className="mt-2" disabled={!eventId} onClick={() => vscode.postMessage({ type: "requestGraphicsPipelineState", graphicsEventId: eventId })}>{t("graphics:capabilities.inspectPipeline")}</Button>
								<div className="mt-2 text-vscode-descriptionForeground">{t("graphics:capabilities.renderTargets")}: {pipelineState?.data?.renderTargets?.length ?? 0} · {t("graphics:capabilities.vertexBuffers")}: {pipelineState?.data?.vertexBuffers?.length ?? 0}</div>
								{pipelineState?.data?.renderTargets?.map((binding) => <div key={`rt-${binding.slot}`} className="mt-1 text-vscode-descriptionForeground">RT {binding.slot}: {binding.name ?? binding.format ?? binding.type ?? "—"}{binding.dimensions ? ` · ${binding.dimensions}` : ""}</div>)}
								{pipelineState?.data?.depthStencil && <div className="mt-1 text-vscode-descriptionForeground">{t("graphics:capabilities.depthStencil")}: {pipelineState.data.depthStencil.name ?? pipelineState.data.depthStencil.format ?? "—"}</div>}
								{pipelineState?.error && <div className="mt-1 text-vscode-errorForeground">{pipelineState.error}</div>}
							</div>
							<div className="rounded border border-vscode-panel-border p-3">
								<div className="font-semibold">{t("graphics:capabilities.shader")}</div>
								<div className="mt-2 flex gap-2"><Input value={shaderStage} onChange={(event) => setShaderStage(event.target.value)} placeholder={t("graphics:capabilities.shaderStage")} /><Button type="button" size="sm" disabled={!eventId} onClick={() => vscode.postMessage({ type: "requestGraphicsShaderInfo", graphicsEventId: eventId, graphicsShaderStage: shaderStage })}>{t("graphics:capabilities.inspectShader")}</Button></div>
								<div className="mt-2 text-vscode-descriptionForeground">{shaderInfo?.data?.stage ?? "—"} · {shaderInfo?.data?.entryPoint ?? "—"} · {shaderInfo?.data?.language ?? "—"} · {shaderInfo?.data?.instructionCount ?? "—"}</div>
								{shaderInfo?.data?.inputs?.length ? <div className="mt-1 text-vscode-descriptionForeground">Inputs: {shaderInfo.data.inputs.map((input) => input.name ?? input.type ?? "variable").join(", ")}</div> : null}
								{shaderInfo?.data?.outputs?.length ? <div className="mt-1 text-vscode-descriptionForeground">Outputs: {shaderInfo.data.outputs.map((output) => output.name ?? output.type ?? "variable").join(", ")}</div> : null}
								{shaderInfo?.data?.constantBuffers?.length ? <div className="mt-1 text-vscode-descriptionForeground">{t("graphics:capabilities.constantBuffers")}: {shaderInfo.data.constantBuffers.join(", ")}</div> : null}
								{shaderInfo?.error && <div className="mt-1 text-vscode-errorForeground">{shaderInfo.error}</div>}
							</div>
						</div>
					<div className="mt-3 rounded border border-vscode-panel-border p-3">
						<div className="font-semibold">{t("graphics:capabilities.resources")}</div>
						<div className="mt-2 grid gap-1 text-vscode-descriptionForeground md:grid-cols-2">
							<div>{t("graphics:capabilities.renderTargets")}: {pipelineState?.data?.renderTargets?.length ?? 0}</div>
							<div>{t("graphics:capabilities.vertexBuffers")}: {pipelineState?.data?.vertexBuffers?.length ?? 0}</div>
							<div>{t("graphics:capabilities.samplers")}: {pipelineState?.data?.samplers?.length ?? 0}</div>
							<div>{t("graphics:capabilities.constantBuffers")}: {pipelineState?.data?.constantBuffers?.length ?? 0}</div>
						</div>
						{pipelineState?.data?.vertexBuffers?.map((binding) => <div key={`vb-${binding.slot}`} className="mt-1 text-vscode-descriptionForeground">VB {binding.slot}: {binding.name ?? binding.type ?? "—"}{binding.format ? ` · ${binding.format}` : ""}</div>)}
					</div>
					<div className="mt-3 rounded border border-vscode-panel-border p-3">
						<div className="font-semibold">{t("graphics:capabilities.resource")}</div>
						<div className="mt-2 text-vscode-descriptionForeground">{pipelineState?.data?.depthStencil?.name ?? pipelineState?.data?.depthStencil?.format ?? t("graphics:capabilities.noResource")}</div>
					</div>
					</div>
					<div className="rounded-lg border border-vscode-panel-border p-4 text-xs">
						<div className="font-semibold text-vscode-foreground">{t("graphics:capabilities.diagnostics")}</div>
						<div className="mt-2 flex flex-wrap gap-2">
							<Input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder={t("graphics:capabilities.resourceId")} />
							<Input value={compareEventIdA} onChange={(event) => setCompareEventIdA(event.target.value)} placeholder={t("graphics:capabilities.eventIdA")} />
							<Input value={compareEventIdB} onChange={(event) => setCompareEventIdB(event.target.value)} placeholder={t("graphics:capabilities.eventIdB")} />
						</div>
						<div className="mt-2 flex flex-wrap gap-2">
							{(["frame_performance", "shader_analysis", "pipeline_analysis", "resource_trace"] as const).map((intent) => <Button key={intent} type="button" size="sm" disabled={diagnosticLoading || (intent !== "frame_performance" && !eventId)} onClick={() => runDiagnostic(intent)}>{t(`graphics:capabilities.${intent}`)}</Button>)}
							<Button type="button" size="sm" disabled={diagnosticLoading || !compareEventIdA || !compareEventIdB} onClick={() => runDiagnostic("regression_compare")}>{t("graphics:capabilities.captureCompare")}</Button>
						</div>
						<div className="mt-3 rounded border border-vscode-panel-border p-3">
							<div className="font-semibold">{t("graphics:capabilities.projectMapping")}</div>
							<div className="mt-2 flex flex-wrap gap-2">
								<select aria-label={t("graphics:capabilities.mappingKind")} value={mappingKind} onChange={(event) => setMappingKind(event.target.value as typeof mappingKind)} className="rounded border border-vscode-input-border bg-vscode-input-background px-2 py-1 text-vscode-input-foreground">
									<option value="shader">{t("graphics:capabilities.shader")}</option>
									<option value="pass">Pass</option>
									<option value="draw">Draw</option>
									<option value="resource">{t("graphics:capabilities.resource")}</option>
								</select>
								<Input value={mappingIdentifier} onChange={(event) => setMappingIdentifier(event.target.value)} placeholder={t("graphics:capabilities.mappingIdentifier")} />
								<Button type="button" size="sm" disabled={diagnosticLoading || !mappingIdentifier} onClick={() => runDiagnostic("project_mapping")}>{t("graphics:capabilities.findOwner")}</Button>
							</div>
						</div>
						{diagnosticLoading && <div className="mt-2 text-vscode-descriptionForeground">{t("graphics:capabilities.workflowRunning")}</div>}
						{diagnosticResult?.result && <div className="mt-2 space-y-2"><div className="text-vscode-foreground">{diagnosticResult.result.summary}</div>{diagnosticResult.result.evidence?.map((item: any, index: number) => <div key={index} className="text-vscode-descriptionForeground">{item.source ? `${item.source}: ` : ""}{item.description}</div>)}{diagnosticResult.result.rawData?.shaderSource?.success && <div className="rounded border border-vscode-panel-border p-2 text-vscode-descriptionForeground"><div className="font-semibold">Shader identity</div><div>{diagnosticResult.result.rawData.shader?.shaderId ?? diagnosticResult.result.rawData.shaderSource.shaderId ?? "—"} · {diagnosticResult.result.rawData.shader?.debugName ?? diagnosticResult.result.rawData.shaderSource.debugName ?? "—"}</div>{diagnosticResult.result.rawData.shaderSource.filePath && <div>{diagnosticResult.result.rawData.shaderSource.filePath}</div>}</div>}{diagnosticResult.result.rawData?.resourceHistory?.success && <div className="rounded border border-vscode-panel-border p-2 text-vscode-descriptionForeground"><div className="font-semibold">Resource lifecycle</div><div>{diagnosticResult.result.rawData.resourceHistory.history?.length ?? 0} event(s)</div>{diagnosticResult.result.rawData.resourceHistory.history?.slice(0, 5).map((entry: any, index: number) => <div key={index}>{entry.eventId}: {entry.action}{entry.description ? ` · ${entry.description}` : ""}</div>)}</div>}{diagnosticResult.result.rawData?.pipelineDiff?.success && <div className="rounded border border-vscode-panel-border p-2 text-vscode-descriptionForeground"><div className="font-semibold">Pipeline diff</div><div>{diagnosticResult.result.rawData.pipelineDiff.differences?.length ?? 0} changed field(s)</div>{diagnosticResult.result.rawData.pipelineDiff.differences?.slice(0, 5).map((difference: any, index: number) => <div key={index}>{difference.path}: {String(difference.before ?? "—")} → {String(difference.after ?? "—")}</div>)}</div>}{diagnosticResult.result.projectMapping?.map((candidate: any, index: number) => <div key={`${candidate.filePath}-${index}`} className="text-vscode-descriptionForeground">{candidate.filePath}{candidate.line ? `:${candidate.line}` : ""}{candidate.functionName ? ` · ${candidate.functionName}` : ""} · {candidate.confidence}</div>)}{diagnosticResult.result.error && <div className="text-vscode-errorForeground">{diagnosticResult.result.error}</div>}</div>}
					</div>
				</>
			)}
			{!loading && !runtimeAvailable && <div className="rounded-lg border border-dashed border-vscode-panel-border p-5"><Cpu className="mb-3 size-5 text-vscode-descriptionForeground" aria-hidden="true" /><h3 className="text-sm font-semibold text-vscode-foreground">{t("graphics:capabilities.runtimeOptional")}</h3><p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">{t("graphics:capabilities.runtimeOptionalDescription")}</p></div>}
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
