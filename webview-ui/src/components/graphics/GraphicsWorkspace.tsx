import React, { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Box, Check, Cpu, FileCode2, Puzzle, Sparkles } from "lucide-react"

import type {
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
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
		label: "Feature planning",
		description: "Structure requirements, compare implementation levels, and define acceptance criteria.",
		availability: "available",
	},
	{
		id: "source-analysis",
		label: "Project source analysis",
		description: "Inspect rendering code, shaders, client integration, and asset contracts without a capture tool.",
		availability: "available",
	},
]

const statusTone: Record<GraphicsWorkspaceCapability["availability"], string> = {
	available: "text-vscode-testing-iconPassed",
	unavailable: "text-vscode-descriptionForeground",
	degraded: "text-vscode-editorWarning-foreground",
	unknown: "text-vscode-descriptionForeground",
}

const CapabilityCard = ({ capability }: { capability: GraphicsWorkspaceCapability }) => (
	<div className="rounded-lg border border-vscode-panel-border bg-vscode-editor-background p-4">
		<div className="flex items-start justify-between gap-3">
			<div>
				<h3 className="text-sm font-semibold text-vscode-foreground">{capability.label}</h3>
				<p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">
					{capability.description}
				</p>
			</div>
			<span className={`text-xs capitalize ${statusTone[capability.availability]}`}>
				{capability.availability}
			</span>
		</div>
		{capability.reason && <p className="mt-3 text-xs text-vscode-descriptionForeground">{capability.reason}</p>}
	</div>
)

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
	{ key: "title", label: "Feature title", placeholder: "Stylized character outline", singleLine: true },
	{ key: "visualGoal", label: "Visual goal", placeholder: "Describe the desired result and references." },
	{
		key: "lifecycle",
		label: "Lifecycle and client integration",
		placeholder: "When it appears, changes, and is removed.",
	},
	{
		key: "artControls",
		label: "Art controls and assets",
		placeholder: "Required controls, source assets, and authoring rules.",
	},
	{ key: "targetPlatforms", label: "Target platforms", placeholder: "PC, console, mobile, XR, graphics APIs…" },
	{
		key: "performanceBudget",
		label: "Performance budget",
		placeholder: "Frame time, memory, bandwidth, or quality-tier limits.",
	},
	{
		key: "compatibilityRequirements",
		label: "Compatibility requirements",
		placeholder: "Render pipelines, engine versions, hardware tiers, and fallbacks.",
	},
	{
		key: "acceptanceCriteria",
		label: "Acceptance criteria",
		placeholder: "Observable conditions that define completion.",
	},
]

