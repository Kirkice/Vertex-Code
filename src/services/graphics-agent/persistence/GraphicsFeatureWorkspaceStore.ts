/**
 * Project-file persistence for the Graphics Workspace.
 *
 * Project files are the team-shareable source of truth. The store exposes a
 * fingerprint and conditional write API so multiple VS Code windows cannot
 * silently overwrite a newer plan written by another window.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
	GraphicsFeatureArtifactEnvelope,
	GraphicsFeatureBrief,
	GraphicsFeaturePlan,
	GraphicsFeaturePlanArtifacts,
	GraphicsProjectProfile,
	GraphicsSolutionRecommendation,
} from "@roo-code/types"

const GRAPHICS_DIRECTORY = ".roo/graphics"
const FEATURE_BRIEF_FILE = "feature-brief.json"
const FEATURE_PLAN_FILE = "feature-plan.json"
const FEATURE_PROFILE_FILE = "project-profile.json"
const FEATURE_RECOMMENDATION_FILE = "solution-recommendation.json"
const ARCHITECTURE_DECISION_FILE = "architecture-decision.json"
const ASSET_CONTRACT_FILE = "asset-contract.json"
const PERFORMANCE_BUDGET_FILE = "performance-budget.json"
const COMPATIBILITY_MATRIX_FILE = "compatibility-matrix.json"
const VERIFICATION_REPORT_FILE = "verification-report.json"

type GraphicsPersistedValue =
	| GraphicsFeatureBrief
	| GraphicsFeaturePlan
	| GraphicsProjectProfile
	| GraphicsSolutionRecommendation
	type GraphicsPersistedArtifact = GraphicsFeatureArtifactEnvelope<unknown>

/** Metadata captured with a read, used to detect external edits between read and write. */
export interface GraphicsFileFingerprint {
	sha256: string
	mtimeMs: number
	size: number
}

/** A project value together with the exact file identity observed at read time. */
export interface GraphicsWorkspaceSnapshot<T extends GraphicsPersistedValue | GraphicsPersistedArtifact> {
	value: T
	fingerprint: GraphicsFileFingerprint
}

/** Result of an optimistic write; conflict keeps both versions available to the caller. */
export interface GraphicsConditionalSaveResult<T extends GraphicsPersistedValue | GraphicsPersistedArtifact> {
	saved: boolean
	conflict: boolean
	current?: GraphicsWorkspaceSnapshot<T>
}

/** Handles version checks without attempting to silently migrate unknown schemas. */
function isSupportedValue(value: unknown): value is GraphicsPersistedValue | GraphicsPersistedArtifact {
	return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1)
}

/** Creates a stable content fingerprint in addition to filesystem metadata. */
function createFingerprint(content: string, fileStats: { mtimeMs: number; size: number }): GraphicsFileFingerprint {
	return {
		sha256: createHash("sha256").update(content, "utf8").digest("hex"),
		mtimeMs: fileStats.mtimeMs,
		size: fileStats.size,
	}
}

/** Compares all fingerprint fields so same-size edits are still detected. */
function fingerprintsEqual(left: GraphicsFileFingerprint, right: GraphicsFileFingerprint): boolean {
	return left.sha256 === right.sha256 && left.mtimeMs === right.mtimeMs && left.size === right.size
}

export class GraphicsFeatureWorkspaceStore {
	constructor(
		private readonly workspacePath: string | undefined,
		private readonly log: (message: string) => void = () => undefined,
	) {}

	/** Loads the project Feature Brief, returning undefined for unavailable or invalid files. */
	public async loadBrief(): Promise<GraphicsFeatureBrief | undefined> {
		return (await this.loadSnapshot<GraphicsFeatureBrief>(FEATURE_BRIEF_FILE))?.value
	}

	/** Loads the project Feature Plan, returning undefined for unavailable or invalid files. */
	public async loadPlan(): Promise<GraphicsFeaturePlan | undefined> {
		return (await this.loadSnapshot<GraphicsFeaturePlan>(FEATURE_PLAN_FILE))?.value
	}

	/** Loads the plan and its fingerprint for watcher and multi-window coordination. */
	public async loadPlanSnapshot(): Promise<GraphicsWorkspaceSnapshot<GraphicsFeaturePlan> | undefined> {
		return this.loadSnapshot<GraphicsFeaturePlan>(FEATURE_PLAN_FILE)
	}

	/** Loads the brief and its fingerprint for watcher and multi-window coordination. */
	public async loadBriefSnapshot(): Promise<GraphicsWorkspaceSnapshot<GraphicsFeatureBrief> | undefined> {
		return this.loadSnapshot<GraphicsFeatureBrief>(FEATURE_BRIEF_FILE)
	}

