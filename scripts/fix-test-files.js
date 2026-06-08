#!/usr/bin/env node
/**
 * Smart fix for test files:
 * 1. Remove import lines for deleted packages (import { X } from "@roo-code/telemetry" etc.)
 * 2. Keep vi.mock("@roo-code/telemetry", ...) blocks intact (vitest handles missing modules)
 * 3. Remove standalone usages of TelemetryService/CloudService as values
 * 4. For ClineProvider tests: remove vi.mock("@roo-code/cloud") blocks entirely +
 *    remove getRooCodeApiUrl property from other mocks
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")

function fixTestFile(relPath) {
	const filePath = path.join(ROOT, relPath)
	if (!fs.existsSync(filePath)) {
		console.log(`Skipped (not found): ${relPath}`)
		return
	}

	const original = fs.readFileSync(filePath, "utf8")
	const lines = original.split("\n")
	const output = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()

		// 1. Remove import lines for deleted packages (but NOT vi.mock lines)
		if (
			trimmed.startsWith("import ") &&
			(trimmed.includes('from "@roo-code/telemetry"') ||
				trimmed.includes('from "@roo-code/cloud"') ||
				trimmed.includes("from '../../../integrations/openai-codex/oauth'") ||
				trimmed.includes('from "../../../integrations/openai-codex/oauth"') ||
				trimmed.includes('from "../../../integrations/openai-codex/rate-limits"'))
		) {
			i++
			continue
		}

		// 2. Remove entire vi.mock("@roo-code/cloud", ...) blocks
		if (
			trimmed.startsWith('vi.mock("@roo-code/cloud"') ||
			trimmed.startsWith("vi.mock('@roo-code/cloud'")
		) {
			// Skip to end of this vi.mock block
			if (trimmed.includes("=>") || lines[i + 1]?.trim() === "() => ({") {
				// Multi-line mock - skip until matching ))
				let depth = 0
				let j = i
				while (j < lines.length) {
					const bl = lines[j]
					depth += (bl.match(/\(/g) || []).length
					depth -= (bl.match(/\)/g) || []).length
					j++
					if (depth <= 0) break
				}
				i = j
			} else {
				i++
			}
			continue
		}

		// 3. Remove entire vi.mock("@roo-code/telemetry", ...) blocks
		if (
			trimmed.startsWith('vi.mock("@roo-code/telemetry"') ||
			trimmed.startsWith("vi.mock('@roo-code/telemetry'")
		) {
			// Skip multi-line mock block
			if (trimmed.includes("=>")) {
				let depth = 0
				let j = i
				while (j < lines.length) {
					const bl = lines[j]
					depth += (bl.match(/\(/g) || []).length
					depth -= (bl.match(/\)/g) || []).length
					j++
					if (depth <= 0) break
				}
				i = j
			} else {
				i++
			}
			continue
		}

		// 4. Remove import lines for openai-codex oauth/rate-limits (dynamic or static)
		if (
			trimmed.includes("openai-codex/oauth") ||
			trimmed.includes("openai-codex/rate-limits")
		) {
			i++
			continue
		}

		// 5. Remove standalone TelemetryService usage lines (not inside strings/comments)
		// These are lines like: TelemetryService.xxx(...) or expect(TelemetryService...)
		if (
			!trimmed.startsWith("//") &&
			trimmed.includes("TelemetryService") &&
			!trimmed.startsWith("vi.mock(") &&
			!trimmed.includes('from "@roo-code/telemetry"')
		) {
			// Skip this line - it's a usage, not a mock/import
			i++
			continue
		}

		// 6. Remove standalone CloudService usage lines
		if (
			!trimmed.startsWith("//") &&
			trimmed.includes("CloudService") &&
			!trimmed.startsWith("vi.mock(") &&
			!trimmed.includes('from "@roo-code/cloud"')
		) {
			i++
			continue
		}

		// 7. Remove getRooCodeApiUrl property lines (from cloud service mock leftover)
		if (trimmed.startsWith("getRooCodeApiUrl:") && trimmed.includes("vi.fn()")) {
			// Also remove trailing comma on previous line if needed
			i++
			continue
		}

		// 8. Remove openAiCodexOAuthManager and fetchOpenAiCodexRateLimitInfo usages
		if (
			trimmed.includes("openAiCodexOAuthManager") ||
			trimmed.includes("fetchOpenAiCodexRateLimitInfo")
		) {
			i++
			continue
		}

		output.push(line)
		i++
	}

	// Clean up trailing commas before } caused by line removal
	// e.g.  foo: vi.fn(),\n} -> foo: vi.fn()\n}
	let result = output.join("\n")

	// Remove blank lines between } and )) that result in broken structure
	result = result.replace(/,\n(\s*)\}\)\)/g, "\n$1}))") // ,\n})) -> \n}))

	// Clean up consecutive blank lines
	result = result.replace(/\n{3,}/g, "\n\n")

	if (result !== original) {
		fs.writeFileSync(filePath, result, "utf8")
		console.log(`Fixed: ${relPath}`)
	} else {
		console.log(`No changes: ${relPath}`)
	}
}

// Fix webviewMessageHandler.ts separately using the v2 script approach
function fixWebviewMessageHandler() {
	const filePath = path.join(ROOT, "src/core/webview/webviewMessageHandler.ts")
	const lines = fs.readFileSync(filePath, "utf8").split("\n")
	const output = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()

		// Remove import lines for deleted packages
		if (
			trimmed.startsWith("import ") &&
			(trimmed.includes('from "@roo-code/cloud"') ||
				trimmed.includes('from "@roo-code/telemetry"') ||
				trimmed.includes('from "../../services/marketplace"'))
		) {
			i++
			continue
		}

		// Remove marketplaceManager parameter from function signature
		if (trimmed === "marketplaceManager?: MarketplaceManager,") {
			i++
			continue
		}

		// Remove isCloudServiceAvailable helper (single line)
		if (trimmed === "const isCloudServiceAvailable = () => CloudService.hasInstance()") {
			i++
			continue
		}

		// Remove showCloudUnavailableMessage helper block
		if (trimmed === "const showCloudUnavailableMessage = () => {") {
			// Skip: const showCloudUnavailableMessage = () => {\n  ...\n}
			i++ // skip opening line
			while (i < lines.length && lines[i].trim() !== "}") i++
			i++ // skip closing }
			continue
		}

		// Remove MessageEnhancer.captureTelemetry line
		if (trimmed.startsWith("MessageEnhancer.captureTelemetry(")) {
			i++
			continue
		}

		// Handle if (TelemetryService.hasInstance()) { ... } blocks - remove entire block
		if (trimmed === "if (TelemetryService.hasInstance()) {") {
			let depth = 1
			i++ // skip opening line
			while (i < lines.length && depth > 0) {
				const bl = lines[i].trim()
				depth += (bl.match(/\{/g) || []).length
				depth -= (bl.match(/\}/g) || []).length
				i++
			}
			continue
		}

		// Remove standalone TelemetryService.instance.xxx() lines
		if (
			trimmed.startsWith("TelemetryService.instance.") ||
			trimmed === "TelemetryService.instance.updateTelemetryState(isOptedIn)"
		) {
			i++
			continue
		}

		// Remove other TelemetryService usages (but keep case "telemetrySetting" label)
		if (
			trimmed.includes("TelemetryService") &&
			!trimmed.startsWith("//") &&
			!trimmed.startsWith("case ")
		) {
			i++
			continue
		}

		// Remove CloudService.instance.xxx() or CloudService.hasInstance() lines (but keep case labels)
		if (
			(trimmed.startsWith("CloudService.") ||
				trimmed.includes("CloudService.instance.") ||
				trimmed.includes("CloudService.hasInstance")) &&
			!trimmed.startsWith("case ")
		) {
			i++
			continue
		}

		// Remove case blocks for deleted features
		const deletedCases = [
			"cloudLandingPageSignIn",
			"rooCloudSignIn",
			"rooCloudSignOut",
			"openAiCodexSignIn",
			"openAiCodexSignOut",
			"rooCloudManualUrl",
			"clearCloudAuthSkipModel",
			"switchOrganization",
			"showMdmAuthRequiredNotification",
			"requestOpenAiCodexRateLimits",
		]

		let isDeletedCase = false
		for (const dc of deletedCases) {
			if (trimmed === `case "${dc}": {` || trimmed === `case "${dc}":`) {
				isDeletedCase = true
				break
			}
		}

		if (isDeletedCase) {
			// Skip entire case block
			// Find opening brace if not on same line
			let depth = 0
			let j = i
			// Count braces from current position
			while (j < lines.length) {
				const bl = lines[j].trim()
				depth += (bl.match(/\{/g) || []).length
				depth -= (bl.match(/\}/g) || []).length
				j++
				if (depth > 0) break // found opening brace
			}
			// Now skip until depth reaches 0
			while (j < lines.length && depth > 0) {
				const bl = lines[j].trim()
				depth += (bl.match(/\{/g) || []).length
				depth -= (bl.match(/\}/g) || []).length
				j++
			}
			// Skip optional "break" line after closing brace
			if (j < lines.length && lines[j].trim() === "break") j++
			i = j
			continue
		}

		// Remove openAiCodexOAuthManager or fetchOpenAiCodexRateLimitInfo usages
		if (
			trimmed.includes("openAiCodexOAuthManager") ||
			trimmed.includes("fetchOpenAiCodexRateLimitInfo")
		) {
			i++
			continue
		}

		output.push(line)
		i++
	}

	const result = output.join("\n").replace(/\n{3,}/g, "\n\n")
	fs.writeFileSync(filePath, result, "utf8")
	console.log("Fixed: src/core/webview/webviewMessageHandler.ts")
}

// Run fixes
fixWebviewMessageHandler()

const testFiles = [
	"src/core/assistant-message/__tests__/presentAssistantMessage-custom-tool.spec.ts",
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
	"src/core/assistant-message/presentAssistantMessage.ts",
	"src/core/task/validateToolResultIds.ts",
]

for (const f of testFiles) {
	fixTestFile(f)
}

console.log("\nDone.")