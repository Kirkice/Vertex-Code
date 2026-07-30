import { describe, expect, it } from "vitest"
import { hashContent, parseDocument } from "../nodeParser"

describe("RAG node parser", () => {
	it("creates source-aware nodes", () => {
		const nodes = parseDocument(
			{
				id: "markdown:guide.md",
				path: "guide.md",
				sourceType: "markdown",
				contentHash: hashContent("# Guide\ncontent"),
				metadata: { sourceType: "markdown" },
			},
			"# Guide\ncontent",
		)

		expect(nodes).toHaveLength(1)
		expect(nodes[0]).toMatchObject({ sourcePath: "guide.md", startLine: 1, endLine: 2 })
		expect(nodes[0].text).toContain("content")
	})

	it("does not emit empty nodes", () => {
		const nodes = parseDocument(
			{
				id: "text:empty.txt",
				path: "empty.txt",
				sourceType: "text",
				contentHash: hashContent("\n\n"),
				metadata: {},
			},
			"\n\n",
		)

		expect(nodes).toEqual([])
	})

	it("uses tuned defaults that keep ordinary knowledge chunks near 1000 estimated tokens", () => {
		const document = {
			id: "knowledge:quality.md",
			path: "quality.md",
			sourceType: "knowledge" as const,
			contentHash: "hash",
			metadata: {},
		}
		const nodes = parseDocument(document, Array.from({ length: 120 }, (_, index) => `line-${index} ${"x".repeat(55)}`).join("\n"))

		expect(nodes.length).toBeGreaterThan(1)
		expect(Math.max(...nodes.map((node) => node.text.length))).toBeLessThanOrEqual(4400)
		expect(nodes.slice(1).every((node) => node.text.length >= 400)).toBe(true)
	})
})
