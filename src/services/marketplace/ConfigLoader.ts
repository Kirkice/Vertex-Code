import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { z } from "zod"

import {
	type MarketplaceItem,
	type MarketplaceItemType,
	type SkillFile,
	type McpFile,
	type KnowledgeFile,
	modeMarketplaceItemSchema,
	mcpMarketplaceItemSchema,
	skillMarketplaceItemSchema,
	knowledgeMarketplaceItemSchema,
} from "@roo-code/types"
import { validateMarketplaceReleaseManifest } from "./validation/MarketplaceManifestValidator"

const DEFAULT_MARKET_SOURCE = "https://github.com/Kirkice/vertex-code-market"
const DEFAULT_MARKET_BRANCH = "main"

const localMarketplaceEntrySchema = z.object({
	id: z.string().min(1).optional(),
	name: z.string().min(1),
	description: z.string().optional().default(""),
	author: z.string().optional(),
	authorUrl: z.string().url().optional(),
	tags: z.array(z.string()).optional(),
	prerequisites: z.array(z.string()).optional(),
	source: z.string().url().optional(),
	sourcePath: z.string().min(1),
	branch: z.string().optional(),
	files: z.array(z.object({ path: z.string().min(1), url: z.string().url().optional() })).optional(),
	modeSlugs: z.array(z.string()).optional(),
	group: z
		.object({
			id: z.string().min(1),
			name: z.string().min(1),
			description: z.string().optional(),
			order: z.number().int().optional(),
		})
		.optional(),
	executable: z.string().optional(),
	url: z.string().url().optional(),
	content: z.any().optional(),
	parameters: z.array(z.any()).optional(),
})

const aggregateMarketplaceResponse = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	source: z.string().url().optional(),
	branch: z.string().optional(),
	skills: z.array(localMarketplaceEntrySchema).optional().default([]),
	knowledge: z.array(localMarketplaceEntrySchema).optional().default([]),
	mcps: z.array(localMarketplaceEntrySchema).optional().default([]),
})

const modeMarketplaceResponse = z.object({
	items: z.array(modeMarketplaceItemSchema),
})

const mcpMarketplaceResponse = z.object({
	items: z.array(mcpMarketplaceItemSchema),
})

const skillMarketplaceResponse = z.object({
	items: z.array(skillMarketplaceItemSchema),
})

const knowledgeMarketplaceResponse = z.object({
	items: z.array(knowledgeMarketplaceItemSchema),
})

export class ConfigLoader {
	private readonly marketplacePaths: string[]
	private readonly extensionPath: string
	private readonly workspacePaths: string[]

	constructor(extensionPath: string, workspacePaths: string[] = []) {
		this.extensionPath = extensionPath
		this.workspacePaths = workspacePaths
		this.marketplacePaths = this.createMarketplacePaths(extensionPath, workspacePaths)
		console.log("[Marketplace] ConfigLoader initialized", {
			extensionPath,
			workspacePaths,
			marketplacePaths: this.marketplacePaths,
			externalMarketplacePaths: this.createAggregateMarketplacePaths(),
		})
	}

	async loadAllItems(): Promise<MarketplaceItem[]> {
		const [modes, mcps, skills, knowledge, aggregateItems] = await Promise.all([
			this.fetchModes().catch((error) => this.handleOptionalMarketplaceError("modes.yml", error)),
			this.fetchMcps().catch((error) => this.handleOptionalMarketplaceError("mcps.yml", error)),
			this.fetchSkills(),
			this.fetchKnowledge(),
			this.fetchAggregateMarketplaceItems(),
		])

		const items = this.dedupeItems([...modes, ...mcps, ...skills, ...knowledge, ...aggregateItems])
		await this.validateReleaseManifestIfPresent(items)
		return items
	}

