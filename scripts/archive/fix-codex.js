#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const f = path.join(__dirname, "../src/api/providers/openai-codex.ts")
let c = fs.readFileSync(f, "utf8")

// Remove TelemetryService import line
c = c.split("\n").filter(l => !l.includes('"@roo-code/telemetry"')).join("\n")

// Remove TelemetryService.instance.captureException(...) lines (may be multiline)
// Pattern: const ... = new ApiProviderError(...)\nTelemetryService.instance.captureException(apiError)
c = c.replace(/\n\s*const \w+ = new ApiProviderError\([^)]+\)\n\s*TelemetryService\.instance\.captureException\(\w+\)/g, "")

// Also remove any standalone TelemetryService lines
c = c.split("\n").filter(l => {
  const t = l.trim()
  if (t.startsWith("//")) return true
  if (t.includes("TelemetryService")) return false
  return true
}).join("\n")

c = c.replace(/\n{3,}/g, "\n\n")
fs.writeFileSync(f, c)
console.log("Fixed openai-codex.ts")