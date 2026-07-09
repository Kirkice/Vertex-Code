#!/usr/bin/env node
/**
 * Precise telemetry/cloud/marketplace/openai-codex cleanup script.
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")

function readFile(filePath) {
	return fs.readFileSync(filePath, "utf8")
}

function writeFile(filePath, content) {
	fs.writeFileSync(filePath, content, "utf8")
}

function removeImportLine(content, importPath) {
	const lines = content.split("\n")
	const filtered = lines.filter((line) => {
		const trimmed = line.trim()
		if (!trimmed.startsWith("import ")) return true
		if (trimmed.includes(`"${importPath}"`) || trimmed.includes(`'${importPath}'`)) return false
		return true
	})
	return filtered.join("\n")
}

function removeLineContaining(content, pattern) {
	return content
		.split("\n")
		.filter((line) => !line.includes(pattern))
		.join("\n")
}

function cleanupBlankLines(content) {
	return content.replace(/\n{3,}/g, "\n\n")
}

function fixFile(filePath, transforms) {
	if (!fs.existsSync(filePath)) {
		console.log(`Skipped (not found): ${path.relative(ROOT, filePath)}`)
		return
	}
	let content = readFile(filePath)
	const original = content
	for (const fn of transforms) {
		content = fn(content)
	}
	content = cleanupBlankLines(content)
	if (content !== original) {
		writeFile(filePath, content)
		console.log(`Fixed: ${path.relative(ROOT, filePath)}`)
	} else {
		console.log(`No changes: ${path.relative(ROOT, filePath)}`)
	}
}

// Standard telemetry transforms for code-index files
function telemetryTransforms(content) {
	// Remove import
	content = removeImportLine(content, "@roo-code/telemetry")
	// Remove private telemetry/telemetryService field declaration
	content = content.replace(/\n[ \t]*private\s+telemetry(?:Service)?\s*:\s*TelemetryService[^\n]*\n/g, "\n")
	// Remove constructor param: , telemetry?: TelemetryService  or  telemetry: TelemetryService
	content = content.replace(/,?\s*telemetry(?:Service)?\??\s*:\s*TelemetryService(?:\s*=\s*[^,)\n]+)?/g, "")
	// Remove this.telemetry = ... assignment lines
	content = content.replace(/\n[ \t]*this\.telemetry(?:Service)?\s*=\s*[^\n]+\n/g, "\n")
	// Remove this.telemetry.xxx(...) call lines (possibly multiline but common single-line form)
	content = content.replace(/\n[ \t]*this\.telemetry(?:Service)?\.[\w]+\([^\n]*\)\n/g, "\n")
	// Remove const telemetryXxx = ... lines
	content = content.replace(/\n[ \t]*const\s+telemetry[A-Za-z]+\s*=\s*[^\n]+\n/g, "\n")
	// Remove try { this.telemetry... } catch(...) {} blocks
	content = content.replace(
		/\n[ \t]*try\s*\{\s*\n[ \t]*this\.telemetry(?:Service)?\.[\w]+\([^\n]*\)\n[ \t]*\}\s*catch\s*\([^)]*\)\s*\{\s*\}\n/g,
		"\n",
	)
	// Remove telemetry passed as trailing argument: , this.telemetry
	content = content.replace(/,\s*this\.telemetry(?:Service)?\b/g, "")
	// Remove telemetry as leading argument: this.telemetry,
	content = content.replace(/\bthis\.telemetry(?:Service)?\s*,\s*/g, "")
	return content
}

// Transforms for test files
function testTelemetryTransforms(content) {
	content = removeImportLine(content, "@roo-code/telemetry")
	content = removeImportLine(content, "@roo-code/cloud")
	content = content.replace(/\n[^\n]*TelemetryService[^\n]*\n/g, "\n")
	content = content.replace(/\n[^\n]*CloudService[^\n]*\n/g, "\n")
	content = content.replace(/\n[^\n]*openAiCodexOAuthManager[^\n]*\n/g, "\n")
	content = content.replace(/\n[^\n]*fetchOpenAiCodexRateLimitInfo[^\n]*\n/g, "\n")
	return content
}

