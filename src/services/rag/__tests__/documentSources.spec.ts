import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock external dependencies with static string literals so the hoisted
// vi.mock factories don't reference any module imports before initialization.
vi.mock("../../roo-config", () => ({
	getGlobalRooDirectory: () => "/tmp/rag-test-global-root",
}))

vi.mock("../../knowledge/knowledgeLoader", () => ({
	KNOWLEDGE_DIR: "/tmp/rag-test-bundled-knowledge",
}))

import { defaultRagDocumentRoots, discoverRagDocumentsFromRoots, discoverRagDocuments } from "../documentSources"

const MOCK_GLOBAL_KNOWLEDGE = path.join("/tmp/rag-test-global-root", "knowledge")
const MOCK_BUNDLED_KNOWLEDGE = "/tmp/rag-test-bundled-knowledge"

async function writeFile(dir: string, rel: string, content: string): Promise<string> {
	const filePath = path.join(dir, rel)
	await fs.mkdir(path.dirname(filePath), { recursive: true })
	await fs.writeFile(filePath, content, "utf8")
	return filePath
}

describe("RAG document sources", () => {
	let workspaceDir: string
	const createdDirs: string[] = []

	beforeEach(async () => {
		workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-ws-"))
		createdDirs.push(workspaceDir)
		await fs.mkdir(MOCK_GLOBAL_KNOWLEDGE, { recursive: true })
		await fs.mkdir(MOCK_BUNDLED_KNOWLEDGE, { recursive: true })
	})

	afterEach(async () => {
		await Promise.all(
			createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }).catch(() => {})),
		)
		await fs.rm(MOCK_GLOBAL_KNOWLEDGE, { recursive: true, force: true }).catch(() => {})
		await fs.rm(MOCK_BUNDLED_KNOWLEDGE, { recursive: true, force: true }).catch(() => {})
	})

	describe("defaultRagDocumentRoots", () => {
		it("includes workspace, global knowledge, and bundled knowledge roots", () => {
			const roots = defaultRagDocumentRoots(workspaceDir)
			expect(roots).toHaveLength(3)
			expect(roots[0]).toMatchObject({ path: workspaceDir, sourceType: "markdown" })
			expect(roots[1]).toMatchObject({ sourceType: "knowledge" })
			expect(roots[1].path).toBe(MOCK_GLOBAL_KNOWLEDGE)
			expect(roots[2]).toMatchObject({ path: MOCK_BUNDLED_KNOWLEDGE, sourceType: "knowledge" })
		})
	})

	describe("discoverRagDocumentsFromRoots", () => {
		it("discovers markdown and text files from the workspace root as relative paths", async () => {
			await writeFile(workspaceDir, "guide.md", "# Guide")
			await writeFile(workspaceDir, "notes.txt", "notes")
			await writeFile(workspaceDir, "image.png", "binary")

			const sources = await discoverRagDocumentsFromRoots(
				[{ path: workspaceDir, sourceType: "markdown", basePath: workspaceDir }],
				workspaceDir,
			)

			expect(sources).toHaveLength(2)
			expect(sources.find((s) => s.path === "guide.md")).toMatchObject({ sourceType: "markdown" })
			expect(sources.find((s) => s.path === "notes.txt")).toMatchObject({ sourceType: "text" })
		})

		it("skips node_modules, dist, build, out, and dot directories", async () => {
			await writeFile(workspaceDir, "keep.md", "keep")
			await writeFile(workspaceDir, "node_modules/skip.md", "skip")
			await writeFile(workspaceDir, "dist/skip.md", "skip")
			await writeFile(workspaceDir, ".hidden/skip.md", "skip")

			const sources = await discoverRagDocumentsFromRoots(
				[{ path: workspaceDir, sourceType: "markdown", basePath: workspaceDir }],
				workspaceDir,
			)

			expect(sources).toHaveLength(1)
			expect(sources[0].path).toBe("keep.md")
		})

		it("returns absolute paths for external knowledge roots", async () => {
			await writeFile(MOCK_BUNDLED_KNOWLEDGE, "builtin.md", "builtin content")

			const sources = await discoverRagDocumentsFromRoots(
				[{ path: MOCK_BUNDLED_KNOWLEDGE, sourceType: "knowledge" }],
				workspaceDir,
			)

			expect(sources).toHaveLength(1)
			expect(path.isAbsolute(sources[0].path)).toBe(true)
			expect(sources[0].sourceType).toBe("knowledge")
		})

		it("deduplicates files discovered across overlapping roots", async () => {
			await writeFile(workspaceDir, "shared.md", "shared")

			const sources = await discoverRagDocumentsFromRoots(
				[
					{ path: workspaceDir, sourceType: "markdown", basePath: workspaceDir },
					{ path: workspaceDir, sourceType: "markdown", basePath: workspaceDir },
				],
				workspaceDir,
			)

			expect(sources).toHaveLength(1)
		})
	})

	describe("discoverRagDocuments (integration)", () => {
		it("combines workspace and knowledge sources", async () => {
			await writeFile(workspaceDir, "doc.md", "# Doc")
			await writeFile(MOCK_BUNDLED_KNOWLEDGE, "knowledge.md", "knowledge content")

			const sources = await discoverRagDocuments(workspaceDir)

			const workspaceSource = sources.find((s) => s.path === "doc.md")
			const knowledgeSource = sources.find((s) => s.path.endsWith("knowledge.md"))
			expect(workspaceSource).toMatchObject({ sourceType: "markdown" })
			expect(knowledgeSource).toMatchObject({ sourceType: "knowledge" })
		})
	})
})
