#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const ROOT = path.resolve(__dirname, "..")

// Fix openai-codex.ts: remove openAiCodexOAuthManager calls surgically
// keeping variable declarations and surrounding code intact
function fixOpenAiCodex() {
	const f = path.join(ROOT, "src/api/providers/openai-codex.ts")
	const lines = fs.readFileSync(f, "utf8").split("\n")
	const out = []
	let i = 0
	while (i < lines.length) {
		const t = lines[i].trim()
		// Remove: const { openAiCodexOAuthManager } = await import(...) lines
		if (t.includes("openAiCodexOAuthManager") && t.includes("await import")) {
			i++
			continue
		}
		// Replace: let accessToken = await openAiCodexOAuthManager.getAccessToken()
		// with: let accessToken: string | null = null
		if (t.includes("accessToken") && t.includes("openAiCodexOAuthManager.getAccessToken")) {
			const indent = lines[i].match(/^(\s*)/)[1]
			const isLet = t.startsWith("let ")
			const isConst = t.startsWith("const ")
			if (isLet || isConst) {
				out.push(indent + "let accessToken: string | null = null")
			}
			i++
			continue
		}
		// Replace: const accountId = await openAiCodexOAuthManager.getAccountId()
		// with: const accountId: string | null = null
		if (t.includes("accountId") && t.includes("openAiCodexOAuthManager.getAccountId")) {
			const indent = lines[i].match(/^(\s*)/)[1]
			out.push(indent + "const accountId: string | null = null")
			i++
			continue
		}
		// Replace: const refreshed = await openAiCodexOAuthManager.forceRefreshAccessToken()
		// with: const refreshed: string | null = null
		if (t.includes("refreshed") && t.includes("openAiCodexOAuthManager")) {
			const indent = lines[i].match(/^(\s*)/)[1]
			out.push(indent + "const refreshed: string | null = null")
			i++
			continue
		}
		// Remove remaining openAiCodexOAuthManager lines
		if (t.includes("openAiCodexOAuthManager") && !t.startsWith("//")) {
			i++
			continue
		}
		out.push(lines[i])
		i++
	}
	fs.writeFileSync(f, out.join("\n").replace(/\n{3,}/g, "\n\n"))
	console.log("Fixed: src/api/providers/openai-codex.ts")
}

// Fix ClineProvider.spec.ts: remove the mdmService argument from ClineProvider constructor call
function fixClineProviderSpec() {
	const f = path.join(ROOT, "src/core/webview/__tests__/ClineProvider.spec.ts")
	let c = fs.readFileSync(f, "utf8")
	// The error is: new ClineProvider(..., mdmService) at line 614
	// Replace 5-argument constructor calls that have mdmService as the 5th arg
	c = c.replace(/new ClineProvider\(\s*mockContext,\s*mockOutputChannel,\s*"sidebar",\s*new ContextProxy\(mockContext\),\s*mdmService,?\s*\)/g,
		"new ClineProvider(mockContext, mockOutputChannel, \"sidebar\", new ContextProxy(mockContext), mdmService)")
	// Actually the error says "Expected 4 arguments, but got 5" - meaning the constructor no longer accepts mdmService
	// So we need to remove the 5th argument
	c = c.replace(/new ClineProvider\(\s*mockContext,\s*mockOutputChannel,\s*"sidebar",\s*new ContextProxy\(mockContext\),\s*mdmService\s*\)/g,
		"new ClineProvider(mockContext, mockOutputChannel, \"sidebar\", new ContextProxy(mockContext))")
	fs.writeFileSync(f, c)
	console.log("Fixed: src/core/webview/__tests__/ClineProvider.spec.ts")
}

// Fix webviewMessageHandler.spec.ts: remove the requestOpenAiCodexRateLimits test block
// which references mockGetAccessToken, mockGetAccountId, mockFetchOpenAiCodexRateLimitInfo
function fixWebviewHandlerSpec() {
	const f = path.join(ROOT, "src/core/webview/__tests__/webviewMessageHandler.spec.ts")
	let c = fs.readFileSync(f, "utf8")
	// Remove the describe("webviewMessageHandler - requestOpenAiCodexRateLimits", ...) block
	const startMarker = 'describe("webviewMessageHandler - requestOpenAiCodexRateLimits",'
	const si = c.indexOf(startMarker)
	if (si !== -1) {
		let depth = 0
		let j = si
		while (j < c.length) {
			if (c[j] === "(") depth++
			if (c[j] === ")") { depth--; if (depth === 0) { j++; break } }
			j++
		}
		if (j < c.length && c[j] === "\n") j++
		c = c.slice(0, si) + c.slice(j)
		console.log("  Removed requestOpenAiCodexRateLimits describe block")
	}
	// Remove mock variable declarations for openai codex mocks
	c = c.split("\n").filter(l => {
		const t = l.trim()
		if (t.includes("mockGetAccessToken") || t.includes("mockGetAccountId") || t.includes("mockFetchOpenAiCodexRateLimitInfo")) return false
		return true
	}).join("\n")
	c = c.replace(/\n{3,}/g, "\n\n")
	fs.writeFileSync(f, c)
	console.log("Fixed: src/core/webview/__tests__/webviewMessageHandler.spec.ts")
}

fixOpenAiCodex()
fixClineProviderSpec()
fixWebviewHandlerSpec()
console.log("\nDone.")