// ---- code-index source files ----
const codeIndexFiles = [
	"src/services/code-index/cache-manager.ts",
	"src/services/code-index/orchestrator.ts",
	"src/services/code-index/service-factory.ts",
	"src/services/code-index/embedders/bedrock.ts",
	"src/services/code-index/embedders/gemini.ts",
	"src/services/code-index/embedders/mistral.ts",
	"src/services/code-index/embedders/ollama.ts",
	"src/services/code-index/embedders/openai-compatible.ts",
	"src/services/code-index/embedders/openai.ts",
	"src/services/code-index/embedders/openrouter.ts",
	"src/services/code-index/embedders/vercel-ai-gateway.ts",
	"src/services/code-index/processors/file-watcher.ts",
	"src/services/code-index/processors/parser.ts",
	"src/services/code-index/processors/scanner.ts",
]

for (const f of codeIndexFiles) {
	fixFile(path.join(ROOT, f), [telemetryTransforms])
}

// ---- presentAssistantMessage.ts ----
fixFile(path.join(ROOT, "src/core/assistant-message/presentAssistantMessage.ts"), [
	(c) => removeImportLine(c, "@roo-code/telemetry"),
	(c) => c.replace(/\n[^\n]*TelemetryService[^\n]*\n/g, "\n"),
])

// ---- validateToolResultIds.ts ----
fixFile(path.join(ROOT, "src/core/task/validateToolResultIds.ts"), [
	(c) => removeImportLine(c, "@roo-code/telemetry"),
	(c) => c.replace(/\n[^\n]*TelemetryService[^\n]*\n/g, "\n"),
])

// ---- webviewMessageHandler.ts ----
fixFile(path.join(ROOT, "src/core/webview/webviewMessageHandler.ts"), [
	(c) => removeImportLine(c, "@roo-code/cloud"),
	(c) => removeImportLine(c, "@roo-code/telemetry"),
	(c) => removeImportLine(c, "../../services/marketplace"),
	(c) => removeLineContaining(c, "MessageEnhancer.captureTelemetry"),
	(c) => removeLineContaining(c, "MarketplaceManager"),
	(c) => removeLineContaining(c, "MarketplaceItemType"),
	(c) => c.replace(/\n[^\n]*CloudService[^\n]*\n/g, "\n"),
	(c) => c.replace(/\n[^\n]*TelemetryService[^\n]*\n/g, "\n"),
	(c) =>
		c.replace(
			/\n[ \t]*const\s*\{[^}]*openAiCodexOAuthManager[^}]*\}\s*=\s*await\s*import\([^)]*openai-codex\/oauth[^)]*\)[^\n]*\n/g,
			"\n",
		),
	(c) =>
		c.replace(
			/\n[ \t]*const\s*\{[^}]*fetchOpenAiCodexRateLimitInfo[^}]*\}\s*=\s*await\s*import\([^)]*openai-codex\/rate-limits[^)]*\)[^\n]*\n/g,
			"\n",
		),
	(c) => c.replace(/\n[^\n]*openAiCodexOAuthManager[^\n]*\n/g, "\n"),
	(c) => c.replace(/\n[^\n]*fetchOpenAiCodexRateLimitInfo[^\n]*\n/g, "\n"),
	(c) => c.replace(/\n[^\n]*fetchMarketplaceData\(\)[^\n]*\n/g, "\n"),
])

// ---- openai-codex.ts ----
fixFile(path.join(ROOT, "src/api/providers/openai-codex.ts"), [
	(c) => c.replace(/\n[^\n]*openai-codex\/oauth[^\n]*\n/g, "\n"),
	(c) => c.replace(/\n[^\n]*openAiCodexOAuthManager[^\n]*\n/g, "\n"),
])

// ---- test files ----
const testFiles = [
	"src/api/providers/__tests__/openai-codex-native-tool-calls.spec.ts",
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
]

for (const f of testFiles) {
	fixFile(path.join(ROOT, f), [testTelemetryTransforms])
}

console.log("\nDone.")