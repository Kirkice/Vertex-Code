import * as fs from "node:fs"
import * as path from "node:path"

import type { GraphicsKnowledgeEntry } from "./types"

export type KnowledgeSourceKind = "built-in" | "marketplace" | "global" | "project"

export interface KnowledgeRegistryEntry extends GraphicsKnowledgeEntry {
	sourceKind: KnowledgeSourceKind
	sourceId: string
	version?: string
	contentRoot: string
}

export interface KnowledgeSource {
	kind: KnowledgeSourceKind
	id: string
	root: string
	entries: GraphicsKnowledgeEntry[]
	version?: string
}

const SOURCE_PRIORITY: Record<KnowledgeSourceKind, number> = {
	"built-in": 0,
	marketplace: 1,
	global: 2,
	project: 3,
}

/** Merges knowledge sources with deterministic scope precedence and safe paths. */
export class KnowledgeRegistry {
	private readonly sources = new Map<string, KnowledgeSource>()

	register(source: KnowledgeSource): void {
		const root = path.resolve(source.root)
		const entries = source.entries
			.filter((entry) => isSafeRelativePath(entry.path))
			.map((entry) => ({
				...entry,
				tags: [...entry.tags],
				triggers: [...entry.triggers],
				scenarios: [...entry.scenarios],
				relatedSkills: [...entry.relatedSkills],
				relatedPlaybooks: [...entry.relatedPlaybooks],
				sourceKind: source.kind,
				sourceId: source.id,
				version: source.version,
				contentRoot: root,
			}))
		this.sources.set(`${source.kind}:${source.id}`, { ...source, root, entries })
	}

	unregister(kind: KnowledgeSourceKind, id: string): void {
		this.sources.delete(`${kind}:${id}`)
	}

	clear(): void {
		this.sources.clear()
	}

	list(): KnowledgeRegistryEntry[] {
		const byId = new Map<string, KnowledgeRegistryEntry>()
		for (const source of this.sources.values()) {
			for (const entry of source.entries as KnowledgeRegistryEntry[]) {
				const existing = byId.get(entry.id)
				if (!existing || compareEntries(entry, existing) > 0) {
					byId.set(entry.id, entry)
				}
			}
		}
		return [...byId.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
	}

	findById(id: string): KnowledgeRegistryEntry | undefined {
		return this.list().find((entry) => entry.id === id)
	}

	loadContent(entry: KnowledgeRegistryEntry): string {
		const root = path.resolve(entry.contentRoot)
		const filePath = path.resolve(root, entry.path)
		if (!isWithinRoot(root, filePath)) return ""
		try {
			return fs.readFileSync(filePath, "utf8")
		} catch {
			return ""
		}
	}
}

function compareEntries(a: KnowledgeRegistryEntry, b: KnowledgeRegistryEntry): number {
	return SOURCE_PRIORITY[a.sourceKind] - SOURCE_PRIORITY[b.sourceKind] || a.priority - b.priority || a.sourceId.localeCompare(b.sourceId)
}

function isSafeRelativePath(value: string): boolean {
	return !path.posix.isAbsolute(value) && !path.win32.isAbsolute(value) && isWithinRoot("/knowledge", path.resolve("/knowledge", value))
}

function isWithinRoot(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate)
	return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}
