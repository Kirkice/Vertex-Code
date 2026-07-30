/**
 * Project-file persistence for the Graphics Workspace.
 *
 * The project files are the team-shareable source of truth when a workspace is
 * open. VS Code workspaceState remains a cache owned by the message handler so
 * existing workspaces and no-workspace usage continue to work.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { GraphicsFeatureBrief, GraphicsFeaturePlan } from "@roo-code/types"

const GRAPHICS_DIRECTORY = ".roo/graphics"
const FEATURE_BRIEF_FILE = "feature-brief.json"
const FEATURE_PLAN_FILE = "feature-plan.json"

type GraphicsPersistedValue = GraphicsFeatureBrief | GraphicsFeaturePlan

/** Handles version checks without attempting to silently migrate unknown schemas. */
function isSupportedValue(value: unknown): value is GraphicsPersistedValue {
	return Boolean(value && typeof value === "object" && (value as { version?: unknown }).version === 1)
}

export class GraphicsFeatureWorkspaceStore {
	constructor(
		private readonly workspacePath: string | undefined,
		private readonly log: (message: string) => void = () => undefined,
	) {}

	/** Loads the project Feature Brief, returning undefined for unavailable or invalid files. */
	public async loadBrief(): Promise<GraphicsFeatureBrief | undefined> {
		return this.loadFile<GraphicsFeatureBrief>(FEATURE_BRIEF_FILE)
	}

	/** Loads the project Feature Plan, returning undefined for unavailable or invalid files. */
	public async loadPlan(): Promise<GraphicsFeaturePlan | undefined> {
		return this.loadFile<GraphicsFeaturePlan>(FEATURE_PLAN_FILE)
	}

	/** Writes the Feature Brief atomically so a concurrent reader never sees partial JSON. */
	public async saveBrief(brief: GraphicsFeatureBrief): Promise<boolean> {
		return this.saveFile(FEATURE_BRIEF_FILE, brief)
	}

	/** Writes the Feature Plan atomically and preserves its revision for conflict checks. */
	public async savePlan(plan: GraphicsFeaturePlan): Promise<boolean> {
		return this.saveFile(FEATURE_PLAN_FILE, plan)
	}

	private getFilePath(fileName: string): string | undefined {
		return this.workspacePath ? path.join(this.workspacePath, GRAPHICS_DIRECTORY, fileName) : undefined
	}

	private async loadFile<T extends GraphicsPersistedValue>(fileName: string): Promise<T | undefined> {
		const filePath = this.getFilePath(fileName)
		if (!filePath) return undefined

		try {
			const value: unknown = JSON.parse(await readFile(filePath, "utf8"))
			if (!isSupportedValue(value)) {
				this.log(`[Graphics] Ignoring unsupported project file: ${filePath}`)
				return undefined
			}
			return value as T
		} catch (error) {
			const code =
				error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined
			if (code !== "ENOENT") {
				this.log(`[Graphics] Could not read project file ${filePath}: ${String(error)}`)
			}
			return undefined
		}
	}

	private async saveFile<T extends GraphicsPersistedValue>(fileName: string, value: T): Promise<boolean> {
		const filePath = this.getFilePath(fileName)
		if (!filePath) return false

		const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
		try {
			await mkdir(path.dirname(filePath), { recursive: true })
			await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
			await rename(temporaryPath, filePath)
			return true
		} catch (error) {
			this.log(`[Graphics] Could not write project file ${filePath}: ${String(error)}`)
			await rm(temporaryPath, { force: true }).catch(() => undefined)
			return false
		}
	}
}