	private async validateReleaseManifestIfPresent(catalogItems: MarketplaceItem[]): Promise<void> {
		for (const marketplacePath of this.marketplacePaths) {
			const manifestPath = path.join(marketplacePath, "graphics-release.yml")
			try {
				const data = await fs.readFile(manifestPath, "utf-8")
				const result = validateMarketplaceReleaseManifest(yaml.parse(data), { catalogItems })
				if (!result.valid) {
					throw new Error(`Invalid graphics marketplace release manifest: ${result.errors.join("; ")}`)
				}
				return
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("Invalid graphics marketplace release manifest")) {
					throw error
				}
			}
		}
	}

	private async fetchModes(): Promise<MarketplaceItem[]> {
		const data = await this.readMarketplaceFile("modes.yml")

		const yamlData = yaml.parse(data)
		const validated = modeMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mode" as const,
			...item,
		}))

		return items
	}

	private async fetchMcps(): Promise<MarketplaceItem[]> {
		const data = await this.readMarketplaceFile("mcps.yml")

		const yamlData = yaml.parse(data)
		const validated = mcpMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mcp" as const,
			...item,
		}))

		return items
	}

	private async fetchSkills(): Promise<MarketplaceItem[]> {
		try {
			const data = await this.readMarketplaceFile("skills.yml")

			const yamlData = yaml.parse(data)
			const validated = skillMarketplaceResponse.parse(yamlData)

			const items: MarketplaceItem[] = validated.items.map((item) => ({
				type: "skill" as const,
				...item,
			}))

			return items
		} catch (error) {
			// skills.yml is optional — return empty array if not found
			console.warn("Failed to load skills.yml:", error)
			return []
		}
	}

	private async fetchKnowledge(): Promise<MarketplaceItem[]> {
		try {
			const data = await this.readMarketplaceFile("knowledge.yml")

			const yamlData = yaml.parse(data)
			const validated = knowledgeMarketplaceResponse.parse(yamlData)

			const items: MarketplaceItem[] = validated.items.map((item) => ({
				type: "knowledge" as const,
				...item,
			}))

			return items
		} catch (error) {
			// knowledge.yml is optional — return empty array if not found
			console.warn("Failed to load knowledge.yml:", error)
			return []
		}
	}

	private async readMarketplaceFile(fileName: string): Promise<string> {
		const attemptedPaths = this.marketplacePaths.map((basePath) => path.join(basePath, fileName))
		let lastError: unknown

		for (const filePath of attemptedPaths) {
			try {
				return await fs.readFile(filePath, "utf-8")
			} catch (error) {
				lastError = error
			}
		}

		const errorMessage = lastError instanceof Error ? lastError.message : String(lastError)
		throw new Error(
			`Failed to read marketplace file '${fileName}'. Tried: ${attemptedPaths.join(", ")}. Last error: ${errorMessage}`,
		)
	}

	async getItem(id: string, type: MarketplaceItemType): Promise<MarketplaceItem | null> {
		const items = await this.loadAllItems()
		return items.find((item) => item.id === id && item.type === type) || null
	}

	private async fetchAggregateMarketplaceItems(): Promise<MarketplaceItem[]> {
		const aggregatePaths = this.createAggregateMarketplacePaths()
		console.log("[Marketplace] aggregate marketplace candidates", aggregatePaths)
		let lastError: unknown

		for (const filePath of aggregatePaths) {
			try {
				const data = await fs.readFile(filePath, "utf-8")
				const yamlData = yaml.parse(data)
				const validated = aggregateMarketplaceResponse.parse(yamlData)
				const baseDir = path.dirname(filePath)
				const source = validated.source ?? DEFAULT_MARKET_SOURCE
				const branch = validated.branch ?? DEFAULT_MARKET_BRANCH

				const [skills, knowledge, mcps] = await Promise.all([
					this.mapAggregateSkills(validated.skills, baseDir, source, branch),
					this.mapAggregateKnowledge(validated.knowledge, baseDir, source, branch),
					this.mapAggregateMcps(validated.mcps, baseDir, source, branch),
				])
				const [discoveredSkills, discoveredKnowledge, discoveredMcps] = await Promise.all([
					this.discoverLocalSkills(baseDir, source, branch),
					this.discoverLocalKnowledge(baseDir, source, branch),
					this.discoverLocalMcps(baseDir, source, branch),
				])
				const declaredSkillIds = new Set(skills.map((item) => item.id))
				const declaredKnowledgeIds = new Set(knowledge.map((item) => item.id))
				const declaredMcpIds = new Set(mcps.map((item) => item.id))

				const items = this.dedupeItems([
					...skills,
					...knowledge,
					...mcps,
					...discoveredSkills.filter((item) => !declaredSkillIds.has(item.id)),
					...discoveredKnowledge.filter((item) => !declaredKnowledgeIds.has(item.id)),
					...discoveredMcps.filter((item) => !declaredMcpIds.has(item.id)),
				])
				console.log("[Marketplace] aggregate marketplace loaded", {
					filePath,
					skills: items.filter((item) => item.type === "skill").length,
					knowledge: items.filter((item) => item.type === "knowledge").length,
					mcps: items.filter((item) => item.type === "mcp").length,
				})
				return items
			} catch (error) {
				lastError = error
				console.warn("[Marketplace] aggregate marketplace candidate failed", { filePath, error })
			}
		}

		if (lastError) {
			console.warn("Failed to load aggregate marketplace.yml:", lastError)
		}

		return []
	}

	private async mapAggregateSkills(
		entries: z.infer<typeof localMarketplaceEntrySchema>[],
		baseDir: string,
		defaultSource: string,
		defaultBranch: string,
	): Promise<MarketplaceItem[]> {
		const items = await Promise.all(
			entries.map(async (entry) => {
				const files = (entry.files ?? (await this.discoverFiles(baseDir, entry.sourcePath))) as SkillFile[]
				const item = skillMarketplaceItemSchema.parse({
					...this.getCommonAggregateFields(entry, defaultSource, defaultBranch),
					group: entry.group ?? this.getDefaultGroup("skill", entry.sourcePath),
					files,
				})
				return { type: "skill" as const, ...item }
			}),
		)
		return items
	}

	private async mapAggregateKnowledge(
		entries: z.infer<typeof localMarketplaceEntrySchema>[],
		baseDir: string,
		defaultSource: string,
		defaultBranch: string,
	): Promise<MarketplaceItem[]> {
		const items = await Promise.all(
			entries.map(async (entry) => {
				const files = (entry.files ?? (await this.discoverFiles(baseDir, entry.sourcePath))) as KnowledgeFile[]
				const item = knowledgeMarketplaceItemSchema.parse({
					...this.getCommonAggregateFields(entry, defaultSource, defaultBranch),
					group: entry.group ?? this.getDefaultGroup("knowledge", entry.sourcePath),
					files,
				})
				return { type: "knowledge" as const, ...item }
			}),
		)
		return items
	}

	private async mapAggregateMcps(
		entries: z.infer<typeof localMarketplaceEntrySchema>[],
		baseDir: string,
		defaultSource: string,
		defaultBranch: string,
	): Promise<MarketplaceItem[]> {
		const items = await Promise.all(
			entries.map(async (entry) => {
				const files = entry.files ?? ((entry.url || entry.content) ? undefined : await this.discoverFiles(baseDir, entry.sourcePath))
				const item = mcpMarketplaceItemSchema.parse({
					...this.getCommonAggregateFields(entry, defaultSource, defaultBranch),
					files: files as McpFile[] | undefined,
					executable: entry.executable,
					url: entry.url,
					content: entry.content,
					parameters: entry.parameters,
				})
				return { type: "mcp" as const, ...item }
			}),
		)
		return items
	}

	private getCommonAggregateFields(
		entry: z.infer<typeof localMarketplaceEntrySchema>,
		defaultSource: string,
		defaultBranch: string,
	) {
		return {
			id: entry.id ?? entry.name,
			name: this.toDisplayName(entry.name),
			description: entry.description,
			author: entry.author ?? "@Kirkice",
			authorUrl: entry.authorUrl ?? "https://github.com/Kirkice",
			tags: entry.tags,
			prerequisites: entry.prerequisites,
			source: entry.source ?? defaultSource,
			sourcePath: entry.sourcePath,
			branch: entry.branch ?? defaultBranch,
			modeSlugs: entry.modeSlugs,
			group: entry.group,
		}
	}

	private getDefaultGroup(type: "skill" | "knowledge", sourcePath: string) {
		const parts = sourcePath.split(/[\\/]+/).filter(Boolean)
		const folder = type === "skill" ? parts[1] ?? parts[0] : parts[1] ?? "general"
		const id = `${type}-${this.toId(folder) || "general"}`
		return {
			id,
			name: this.toDisplayName(folder),
			description: `${this.toDisplayName(folder)} ${type}s`,
		}
	}

	private async discoverFiles(baseDir: string, sourcePath: string): Promise<SkillFile[]> {
		const itemDir = path.join(baseDir, sourcePath)
		const files: SkillFile[] = []

		async function walk(currentDir: string, relativeDir = "") {
			const entries = await fs.readdir(currentDir, { withFileTypes: true })
			for (const entry of entries) {
				const relativePath = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name
				const absolutePath = path.join(currentDir, entry.name)

				if (entry.isDirectory()) {
					await walk(absolutePath, relativePath)
				} else if (entry.isFile()) {
					files.push({ path: relativePath })
				}
			}
		}

		await walk(itemDir)
		return files.sort((a, b) => a.path.localeCompare(b.path))
	}

	private async discoverLocalSkills(baseDir: string, source: string, branch: string): Promise<MarketplaceItem[]> {
		const skillsRoot = path.join(baseDir, "skills")
		const skillDirs = await this.findDirectoriesContaining(skillsRoot, "SKILL.md")

		const items = await Promise.all(
			skillDirs.map(async (skillDir) => {
				const sourcePath = this.toPosixPath(path.relative(baseDir, skillDir))
				const id = path.basename(skillDir)
				const files = await this.discoverFiles(baseDir, sourcePath)
				const item = skillMarketplaceItemSchema.parse({
					id,
					name: this.toDisplayName(id),
					description: await this.extractDescription(path.join(skillDir, "SKILL.md"), `Skill from ${sourcePath}`),
					author: "@Kirkice",
					authorUrl: "https://github.com/Kirkice",
					source,
					sourcePath,
					branch,
					group: this.getDefaultGroup("skill", sourcePath),
					files,
				})
				return { type: "skill" as const, ...item }
			}),
		)

		return items
	}

	private async discoverLocalKnowledge(baseDir: string, source: string, branch: string): Promise<MarketplaceItem[]> {
		const knowledgeRoot = path.join(baseDir, "knowledge")
		const markdownFiles = await this.findFilesByExtension(knowledgeRoot, ".md")

		const items = await Promise.all(
			markdownFiles.map(async (filePath) => {
				const sourcePath = this.toPosixPath(path.relative(baseDir, path.dirname(filePath)))
				const fileName = path.basename(filePath)
				const id = this.toId(path.basename(filePath, path.extname(filePath)))
				const item = knowledgeMarketplaceItemSchema.parse({
					id,
					name: this.toDisplayName(path.basename(filePath, path.extname(filePath))),
					description: await this.extractDescription(filePath, `Knowledge document from ${sourcePath}/${fileName}`),
					author: "@Kirkice",
					authorUrl: "https://github.com/Kirkice",
					source,
					sourcePath,
					branch,
					group: this.getDefaultGroup("knowledge", sourcePath),
					files: [{ path: fileName }],
				})
				return { type: "knowledge" as const, ...item }
			}),
		)

		return items
	}

	private async discoverLocalMcps(baseDir: string, source: string, branch: string): Promise<MarketplaceItem[]> {
		const mcpsRoot = path.join(baseDir, "mcps")
		let entries: import("fs").Dirent[]
		try {
			entries = await fs.readdir(mcpsRoot, { withFileTypes: true })
		} catch {
			return []
		}

		const items = await Promise.all(
			entries
				.filter((entry) => entry.isDirectory())
				.map(async (entry) => {
					const sourcePath = this.toPosixPath(path.relative(baseDir, path.join(mcpsRoot, entry.name)))
					const files = (await this.discoverFiles(baseDir, sourcePath)) as McpFile[]
					const executable = files.find((file) => file.path.toLowerCase().endsWith(".exe"))?.path
					const item = mcpMarketplaceItemSchema.parse({
						id: entry.name,
						name: this.toDisplayName(entry.name),
						description: await this.extractDescription(
							path.join(mcpsRoot, entry.name, "README.md"),
							`MCP server from ${sourcePath}`,
						),
						author: "@Kirkice",
						authorUrl: "https://github.com/Kirkice",
						source,
						sourcePath,
						branch,
						files,
						executable,
					})
					return { type: "mcp" as const, ...item }
				}),
		)

		return items
	}

	private async findDirectoriesContaining(rootDir: string, fileName: string): Promise<string[]> {
		const matches: string[] = []

		async function walk(currentDir: string) {
			let entries: import("fs").Dirent[]
			try {
				entries = await fs.readdir(currentDir, { withFileTypes: true })
			} catch {
				return
			}

			if (entries.some((entry) => entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase())) {
				matches.push(currentDir)
				return
			}

			await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => walk(path.join(currentDir, entry.name))))
		}

		await walk(rootDir)
		return matches.sort()
	}

	private async findFilesByExtension(rootDir: string, extension: string): Promise<string[]> {
		const matches: string[] = []

		async function walk(currentDir: string) {
			let entries: import("fs").Dirent[]
			try {
				entries = await fs.readdir(currentDir, { withFileTypes: true })
			} catch {
				return
			}

			await Promise.all(
				entries.map(async (entry) => {
					const absolutePath = path.join(currentDir, entry.name)
					if (entry.isDirectory()) {
						await walk(absolutePath)
					} else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension.toLowerCase())) {
						matches.push(absolutePath)
					}
				}),
			)
		}

		await walk(rootDir)
		return matches.sort()
	}

	private async extractDescription(filePath: string, fallback: string): Promise<string> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const lines = content
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("---") && !line.startsWith("#"))
			const firstUsefulLine = lines.find((line) => !line.includes(":")) ?? lines[0]
			return firstUsefulLine?.slice(0, 240) || fallback
		} catch {
			return fallback
		}
	}

	private toId(value: string): string {
		return this.toPosixPath(value)
			.replace(/\.[^/.]+$/g, "")
			.replace(/[^a-zA-Z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.toLowerCase()
	}

	private toPosixPath(value: string): string {
		return value.split(path.sep).join("/")
	}

	private toDisplayName(value: string): string {
		return value
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ")
	}

	private dedupeItems(items: MarketplaceItem[]): MarketplaceItem[] {
		const byKey = new Map<string, MarketplaceItem>()

		for (const item of items) {
			byKey.set(`${item.type}:${item.id}`, item)
		}

		return Array.from(byKey.values())
	}

	private createAggregateMarketplacePaths(): string[] {
		return this.createExternalMarketplaceRoots(this.extensionPath).map((root) => path.join(root, "marketplace.yml"))
	}

	private createMarketplacePaths(extensionPath: string, workspacePaths: string[] = []): string[] {
		const candidates = [
			path.join(extensionPath, "assets", "marketplace"),
			path.join(extensionPath, "..", "assets", "marketplace"),
			path.join(extensionPath, "dist", "assets", "marketplace"),
			path.join(extensionPath, "..", "dist", "assets", "marketplace"),
		]

		for (const workspacePath of workspacePaths) {
			candidates.push(
				path.join(workspacePath, "assets", "marketplace"),
				path.join(workspacePath, "src", "assets", "marketplace"),
				path.join(workspacePath, "dist", "assets", "marketplace"),
				path.join(workspacePath, "src", "dist", "assets", "marketplace"),
			)
		}

		return [...new Set(candidates.map((candidate) => path.normalize(candidate)))]
	}

	private handleOptionalMarketplaceError(fileName: string, error: unknown): MarketplaceItem[] {
		console.warn(`Failed to load optional marketplace file '${fileName}':`, error)
		return []
	}

	private createExternalMarketplaceRoots(extensionPath: string): string[] {
		const envPath = process.env.VERTEX_CODE_MARKETPLACE_PATH
		const candidates = [envPath]

		for (const root of [extensionPath, ...this.workspacePaths]) {
			let current = path.resolve(root)
			for (let depth = 0; depth < 6; depth++) {
				candidates.push(path.join(current, "vertex-code-market"))
				const parent = path.dirname(current)
				if (parent === current) break
				current = parent
			}
		}

		return [
			...new Set(
				candidates
					.filter((candidate): candidate is string => Boolean(candidate))
					.map((candidate) => path.normalize(candidate)),
			),
		]
	}
}