	/** Loads the project profile used to recreate the planning context without rescanning. */
	public async loadProfile(): Promise<GraphicsProjectProfile | undefined> {
		return (await this.loadSnapshot<GraphicsProjectProfile>(FEATURE_PROFILE_FILE))?.value
	}

	/** Loads the last explainable solution recommendation for offline workspace recovery. */
	public async loadRecommendation(): Promise<GraphicsSolutionRecommendation | undefined> {
		return (await this.loadSnapshot<GraphicsSolutionRecommendation>(FEATURE_RECOMMENDATION_FILE))?.value
	}

	/**
	 * Restores independently persisted plan sections. Missing sections fall back to the
	 * embedded plan fields so older workspaces remain recoverable after the split.
	 */
	public async loadPlanArtifacts(plan?: GraphicsFeaturePlan): Promise<GraphicsFeaturePlanArtifacts | undefined> {
		const [architectureDecision, assetContract, performanceBudget, compatibilityMatrix, verificationReport] =
			await Promise.all([
				this.loadArtifact<GraphicsFeaturePlanArtifacts["architectureDecision"]>(ARCHITECTURE_DECISION_FILE),
				this.loadArtifact<GraphicsFeaturePlanArtifacts["assetContract"]>(ASSET_CONTRACT_FILE),
				this.loadArtifact<GraphicsFeaturePlanArtifacts["performanceBudget"]>(PERFORMANCE_BUDGET_FILE),
				this.loadArtifact<GraphicsFeaturePlanArtifacts["compatibilityMatrix"]>(COMPATIBILITY_MATRIX_FILE),
				this.loadArtifact<GraphicsFeaturePlanArtifacts["verificationReport"]>(VERIFICATION_REPORT_FILE),
			])

		if (architectureDecision && assetContract && performanceBudget && compatibilityMatrix && verificationReport) {
			return { architectureDecision, assetContract, performanceBudget, compatibilityMatrix, verificationReport }
		}
		if (!plan) return undefined

		// This compatibility projection is intentionally read-only; a later save upgrades the workspace.
		return {
			architectureDecision: architectureDecision ?? this.createArtifact("architecture-decision", plan, plan.decision),
			assetContract: assetContract ?? this.createArtifact("asset-contract", plan, plan.assetContract),
			performanceBudget: performanceBudget ?? this.createArtifact("performance-budget", plan, plan.performanceBudget),
			compatibilityMatrix: compatibilityMatrix ?? this.createArtifact("compatibility-matrix", plan, plan.compatibility),
			verificationReport:
				verificationReport ??
				this.createArtifact("verification-report", plan, {
					checks: plan.acceptancePlan,
					status: "pending",
					summary: "Verification has not been recorded yet.",
				}),
		}
	}

	/** Writes all independently recoverable sections atomically, preserving one plan revision. */
	public async savePlanArtifacts(plan: GraphicsFeaturePlan): Promise<boolean> {
		const artifacts: GraphicsFeaturePlanArtifacts = {
			architectureDecision: this.createArtifact("architecture-decision", plan, plan.decision),
			assetContract: this.createArtifact("asset-contract", plan, plan.assetContract),
			performanceBudget: this.createArtifact("performance-budget", plan, plan.performanceBudget),
			compatibilityMatrix: this.createArtifact("compatibility-matrix", plan, plan.compatibility),
			verificationReport: this.createArtifact("verification-report", plan, {
				checks: plan.acceptancePlan,
				status: "pending",
				summary: "Verification has not been recorded yet.",
			}),
		}
		const files: Array<[string, GraphicsPersistedArtifact]> = [
			[ARCHITECTURE_DECISION_FILE, artifacts.architectureDecision],
			[ASSET_CONTRACT_FILE, artifacts.assetContract],
			[PERFORMANCE_BUDGET_FILE, artifacts.performanceBudget],
			[COMPATIBILITY_MATRIX_FILE, artifacts.compatibilityMatrix],
			[VERIFICATION_REPORT_FILE, artifacts.verificationReport],
		]
		const results = await Promise.all(files.map(([fileName, value]) => this.saveFile(fileName, value)))
		return results.every((result) => result.saved)
	}

	/** Persists the profile atomically; malformed legacy files are ignored on read. */
	public async saveProfile(profile: GraphicsProjectProfile): Promise<boolean> {
		return (await this.saveFile(FEATURE_PROFILE_FILE, profile)).saved
	}

	/** Persists the recommendation atomically, including optional decision history. */
	public async saveRecommendation(recommendation: GraphicsSolutionRecommendation): Promise<boolean> {
		return (await this.saveFile(FEATURE_RECOMMENDATION_FILE, recommendation)).saved
	}

