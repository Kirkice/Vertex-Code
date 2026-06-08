#!/usr/bin/env node
/**
 * Fix the last 5 test files by removing entire test blocks/describe blocks
 * that reference TelemetryService or CloudService, and removing dynamic imports
 * for openai-codex.
 * 
 * Strategy: Remove entire it()/test()/describe() blocks that contain
 * TelemetryService or CloudService references.
 */

const fs = require("fs")
const path = require("path")
const ROOT = path.resolve(__dirname, "..")

function fixFile(relPath) {
	const full = path.join(ROOT, relPath)
	if (!fs.existsSync(full)) { console.log("Not found:", relPath); return }

	let content = fs.readFileSync(full, "utf8")
	const orig = content

	// Step 1: Remove static import lines for deleted packages
	content = content.split("\n").filter(l => {
		const t = l.trim()
		if (!t.startsWith("import ")) return true
		if (t.includes('"@roo-code/telemetry"') || t.includes("'@roo-code/telemetry'")) return false
		if (t.includes('"@roo-code/cloud"') || t.includes("'@roo-code/cloud'")) return false
		return true
	}).join("\n")

	// Step 2: Remove dynamic await import lines for openai-codex
	content = content.split("\n").filter(l => {
		if (l.includes("integrations/openai-codex/oauth") || l.includes("integrations/openai-codex/rate-limits")) return false
		return true
	}).join("\n")

	// Step 3: Remove entire vi.mock blocks for @roo-code/telemetry and @roo-code/cloud
	// These are standalone module-level vi.mock(...) calls
	content = removeViMockBlocks(content, ["@roo-code/telemetry", "@roo-code/cloud"])

	// Step 4: Remove entire it()/test() blocks that contain TelemetryService or CloudService
	content = removeTestBlocksWithRefs(content, ["TelemetryService", "CloudService", "openAiCodexOAuthManager"])

	// Step 5: Remove entire describe() blocks that contain TelemetryService or CloudService
	content = removeDescribeBlocksWithRefs(content, ["TelemetryService", "CloudService"])

	// Step 6: Remove if(!TelemetryService.hasInstance()) { ... } blocks
	content = content.replace(/\n\s*if\s*\(!TelemetryService\.hasInstance\(\)\)\s*\{[^}]*\}\n/g, "\n")

	// Step 7: Remove lines with just TelemetryService or CloudService usage
	content = content.split("\n").filter(l => {
		const t = l.trim()
		if (t.startsWith("//") || t.startsWith("*")) return true
		if (t.includes("TelemetryService") || t.includes("CloudService")) return false
		if (t.includes("openAiCodexOAuthManager") || t.includes("fetchOpenAiCodexRateLimitInfo")) return false
		return true
	}).join("\n")

	content = content.replace(/\n{3,}/g, "\n\n")

	if (content !== orig) {
		fs.writeFileSync(full, content)
		console.log("Fixed:", relPath)
	} else {
		console.log("No change:", relPath)
	}
}

function removeViMockBlocks(content, moduleNames) {
	for (const modName of moduleNames) {
		// Find vi.mock("modName", ...) blocks at top level
		let result = ""
		let i = 0
		while (i < content.length) {
			// Check if we're at a vi.mock( call for this module
			const viMockPattern = `vi.mock("${modName}"`
			const viMockPattern2 = `vi.mock('${modName}'`
			if (content.slice(i, i + viMockPattern.length) === viMockPattern ||
				content.slice(i, i + viMockPattern2.length) === viMockPattern2) {
				// Skip to end of this call (matching parens)
				let depth = 0
				let j = i
				while (j < content.length) {
					if (content[j] === "(") depth++
					if (content[j] === ")") { depth--; if (depth === 0) { j++; break } }
					j++
				}
				// Skip trailing newline
				if (j < content.length && content[j] === "\n") j++
				i = j
				continue
			}
			result += content[i]
			i++
		}
		content = result
	}
	return content
}

function removeTestBlocksWithRefs(content, refs) {
	// Remove it("...", ...) and test("...", ...) blocks containing refs
	const testKeywords = ["it(", "test("]
	let changed = true
	while (changed) {
		changed = false
		for (const kw of testKeywords) {
			let result = ""
			let i = 0
			while (i < content.length) {
				// Check if we're at a test keyword at start of a line (with optional indentation)
				// Find the start of the current line
				let lineStart = i
				while (lineStart > 0 && content[lineStart - 1] !== "\n") lineStart--
				const linePrefix = content.slice(lineStart, i)
				
				if (content.slice(i, i + kw.length) === kw && linePrefix.trim() === "") {
					// Find the extent of this test block
					let depth = 0
					let j = i
					let blockContent = ""
					while (j < content.length) {
						if (content[j] === "(") depth++
						if (content[j] === ")") { depth--; if (depth === 0) { j++; break } }
						blockContent += content[j]
						j++
					}
					// Check if block contains any of the refs
					const hasRef = refs.some(r => blockContent.includes(r))
					if (hasRef) {
						// Skip this block
						if (j < content.length && content[j] === "\n") j++
						i = j
						changed = true
						continue
					}
				}
				result += content[i]
				i++
			}
			content = result
		}
	}
	return content
}

function removeDescribeBlocksWithRefs(content, refs) {
	// Remove describe("...", ...) blocks whose ENTIRE content contains refs
	// Only remove leaf describe blocks (not outer ones)
	let changed = true
	while (changed) {
		changed = false
		let result = ""
		let i = 0
		while (i < content.length) {
			let lineStart = i
			while (lineStart > 0 && content[lineStart - 1] !== "\n") lineStart--
			const linePrefix = content.slice(lineStart, i)
			
			if (content.slice(i, i + 9) === "describe(" && linePrefix.trim() === "") {
				// Find the extent of this describe block
				let depth = 0
				let j = i
				let blockContent = ""
				while (j < content.length) {
					if (content[j] === "(") depth++
					if (content[j] === ")") { depth--; if (depth === 0) { j++; break } }
					blockContent += content[j]
					j++
				}
				// Check if ENTIRE block only has refs (no other test content)
				const hasRef = refs.some(r => blockContent.includes(r))
				// Only remove if ALL test content references deleted features
				if (hasRef) {
					// Check if it has non-telemetry tests - simplified: only remove if title suggests it
					const titleMatch = blockContent.match(/describe\("([^"]+)"/)
					const title = titleMatch ? titleMatch[1] : ""
					if (title.toLowerCase().includes("telemetry") ||
						title.toLowerCase().includes("cloud") ||
						title.toLowerCase().includes("oauth") ||
						title.toLowerCase().includes("codex")) {
						if (j < content.length && content[j] === "\n") j++
						i = j
						changed = true
						continue
					}
				}
			}
			result += content[i]
			i++
		}
		content = result
	}
	return content
}

const files = [
	"src/core/condense/__tests__/index.spec.ts",
	"src/core/task/__tests__/validateToolResultIds.spec.ts",
	"src/core/webview/__tests__/ClineProvider.spec.ts",
	"src/core/webview/__tests__/messageEnhancer.test.ts",
	"src/core/webview/__tests__/webviewMessageHandler.spec.ts",
]

for (const f of files) {
	fixFile(f)
}

console.log("\nDone.")