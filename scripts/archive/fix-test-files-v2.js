#!/usr/bin/env node
/**
 * Smart test file fixer:
 * 1. Delete test files that test deleted features
 * 2. For remaining files: remove static import lines only (keep vi.mock blocks intact)
 *    and remove TelemetryService/CloudService USAGE lines outside vi.mock
 */

const fs = require("fs")
const path = require("path")
const ROOT = path.resolve(__dirname, "..")

// Files that test deleted features - just delete them
const filesToDelete = [
	"src/core/webview/__tests__/telemetrySettingsTracking.spec.ts",
	"src/core/webview/__tests__/webviewMessageHandler.cloudAuth.spec.ts",
	"src/api/providers/__tests__/openai-codex-native-tool-calls.spec.ts",
]

for (const f of filesToDelete) {
	const full = path.join(ROOT, f)
	if (fs.existsSync(full)) {
		fs.unlinkSync(full)
		console.log("Deleted:", f)
	}
}

// Files that have incidental TelemetryService setup - fix them
function fixTestFile(relPath) {
	const full = path.join(ROOT, relPath)
	if (!fs.existsSync(full)) { console.log("Not found:", relPath); return }

	const lines = fs.readFileSync(full, "utf8").split("\n")
	const output = []
	let i = 0
	let insideViMock = false
	let viMockDepth = 0

	while (i < lines.length) {
		const line = lines[i]
		const t = line.trim()

		// Track vi.mock blocks - these MUST stay intact
		if (t.startsWith("vi.mock(") && (t.includes("@roo-code/telemetry") || t.includes("@roo-code/cloud"))) {
			insideViMock = true
			viMockDepth = 0
		}

		if (insideViMock) {
			// Count parens to find end of vi.mock() call
			for (const ch of line) {
				if (ch === "(") viMockDepth++
				if (ch === ")") viMockDepth--
			}
			output.push(line)
			i++
			if (viMockDepth <= 0) insideViMock = false
			continue
		}

		// Remove static import lines for deleted packages
		if (t.startsWith("import ") && (
			t.includes('"@roo-code/telemetry"') || t.includes("'@roo-code/telemetry'") ||
			t.includes('"@roo-code/cloud"') || t.includes("'@roo-code/cloud'") ||
			t.includes('"../../../integrations/openai-codex') || t.includes("'../../../integrations/openai-codex")
		)) {
			i++
			continue
		}

		// Remove TelemetryService.hasInstance() + createInstance() blocks in beforeEach
		// Pattern: if (!TelemetryService.hasInstance()) {\n   TelemetryService.createInstance([])\n}
		if (t === "if (!TelemetryService.hasInstance()) {") {
			// Skip this 3-line block
			i++ // skip if line
			while (i < lines.length && lines[i].trim() !== "}") i++ // skip body
			i++ // skip closing }
			continue
		}

		// Remove standalone TelemetryService/CloudService usage lines (not in comments)
		if (!t.startsWith("//") && !t.startsWith("*") && !t.startsWith("vi.mock(")) {
			if (t.includes("TelemetryService") || t.includes("CloudService") ||
				t.includes("openAiCodexOAuthManager") || t.includes("fetchOpenAiCodexRateLimitInfo")) {
				i++
				continue
			}
		}

		output.push(line)
		i++
	}

	const result = output.join("\n").replace(/\n{3,}/g, "\n\n")
	fs.writeFileSync(full, result)
	console.log("Fixed:", relPath)
}

const filesToFix = [
	"src/core/condense/__tests__/condense.spec.ts",
	"src/core/condense/__tests__/foldedFileContext.spec.ts",
	"src/core/condense/__tests__/index.spec.ts",
	"src/core/condense/__tests__/rewind-after-condense.spec.ts",
	"src/core/config/__tests__/importExport.spec.ts",
	"src/core/context-management/__tests__/context-management.spec.ts",
	"src/core/context-management/__tests__/truncation.spec.ts",
	"src/core/task/__tests__/flushPendingToolResultsToHistory.spec.ts",
	"src/core/task/__tests__/grace-retry-errors.spec.ts",
	"src/core/task/__tests__/Task.persistence.spec.ts",
	"src/core/task/__tests__/Task.spec.ts",
	"src/core/task/__tests__/validateToolResultIds.spec.ts",
	"src/core/webview/__tests__/ClineProvider.apiHandlerRebuild.spec.ts",
	"src/core/webview/__tests__/ClineProvider.lockApiConfig.spec.ts",
	"src/core/webview/__tests__/ClineProvider.spec.ts",
	"src/core/webview/__tests__/ClineProvider.sticky-mode.spec.ts",
	"src/core/webview/__tests__/ClineProvider.sticky-profile.spec.ts",
	"src/core/webview/__tests__/ClineProvider.taskHistory.spec.ts",
	"src/core/webview/__tests__/messageEnhancer.test.ts",
	"src/core/webview/__tests__/webviewMessageHandler.spec.ts",
]

for (const f of filesToFix) {
	fixTestFile(f)
}

console.log("\nDone.")