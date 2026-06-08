#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const f = path.join(__dirname, "../src/core/webview/__tests__/ClineProvider.spec.ts")
const lines = fs.readFileSync(f, "utf8").split("\n")
const out = []
let i = 0
while (i < lines.length) {
	const line = lines[i]
	const trimmed = line.trim()
	// Remove orphaned lone "}" lines that come right after "} as unknown as vscode.WebviewView"
	// or right after "vi.clearAllMocks()" in beforeEach blocks
	if (trimmed === "}" && i > 0) {
		const prev = lines[i - 1].trim()
		const next = i + 1 < lines.length ? lines[i + 1].trim() : ""
		// Orphaned } after WebviewView cast or clearAllMocks, before provider= or const
		if (
			(prev === "" && (
				(i >= 2 && lines[i - 2].trim().endsWith("} as unknown as vscode.WebviewView")) ||
				(i >= 2 && lines[i - 2].trim() === "vi.clearAllMocks()")
			)) ||
			(prev.endsWith("} as unknown as vscode.WebviewView") && (next.startsWith("provider") || next.startsWith("const"))) ||
			(prev === "vi.clearAllMocks()" && next.startsWith("const"))
		) {
			i++ // skip orphaned }
			continue
		}
	}
	out.push(line)
	i++
}
const result = out.join("\n").replace(/\n{3,}/g, "\n\n")
fs.writeFileSync(f, result)
console.log("Fixed ClineProvider.spec.ts")