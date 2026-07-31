import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { describe, expect, it } from "vitest"
import { KnowledgeRegistry, type KnowledgeSource } from "../KnowledgeRegistry"
import type { GraphicsKnowledgeEntry } from "../types"

const createEntry = (id: string, priority = 1): GraphicsKnowledgeEntry => ({
	id,
	title: id,
	path: "entry.md",
	summary: id,
	kind: "reference",
	domain: "graphics",
	tags: [],
	triggers: [id],
	scenarios: [],
	modes: ["graphics"],
	priority,
	relatedSkills: [],
	relatedPlaybooks: [],
	tokenBudget: 100,
	alwaysInclude: false,
})

function source(kind: KnowledgeSource["kind"], id: string, root: string, entry: GraphicsKnowledgeEntry): KnowledgeSource {
	return { kind, id, root, entries: [entry] }
}

describe("KnowledgeRegistry", () => {
	it("merges sources with project precedence and deterministic ordering", () => {
		const registry = new KnowledgeRegistry()
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-registry-"))
		registry.register(source("built-in", "builtin", root, createEntry("shared", 100)))
		registry.register(source("marketplace", "market", root, createEntry("market-only", 1)))
		registry.register(source("project", "project", root, createEntry("shared", 1)))

		expect(registry.list().map((entry) => entry.id)).toEqual(["market-only", "shared"])
		expect(registry.findById("shared")?.sourceKind).toBe("project")
	})

	it("loads content from the selected source and rejects traversal", () => {
		const registry = new KnowledgeRegistry()
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-registry-"))
		fs.writeFileSync(path.join(root, "entry.md"), "project content")
		registry.register(source("project", "project", root, createEntry("safe")))

		const safe = registry.findById("safe")!
		expect(registry.loadContent(safe)).toBe("project content")
		expect(registry.loadContent({ ...safe, path: "../outside.md" })).toBe("")
	})

	it("invalidates a removed source without affecting other sources", () => {
		const registry = new KnowledgeRegistry()
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-registry-"))
		registry.register(source("built-in", "builtin", root, createEntry("builtin")))
		registry.register(source("global", "global", root, createEntry("global")))
		registry.unregister("global", "global")

		expect(registry.findById("global")).toBeUndefined()
		expect(registry.findById("builtin")?.sourceKind).toBe("built-in")
	})
})
