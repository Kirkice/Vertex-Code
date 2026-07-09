#!/usr/bin/env node
/**
 * Targeted fix for webviewMessageHandler.ts and test files.
 * Uses line-by-line processing to avoid destroying structure.
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")

function fixWebviewMessageHandler() {
	const filePath = path.join(ROOT, "src/core/webview/webviewMessageHandler.ts")
	const lines = fs.readFileSync(filePath, "utf8").split("\n")
	const output = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()

		// Skip import lines for deleted packages
		if (
			trimmed.includes('from "@roo-code/cloud"') ||
			trimmed.includes('from "@roo-code/telemetry"') ||
			trimmed.includes('from "../../services/marketplace"') ||
			trimmed.includes('from "../../integrations/openai-codex/oauth"') ||
			trimmed.includes('from "../../integrations/openai-codex/rate-limits"')
		) {
			i++
			continue
		}

		// Remove marketplaceManager parameter from function signature
		if (trimmed === "marketplaceManager?: MarketplaceManager,") {
			i++
			continue
		}

		// Remove isCloudServiceAvailable and showCloudUnavailableMessage helper functions
		if (trimmed === "const isCloudServiceAvailable = () => CloudService.hasInstance()") {
			i++
			continue
		}

		// Remove MessageEnhancer.captureTelemetry line
		if (trimmed.startsWith("MessageEnhancer.captureTelemetry(")) {
			i++
			continue
		}

		// Remove single-line TelemetryService.xxx or CloudService.xxx usages
		// But DON'T remove lines that are part of if-blocks we want to keep
		// We handle the TelemetryService.hasInstance() blocks below

		// Handle: if (TelemetryService.hasInstance()) { ... } blocks
		// Pattern: if (TelemetryService.hasInstance()) {\n  TelemetryService.instance.xxx()\n}
		if (trimmed === "if (TelemetryService.hasInstance()) {") {
			// Collect the block to decide what to do
			const blockLines = [line]
			let j = i + 1
			let depth = 1
			while (j < lines.length && depth > 0) {
				const bl = lines[j].trim()
				if (bl.endsWith("{")) depth++
				if (bl === "}") depth--
				blockLines.push(lines[j])
				j++
			}
			// Skip entire if(TelemetryService) block
			i = j
			continue
		}

		// Remove standalone TelemetryService.instance.xxx() or TelemetryService.hasInstance() lines
		if (
			trimmed.startsWith("TelemetryService.instance.") ||
			trimmed.startsWith("TelemetryService.instance.") ||
			trimmed === "TelemetryService.instance.updateTelemetryState(isOptedIn)" ||
			(trimmed.includes("TelemetryService") && !trimmed.startsWith("//") && !trimmed.startsWith("case "))
		) {
			i++
			continue
		}

		// Remove lines referencing CloudService (but keep case labels)
		if (
			trimmed.startsWith("CloudService.") ||
			trimmed.includes("CloudService.instance.") ||
			trimmed.includes("CloudService.hasInstance")
		) {
			i++
			continue
		}

		// Remove case blocks for deleted features
		const deletedCases = [
			'"cloudLandingPageSignIn"',
			'"rooCloudSignOut"',
			'"openAiCodexSignIn"',
			'"openAiCodexSignOut"',
			'"rooCloudManualUrl"',
			'"clearCloudAuthSkipModel"',
			'"switchOrganization"',
			'"showMdmAuthRequiredNotification"',
			'"requestOpenAiCodexRateLimits"',
		]

		let isDeletedCase = false
		for (const dc of deletedCases) {
			if (trimmed === `case ${dc}: {` || trimmed === `case ${dc}:`) {
				isDeletedCase = true
				break
			}
		}

		if (isDeletedCase) {
			// Skip the entire case block including break
			let depth = 0
			let foundOpen = false
			let j = i
			while (j < lines.length) {
				const bl = lines[j].trim()
				if (bl.includes("{")) {
					foundOpen = true
					depth += (bl.match(/\{/g) || []).length
					depth -= (bl.match(/\}/g) || []).length
				} else if (bl === "break") {
					if (depth <= 0) {
						j++
						break
					}
				}
				j++
				if (foundOpen && depth <= 0 && bl === "}") {
					break
				}
			}
			i = j
			continue
		}

		// Remove lines with openAiCodexOAuthManager or fetchOpenAiCodexRateLimitInfo
		if (
			trimmed.includes("openAiCodexOAuthManager") ||
			trimmed.includes("fetchOpenAiCodexRateLimitInfo")
		) {
			i++
			continue
		}

		// Remove rooCloudSignIn case block (different pattern - no braces around case)
		if (trimmed === 'case "rooCloudSignIn": {') {
			let depth = 1
			let j = i + 1
			while (j < lines.length && depth > 0) {
				const bl = lines[j].trim()
				depth += (bl.match(/\{/g) || []).length
				depth -= (bl.match(/\}/g) || []).length
				j++
			}
			i = j
			continue
		}

		output.push(line)
		i++
	}

	// Clean up consecutive blank lines
	const final = output.join("\n").replace(/\n{3,}/g, "\n\n")
	fs.writeFileSync(filePath, final, "utf8")
	console.log("Fixed: src/core/webview/webviewMessageHandler.ts")
}

fixWebviewMessageHandler()
console.log("Done.")