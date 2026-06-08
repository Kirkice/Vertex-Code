#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const f = path.join(__dirname, "../src/core/webview/__tests__/ClineProvider.spec.ts")
let c = fs.readFileSync(f, "utf8")

// Fix pattern: "} as unknown as vscode.WebviewView\n\n\t\t}\n\n\t\tprovider = "
// The orphaned "}" is left from a removed CloudService mock spy block
c = c.replace(/(\} as unknown as vscode\.WebviewView)\n\n\t\t\}\n\n(\t\tprovider = )/g, "$1\n\n$2")

// Fix same pattern with different indent
c = c.replace(/(\} as unknown as vscode\.WebviewView)\n\n\t\t\}\n\n(\t\t\tprovider = )/g, "$1\n\n$2")

// Also fix the "vi.clearAllMocks()\n\n\t\t}" pattern in beforeEach
c = c.replace(/(vi\.clearAllMocks\(\))\n\n\t\t\}\n\n(\t\tconst globalState)/g, "$1\n\n\t\t$2")

c = c.replace(/\n{3,}/g, "\n\n")
fs.writeFileSync(f, c)
console.log("Fixed ClineProvider.spec.ts")