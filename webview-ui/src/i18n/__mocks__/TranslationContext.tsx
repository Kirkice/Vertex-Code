import React, { createContext, useContext, ReactNode } from "react"

// Mock translation function that returns deterministic English for component tests.
const mockTranslate = (key: string, options?: Record<string, any>): string => {
	const graphicsTranslations: Record<string, string> = {
		"graphics:workspace.title": "Graphics Workspace",
		"graphics:workspace.subtitle": "Provider-independent feature engineering",
		"graphics:workspace.backToChat": "Back to chat",
		"graphics:workspace.tabs.feature": "Feature Plan",
		"graphics:workspace.tabs.assets": "Asset / Build",
		"graphics:workspace.tabs.runtime": "Runtime",
		"graphics:workspace.announcements.saved": "Feature brief saved.",
		"graphics:workspace.announcements.conflict": "The shared feature plan has changed. Review the conflict options.",
		"graphics:workspace.announcements.reloading": "Reloading the shared feature plan.",
		"graphics:workspace.announcements.reloaded": "Shared feature plan reloaded.",
		"graphics:workspace.announcements.localDraft": "Continuing with the local draft.",
		"graphics:workspace.announcements.loading": "Generating the cross-module feature plan.",
		"graphics:featureHome.title": "Start from the graphics feature",
		"graphics:featureHome.description":
			"Turn an art or design request into a project-aware rendering plan before choosing an implementation level. The draft is saved for this workspace, with a local fallback.",
		"graphics:brief.title": "Graphics Feature Brief",
		"graphics:brief.description": "Record requirements before selecting tools or changing rendering code.",
		"graphics:brief.fields.title.label": "Feature title",
		"graphics:brief.fields.title.placeholder": "Stylized character outline",
		"graphics:brief.fields.visualGoal.label": "Visual goal",
		"graphics:brief.fields.visualGoal.placeholder": "Describe the desired result and references.",
		"graphics:brief.fields.lifecycle.label": "Lifecycle and client integration",
		"graphics:brief.fields.lifecycle.placeholder": "When it appears, changes, and is removed.",
		"graphics:brief.fields.artControls.label": "Art controls and assets",
		"graphics:brief.fields.artControls.placeholder": "Required controls, source assets, and authoring rules.",
		"graphics:brief.fields.targetPlatforms.label": "Target platforms",
		"graphics:brief.fields.targetPlatforms.placeholder": "PC, console, mobile, XR, graphics APIs…",
		"graphics:brief.fields.performanceBudget.label": "Performance budget",
		"graphics:brief.fields.performanceBudget.placeholder": "Frame time, memory, bandwidth, or quality-tier limits.",
		"graphics:brief.fields.compatibilityRequirements.label": "Compatibility requirements",
		"graphics:brief.fields.compatibilityRequirements.placeholder": "Render pipelines, engine versions, hardware tiers, and fallbacks.",
		"graphics:brief.fields.acceptanceCriteria.label": "Acceptance criteria",
		"graphics:brief.fields.acceptanceCriteria.placeholder": "Observable conditions that define completion.",
		"graphics:brief.compareSolutions": "Compare solutions",
		"graphics:brief.compareSolutionsAria": "Generate solution recommendation",
		"graphics:brief.saveDraft": "Save draft",
		"graphics:brief.saved": "Saved",
		"graphics:brief.saveAria": "Save feature brief",
		"graphics:brief.createPlan": "Create implementation plan",
		"graphics:brief.createPlanAria": "Generate cross-module feature plan",
		"graphics:recommendation.ariaLabel": "Solution recommendation",
		"graphics:recommendation.title": "Implementation recommendation",
		"graphics:recommendation.description":
			"Compare implementation levels using the current brief and source-backed project architecture.",
		"graphics:recommendation.loading": "Evaluating implementation levels…",
		"graphics:recommendation.empty":
			"Save or edit the Feature Brief, then generate a recommendation before implementation.",
		"graphics:profile.title": "Graphics Project Profile",
		"graphics:profile.description": "Source-derived engine, pipeline, shader, platform, and architecture signals.",
		"graphics:profile.refresh": "Refresh",
		"graphics:profile.refreshAria": "Refresh project profile",
		"graphics:profile.loading": "Inspecting project graphics architecture…",
		"graphics:profile.notDetected": "Not detected",
		"graphics:profile.engine": "Engine:",
		"graphics:profile.pipeline": "Pipeline:",
		"graphics:profile.shaders": "Shaders:",
		"graphics:profile.platformsApis": "Platforms / APIs:",
		"graphics:profile.architectureFindings": "Architecture findings",
		"graphics:profile.deepFindings": "Deep architecture findings",
		"graphics:profile.findingCount": "{{count}} findings from {{files}} files",
		"graphics:recommendation.recommended": "Recommended: {{label}}",
		"graphics:recommendation.score": "Score {{score}} · {{confidence}}",
		"graphics:recommendation.notSelected": "Not selected: {{reason}}",
		"graphics:plan.ariaLabel": "Graphics Feature Plan",
		"graphics:plan.title": "Cross-module implementation plan",
		"graphics:plan.description":
			"Dependency-ordered work across rendering, shaders, client lifecycle, assets, and validation.",
		"graphics:plan.loading": "Generating cross-module feature plan…",
		"graphics:plan.titleField": "Feature plan title",
		"graphics:plan.taskTitle": "{{taskId}} title",
		"graphics:plan.summaryField": "Feature plan summary",
		"graphics:plan.pipeline": "Pipeline",
		"graphics:plan.shader": "Shader",
		"graphics:plan.clientLifecycle": "Client lifecycle",
		"graphics:plan.designSummary": "{{title}} summary",
		"graphics:plan.designDetails": "{{title}} details",
		"graphics:plan.decisionRationale": "Decision rationale",
		"graphics:plan.decisionAlternatives": "Decision alternatives",
		"graphics:plan.compatibilityTargets": "Compatibility targets",
		"graphics:plan.performanceBudget": "Performance budget",
		"graphics:plan.performanceDetails": "Performance budget details",
		"graphics:plan.performanceSummary": "Performance budget summary",
		"graphics:plan.assetContract": "Asset contract",
		"graphics:plan.technicalDecision": "Technical decision",
		"graphics:plan.alternativeFormat": "One alternative per line: level | reason not selected",
		"graphics:plan.planningContext": "Planning context and validation",
		"graphics:plan.risksFormat": "Risks: id | title | impact | mitigation | review gate",
		"graphics:plan.acceptanceFormat": "Acceptance: id | dimension | criterion | evidence",
		"graphics:plan.compatibility": "Compatibility targets",
		"graphics:plan.compatibilityFormat": "One target per line: target | strategy | fallback",
		"graphics:plan.assetRequirements": "Asset requirements",
		"graphics:plan.assetValidationRules": "Asset validation rules",
		"graphics:plan.projectContext": "Project context",
		"graphics:plan.openQuestions": "Open questions",
		"graphics:plan.risks": "Plan risks",
		"graphics:plan.acceptancePlan": "Acceptance plan",
		"graphics:plan.decisionSummary": "Decision: {{level}} · {{tasks}} dependency-ordered tasks · revision {{revision}}",
		"graphics:plan.empty": "Generate a solution recommendation, then create the implementation plan.",
		"graphics:plan.implementationTasks": "Implementation tasks",
		"graphics:plan.execute": "Execute",
		"graphics:plan.executeAria": "Execute task {{taskId}}",
		"graphics:plan.cancel": "Cancel",
		"graphics:plan.cancelAria": "Cancel execution for task {{taskId}}",
		"graphics:plan.retry": "Retry",
		"graphics:plan.retryAria": "Retry execution for task {{taskId}}",
		"graphics:plan.executor": "Executor",
		"graphics:plan.agent": "Agent",
		"graphics:plan.human": "Human",
		"graphics:plan.owner": "Task owner",
		"graphics:plan.role": "Execution role",
		"graphics:plan.roleGraphics": "Graphics",
		"graphics:plan.roleClient": "Client",
		"graphics:plan.roleTechnicalArt": "Technical Art",
		"graphics:plan.roleQa": "QA",
		"graphics:plan.roleDesign": "Design",
		"graphics:plan.executionStatus": "Execution status: {{status}}",
		"graphics:plan.executionStarted": "Started: {{time}}",
		"graphics:plan.executionFinished": "Finished: {{time}}",
		"graphics:plan.executionOutput": "Execution output: {{output}}",
		"graphics:plan.executionError": "Execution error: {{error}}",
		"graphics:plan.executionLogs": "Execution logs: {{logs}}",
		"graphics:plan.blocked": "Blocked by incomplete dependencies: {{dependencies}}",
		"graphics:plan.status": "{{taskId}} status",
		"graphics:plan.statusNote": "{{taskId}} status note",
		"graphics:plan.statusNotePlaceholder": "Add progress, blockers, or review notes.",
		"graphics:plan.completionConditions": "{{taskId}} completion conditions",
		"graphics:plan.completionPlaceholder": "One observable completion condition per line.",
		"graphics:plan.none": "none",
		"graphics:plan.acceptance": "Acceptance",
		"graphics:plan.dependencies": "Depends on: {{dependencies}}",
		"graphics:plan.output": "Output: {{output}}",
		"graphics:plan.conflictTitle": "Shared Feature Plan changed",
		"graphics:plan.conflictDescription": "Another window or teammate saved a newer plan. Review the shared version before continuing.",
		"graphics:plan.reloadShared": "Reload shared version",
		"graphics:plan.keepLocalDraft": "Keep local draft",
		"graphics:plan.previewMerge": "Preview manual merge",
		"graphics:plan.mergeConflicts": "{{count}} field conflicts require a choice before saving.",
		"graphics:plan.mergeBase": "Base",
		"graphics:plan.mergeLocal": "Local",
		"graphics:plan.mergeShared": "Shared",
		"graphics:plan.useLocal": "Use local",
		"graphics:plan.useShared": "Use shared",
		"graphics:plan.choiceSelected": "Selected: {{choice}}",
		"graphics:plan.saveMerged": "Save merged plan",
		"graphics:capabilities.featurePlanning": "Feature planning",
		"graphics:capabilities.featurePlanningDescription":
			"Structure requirements, compare implementation levels, and define acceptance criteria.",
		"graphics:capabilities.sourceAnalysis": "Project source analysis",
		"graphics:capabilities.sourceAnalysisDescription":
			"Inspect rendering code, shaders, client integration, and asset contracts without a capture tool.",
		"graphics:capabilities.assetValidation": "Build artifact validation",
		"graphics:capabilities.assetValidationDescription":
			"Inspect Unity bundles or APK assets through an AssetStudio capability when it is installed.",
		"graphics:capabilities.assetValidationReason":
			"AssetStudio is optional. Source-level asset contracts and feature planning remain available.",
		"graphics:capabilities.assetRoadmap":
			"AssetStudio integration will progressively add texture, mesh, material, renderer, memory, and dependency audits.",
		"graphics:capabilities.runtimeGpu": "Runtime GPU investigation",
		"graphics:capabilities.runtimeGpuDescription":
			"Inspect captures, events, pipeline state, shaders, and resources through an optional runtime provider.",
		"graphics:capabilities.provider": "Provider",
		"graphics:capabilities.selectProvider": "Select provider",
		"graphics:capabilities.captureStatus": "Capture status",
		"graphics:capabilities.noCapture": "No capture",
		"graphics:capabilities.frameOverview": "Frame overview",
		"graphics:capabilities.refreshFrame": "Refresh frame",
		"graphics:capabilities.selectedEvent": "Selected event",
		"graphics:capabilities.inspectEvent": "Inspect event",
		"graphics:capabilities.refreshSelection": "Refresh selection",
		"graphics:capabilities.pipeline": "Pipeline",
		"graphics:capabilities.inspectPipeline": "Inspect pipeline",
		"graphics:capabilities.renderTargets": "Render targets",
		"graphics:capabilities.vertexBuffers": "Vertex buffers",
		"graphics:capabilities.depthStencil": "Depth/stencil",
		"graphics:capabilities.shader": "Shader",
		"graphics:capabilities.shaderStage": "Shader stage",
		"graphics:capabilities.inspectShader": "Inspect shader",
		"graphics:capabilities.constantBuffers": "Constant buffers",
		"graphics:capabilities.resources": "Resources",
		"graphics:capabilities.samplers": "Samplers",
		"graphics:capabilities.resource": "Resource",
		"graphics:capabilities.noResource": "No resource details available",
		"graphics:capabilities.diagnostics": "Diagnostics",
		"graphics:capabilities.projectMapping": "Project source mapping",
		"graphics:capabilities.mappingKind": "Mapping object kind",
		"graphics:capabilities.mappingIdentifier": "Shader, pass, draw, or resource identifier",
		"graphics:capabilities.findOwner": "Find source owner",
		"graphics:capabilities.resourceId": "Resource ID",
		"graphics:capabilities.eventIdA": "Event ID A",
		"graphics:capabilities.eventIdB": "Event ID B",
		"graphics:capabilities.frame_performance": "Frame performance",
		"graphics:capabilities.shader_analysis": "Shader analysis",
		"graphics:capabilities.pipeline_analysis": "Pipeline analysis",
		"graphics:capabilities.resource_trace": "Resource trace",
		"graphics:capabilities.captureCompare": "Capture compare",
		"graphics:capabilities.workflowRunning": "Diagnostic is running…",
		"graphics:capabilities.runtimeOptional": "Runtime tools are optional",
		"graphics:capabilities.runtimeOptionalDescription":
			"Feature planning, source analysis, shader authoring, pipeline design, and asset contracts continue to work. Capture actions appear only after a compatible provider is available.",
		"graphics:capabilities.checkingProviders": "Checking optional runtime providers…",
		"graphics:capabilities.runtimeUnavailable":
			"RenderDoc for VS Code is not required for Graphics Workspace. Install a runtime provider only when capture-level GPU evidence is needed.",
	}

	if (graphicsTranslations[key]) {
		let result = graphicsTranslations[key]
		Object.entries(options ?? {}).forEach(([name, value]) => {
			result = result.replace(`{{${name}}}`, String(value))
		})
		return result
	}

	if (key.startsWith("settings.")) {
		// For specific keys the tests are looking for
		if (key === "settings.notifications.sound.label") return "Enable sound effects"
		if (key === "settings.autoApprove.execute.label") return "Always approve allowed execute operations"
		if (key === "settings.autoApprove.execute.allowedCommands") return "Allowed Auto-Execute Commands"
		if (key === "settings.autoApprove.execute.commandPlaceholder") return "Enter command prefix"
		if (key === "settings.autoApprove.execute.addButton") return "Add"
		if (key === "settings.common.save") return "Save"
		if (key === "settings.contextManagement.terminal.label") return "Terminal output limit"
		if (key === "settings.header.title") return "Settings"

		// Default handling of other keys
		return key.split(".").pop() || key
	}

	// Preserve interpolation behavior for unrelated tests that use the mock directly.
	if (options) {
		let result = key
		Object.entries(options).forEach(([varName, value]) => {
			result = result.replace(`{${varName}}`, String(value))
		})
		return result
	}

	return key
}

// Create mock context
export const TranslationContext = createContext<{
	t: (key: string, options?: Record<string, any>) => string
	i18n: any
}>({
	t: mockTranslate,
	i18n: {},
})

// Mock translation provider component
export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	return (
		<TranslationContext.Provider
			value={{
				t: mockTranslate,
				i18n: {},
			}}>
			{children}
		</TranslationContext.Provider>
	)
}

// Custom hook for translations
export const useAppTranslation = () => useContext(TranslationContext)

export default TranslationProvider