	/** Writes the Feature Brief atomically so a concurrent reader never sees partial JSON. */
	public async saveBrief(brief: GraphicsFeatureBrief): Promise<boolean> {
		return (await this.saveFile(FEATURE_BRIEF_FILE, brief)).saved
	}

	/** Writes the Feature Plan atomically and preserves its revision for conflict checks. */
	public async savePlan(plan: GraphicsFeaturePlan): Promise<boolean> {
		return (await this.saveFile(FEATURE_PLAN_FILE, plan)).saved
	}

	/**
	 * Saves only when the file still matches the snapshot observed by this window.
	 * A missing snapshot is valid only when the file is still absent, preventing a
	 * first writer from replacing a plan created by another window in the meantime.
	 */
	public async savePlanIfUnchanged(
		plan: GraphicsFeaturePlan,
		expected: GraphicsWorkspaceSnapshot<GraphicsFeaturePlan> | undefined,
	): Promise<GraphicsConditionalSaveResult<GraphicsFeaturePlan>> {
		return this.saveIfUnchanged(FEATURE_PLAN_FILE, plan, expected)
	}

	/** Returns the absolute project path, useful for diagnostics without exposing internals. */
	public getPlanPath(): string | undefined {
		return this.getFilePath(FEATURE_PLAN_FILE)
	}

	private getFilePath(fileName: string): string | undefined {
		return this.workspacePath ? path.join(this.workspacePath, GRAPHICS_DIRECTORY, fileName) : undefined
	}

	private createArtifact<T>(
		kind: GraphicsFeatureArtifactEnvelope<T>["kind"],
		plan: GraphicsFeaturePlan,
		value: T,
	): GraphicsFeatureArtifactEnvelope<T> {
		return {
			version: 1,
			kind,
			featurePlanRevision: plan.revision,
			generatedAt: plan.updatedAt,
			value,
		}
	}

	private async loadArtifact<T extends GraphicsPersistedArtifact>(fileName: string): Promise<T | undefined> {
		return (await this.loadSnapshot<T>(fileName))?.value
	}

	private async loadSnapshot<T extends GraphicsPersistedValue | GraphicsPersistedArtifact>(
		fileName: string,
	): Promise<GraphicsWorkspaceSnapshot<T> | undefined> {
		const filePath = this.getFilePath(fileName)
		if (!filePath) return undefined

		try {
			const content = await readFile(filePath, "utf8")
			const value: unknown = JSON.parse(content)
			if (!isSupportedValue(value)) {
				this.log(`[Graphics] Ignoring unsupported project file: ${filePath}`)
				return undefined
			}
			return { value: value as T, fingerprint: createFingerprint(content, await stat(filePath)) }
		} catch (error) {
			const code =
				error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined
			if (code !== "ENOENT") this.log(`[Graphics] Could not read project file ${filePath}: ${String(error)}`)
			return undefined
		}
	}

	private async saveIfUnchanged<T extends GraphicsPersistedValue | GraphicsPersistedArtifact>(
		fileName: string,
		value: T,
		expected: GraphicsWorkspaceSnapshot<T> | undefined,
	): Promise<GraphicsConditionalSaveResult<T>> {
		const filePath = this.getFilePath(fileName)
		if (!filePath) return { saved: false, conflict: false }

		const current = await this.loadSnapshot<T>(fileName)
		if (expected && (!current || !fingerprintsEqual(current.fingerprint, expected.fingerprint))) {
			return { saved: false, conflict: true, current }
		}
		if (!expected && current) return { saved: false, conflict: true, current }

		const result = await this.saveFile(fileName, value)
		return { saved: result.saved, conflict: false, current: result.snapshot }
	}

	private async saveFile<T extends GraphicsPersistedValue | GraphicsPersistedArtifact>(
		fileName: string,
		value: T,
	): Promise<{ saved: boolean; snapshot?: GraphicsWorkspaceSnapshot<T> }> {
		const filePath = this.getFilePath(fileName)
		if (!filePath) return { saved: false }

		const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
		try {
			await mkdir(path.dirname(filePath), { recursive: true })
			const content = `${JSON.stringify(value, null, 2)}\n`
			await writeFile(temporaryPath, content, "utf8")
			await rename(temporaryPath, filePath)
			return { saved: true, snapshot: { value, fingerprint: createFingerprint(content, await stat(filePath)) } }
		} catch (error) {
			this.log(`[Graphics] Could not write project file ${filePath}: ${String(error)}`)
			await rm(temporaryPath, { force: true }).catch(() => undefined)
			return { saved: false }
		}
	}
}
