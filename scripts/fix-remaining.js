#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const ROOT = path.resolve(__dirname, "..")

function fix(relPath, transforms) {
	const f = path.join(ROOT, relPath)
	if (!fs.existsSync(f)) { console.log("Not found:", relPath); return }
	let c = fs.readFileSync(f, "utf8")
	const orig = c
	for (const t of transforms) c = t(c)
	c = c.replace(/\n{3,}/g, "\n\n")
	if (c !== orig) { fs.writeFileSync(f, c); console.log("Fixed:", relPath) }
	else console.log("No change:", relPath)
}

// 1. Fix webviewMessageHandler.ts
fix("src/core/webview/webviewMessageHandler.ts", [
	// Remove MessageEnhancer.captureTelemetry line
	c => c.split("\n").filter(l => !l.includes("MessageEnhancer.captureTelemetry")).join("\n"),
	// Replace marketplace case bodies with just break
	c => {
		const cases = ["filterMarketplaceItems", "fetchMarketplaceData", "installMarketplaceItem",
			"removeInstalledMarketplaceItem", "installMarketplaceItemWithParameters"]
		for (const name of cases) {
			const start = `case "${name}": {`
			const si = c.indexOf(start)
			if (si === -1) continue
			// Find the matching closing }
			let depth = 0
			let j = si
			while (j < c.length) {
				if (c[j] === "{") depth++
				if (c[j] === "}") { depth--; if (depth === 0) { j++; break } }
				j++
			}
			c = c.slice(0, si) + `case "${name}": {\n\t\t\tbreak\n\t\t}` + c.slice(j)
		}
		return c
	},
])

// 2. Fix openai-codex.ts - restore from git first then just remove oauth references
fix("src/api/providers/openai-codex.ts", [
	c => c.split("\n").filter(l => !l.includes("openAiCodexOAuthManager")).join("\n"),
])

// 3. Fix test files - remove remaining TelemetryService/CloudService usages
const testFiles = [
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
	"src/core/webview/__tests__/telemetrySettingsTracking.spec.ts",
	"src/core/webview/__tests__/webviewMessageHandler.cloudAuth.spec.ts",
	"src/core/webview/__tests__/webviewMessageHandler.spec.ts",
	"src/api/providers/__tests__/openai-codex-native-tool-calls.spec.ts",
]

for (const f of testFiles) {
	fix(f, [
		// Remove lines with TelemetryService or CloudService (but not in comments)
		c => c.split("\n").filter(l => {
			const t = l.trim()
			if (t.startsWith("//") || t.startsWith("*")) return true
			if (t.includes("TelemetryService") || t.includes("CloudService")) return false
			if (t.includes("openAiCodexOAuthManager") || t.includes("fetchOpenAiCodexRateLimitInfo")) return false
			return true
		}).join("\n"),
		// Remove openai-codex dynamic import lines
		c => c.split("\n").filter(l => {
			if (l.includes("integrations/openai-codex/oauth") || l.includes("integrations/openai-codex/rate-limits")) return false
			return true
		}).join("\n"),
	])
}

console.log("\nDone.")