const FeatureHome = () => {
	const [initialLocalBrief] = useState<GraphicsFeatureBrief>(loadFeatureBrief)
	const [featureBrief, setFeatureBrief] = useState<GraphicsFeatureBrief>(initialLocalBrief)
	const [projectProfile, setProjectProfile] = useState<GraphicsProjectProfile | null>(null)
	const [profileLoading, setProfileLoading] = useState(true)
	const [solutionRecommendation, setSolutionRecommendation] = useState<GraphicsSolutionRecommendation | null>(null)
	const [solutionLoading, setSolutionLoading] = useState(false)
	const [featurePlan, setFeaturePlan] = useState<GraphicsFeaturePlan | null>(null)
	const [planLoading, setPlanLoading] = useState(false)
	const [saved, setSaved] = useState(false)

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
				event.data?.type === "graphicsFeaturePlanEdited"
			) {
				setFeaturePlan(event.data.graphicsFeaturePlan as GraphicsFeaturePlan)
				setPlanLoading(false)
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

	const updateTask = (taskId: string, title: string, completionConditions: string[]) => {
		if (!featurePlan) return
		vscode.postMessage({
			type: "updateGraphicsFeatureTask",
			graphicsFeatureTaskId: taskId,
			graphicsFeatureTaskTitle: title,
			graphicsFeatureTaskCompletionConditions: completionConditions,
			graphicsFeaturePlanRevision: featurePlan.revision,
		})
	}

	const requestFeaturePlan = () => {
		setPlanLoading(true)
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
	}

	return (
		<div className="space-y-5" data-testid="graphics-feature-home">
			<section className="rounded-xl border border-vscode-focusBorder/40 bg-vscode-editor-background p-5">
				<div className="flex items-start gap-3">
					<Sparkles className="mt-0.5 size-5 text-vscode-focusBorder" />
					<div>
						<h2 className="text-base font-semibold text-vscode-foreground">
							Start from the graphics feature
						</h2>
						<p className="mt-1 text-sm leading-relaxed text-vscode-descriptionForeground">
							Turn an art or design request into a project-aware rendering plan before choosing an
							implementation level. The draft is saved for this workspace, with a local fallback.
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
				aria-label="Graphics Feature Brief">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-semibold text-vscode-foreground">Graphics Feature Brief</h3>
						<p className="mt-1 text-xs text-vscode-descriptionForeground">
							Record requirements before selecting tools or changing rendering code.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={requestSolutionRecommendation}
							disabled={solutionLoading || !featureBrief.title.trim()}
							aria-label="Generate solution recommendation">
							Compare solutions
						</Button>
						<Button size="sm" onClick={saveFeatureBrief} aria-label="Save feature brief">
							{saved && <Check className="size-4" />}
							{saved ? "Saved" : "Save draft"}
						</Button>
					</div>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					{briefFields.map((field) => (
						<label key={field.key} className={field.key === "title" ? "md:col-span-2" : "space-y-1.5"}>
							<span className="text-xs font-medium text-vscode-foreground">{field.label}</span>
							{field.singleLine ? (
								<Input
									value={featureBrief[field.key]}
									onChange={(event) => updateField(field.key, event.target.value)}
									placeholder={field.placeholder}
								/>
							) : (
								<Textarea
									value={featureBrief[field.key]}
									onChange={(event) => updateField(field.key, event.target.value)}
									placeholder={field.placeholder}
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
					aria-label="Generate cross-module feature plan">
					Create implementation plan
				</Button>
			</div>
			<GraphicsFeaturePlanView
				plan={featurePlan}
				loading={planLoading}
				onTaskStatusChange={updateTaskStatus}
				onTaskEdit={updateTask}
			/>

			<div className="grid gap-3 md:grid-cols-2">
				{coreCapabilities.map((capability) => (
					<CapabilityCard key={capability.id} capability={capability} />
				))}
			</div>
		</div>
	)
}

const AssetValidation = () => (
	<div className="space-y-4" data-testid="graphics-asset-validation">
		<CapabilityCard
			capability={{
				id: "asset-validation",
				label: "Build artifact validation",
				description:
					"Inspect Unity bundles or APK assets through an AssetStudio capability when it is installed.",
				availability: "unavailable",
				reason: "AssetStudio is optional. Source-level asset contracts and feature planning remain available.",
			}}
		/>
		<div className="rounded-lg border border-dashed border-vscode-panel-border p-5 text-sm text-vscode-descriptionForeground">
			<Box className="mb-3 size-5" />
			AssetStudio integration will progressively add texture, mesh, material, renderer, memory, and dependency
			audits.
		</div>
	</div>
)

const RuntimeInvestigation = () => {
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
		label: "Runtime GPU investigation",
		description:
			"Inspect captures, events, pipeline state, shaders, and resources through an optional runtime provider.",
		availability: loading ? "unknown" : runtimeAvailable ? "available" : "unavailable",
		providerId: availableProvider?.providerId,
		providerName: availableProvider?.providerName,
		reason: loading
			? "Checking optional runtime providers…"
			: runtimeAvailable
				? `${availableProvider?.providerName ?? "Runtime provider"} is ready${availableProvider?.status === "no-capture" ? ", but no capture is open" : ""}.`
				: "RenderDoc for VS Code is not required for Graphics Workspace. Install a runtime provider only when capture-level GPU evidence is needed.",
	}

	return (
		<div className="space-y-4" data-testid="graphics-runtime-investigation">
			<CapabilityCard capability={runtimeCapability} />
			{!loading && !runtimeAvailable && (
				<div className="rounded-lg border border-dashed border-vscode-panel-border p-5">
					<Cpu className="mb-3 size-5 text-vscode-descriptionForeground" />
					<h3 className="text-sm font-semibold text-vscode-foreground">Runtime tools are optional</h3>
					<p className="mt-1 text-xs leading-relaxed text-vscode-descriptionForeground">
						Feature planning, source analysis, shader authoring, pipeline design, and asset contracts
						continue to work. Capture actions appear only after a compatible provider is available.
					</p>
				</div>
			)}
		</div>
	)
}

export const GraphicsWorkspace = ({ onDone }: GraphicsWorkspaceProps) => {
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
							<h1 className="text-base font-semibold text-vscode-foreground">Graphics Workspace</h1>
							<p className="text-xs text-vscode-descriptionForeground">
								Provider-independent feature engineering
							</p>
						</div>
					</div>
					<Button variant="ghost" size="sm" onClick={onDone} aria-label="Back to chat">
						<ArrowLeft />
						Chat
					</Button>
				</div>
				<TabList
					value={section}
					onValueChange={(value) => setSection(value as GraphicsWorkspaceSection)}
					className="gap-1">
					<TabTrigger
						value="feature"
						className="rounded-md px-3 py-1.5 text-xs"
						style={
							section === "feature"
								? { background: "var(--vscode-list-activeSelectionBackground)" }
								: undefined
						}>
						Feature Plan
					</TabTrigger>
					<TabTrigger
						value="assets"
						className="rounded-md px-3 py-1.5 text-xs"
						style={
							section === "assets"
								? { background: "var(--vscode-list-activeSelectionBackground)" }
								: undefined
						}>
						Asset / Build
					</TabTrigger>
					<TabTrigger
						value="runtime"
						className="rounded-md px-3 py-1.5 text-xs"
						style={
							section === "runtime"
								? { background: "var(--vscode-list-activeSelectionBackground)" }
								: undefined
						}>
						Runtime
					</TabTrigger>
				</TabList>
			</TabHeader>
			<TabContent>
				{section === "feature" && <FeatureHome />}
				{section === "assets" && <AssetValidation />}
				{section === "runtime" && <RuntimeInvestigation />}
			</TabContent>
		</Tab>
	)
}

export default GraphicsWorkspace
