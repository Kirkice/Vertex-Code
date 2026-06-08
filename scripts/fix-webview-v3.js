#!/usr/bin/env node
/**
 * Comprehensive fix for webviewMessageHandler.ts
 * Uses targeted string replacement for each specific pattern.
 */

const fs = require("fs")
const path = require("path")
const ROOT = path.resolve(__dirname, "..")
const FILE = path.join(ROOT, "src/core/webview/webviewMessageHandler.ts")

let content = fs.readFileSync(FILE, "utf8")

// Helper: remove a specific import line
function removeImport(c, fragment) {
	const lines = c.split("\n")
	return lines.filter(l => !l.trim().startsWith("import ") || !l.includes(fragment)).join("\n")
}

// Helper: remove lines containing a specific string (not in comments)
function removeLinesWith(c, str) {
	return c.split("\n").filter(l => !l.includes(str)).join("\n")
}

// Helper: remove a block from startStr to endStr (inclusive)
function removeBlock(c, startStr, endStr) {
	const si = c.indexOf(startStr)
	if (si === -1) return c
	const ei = c.indexOf(endStr, si)
	if (ei === -1) return c
	return c.slice(0, si) + c.slice(ei + endStr.length)
}

// 1. Remove CloudService and TelemetryService imports
content = removeImport(content, "CloudService")
content = removeImport(content, "TelemetryService")

// 2. Remove MarketplaceManager and MarketplaceItemType imports (marketplace was deleted)
content = removeImport(content, "MarketplaceManager")
content = removeImport(content, "MarketplaceItemType")
content = removeImport(content, "createMarketplaceItem")

// 3. Remove marketplaceManager parameter from function signature
// Pattern: "	marketplaceManager?: MarketplaceManager,\n"
content = content.replace(/\n\s*marketplaceManager\?\s*:\s*MarketplaceManager[^\n]*\n/, "\n")

// 4. Remove isCloudServiceAvailable helper function (single line arrow function)
content = content.replace(/\n[^\n]*const isCloudServiceAvailable[^\n]*\n/, "\n")

// 5. Remove showCloudUnavailableMessage helper block
content = content.replace(
  /\n\s*const showCloudUnavailableMessage\s*=\s*\(\)\s*=>\s*\{\s*\n[^\n]*\n\s*\}\n/,
  "\n"
)

// 6. Remove TelemetryService.instance.updateTelemetryState call (in webviewDidLaunch .then block)
// The block is:
//   provider.getStateToPostToWebview().then((state) => {
//     const { telemetrySetting } = state
//     const isOptedIn = telemetrySetting !== "disabled"
//     TelemetryService.instance.updateTelemetryState(isOptedIn)
//   })
content = content.replace(
  /\n\s*\/\/ Enable telemetry by default \(when unset\) or when explicitly enabled\s*\n\s*provider\.getStateToPostToWebview\(\)\.then\([^)]+\)\s*=>\s*\{[^}]+\}\)\n/,
  "\n"
)

// 7. Fix updatePrompt case: remove the if (TelemetryService.hasInstance()) { ... } block
// Pattern after "provider.postMessageToWebview({ type: "state", state: stateWithPrompts })"
content = content.replace(
  /(provider\.postMessageToWebview\(\{ type: "state", state: stateWithPrompts \}\))\s*\n\s*\n\s*if \(TelemetryService\.hasInstance\(\)\) \{[\s\S]*?\}\s*\}\s*\}\s*\n\s*break\s*\n\s*case "deleteMessage"/,
  '$1\n\t\t}\n\t\tbreak\n\t\tcase "deleteMessage"'
)

// 8. Fix updateCustomMode case: remove the TelemetryService.hasInstance() block
// Find the block:
// "// Track telemetry for custom mode creation or update"
// "if (TelemetryService.hasInstance()) {" ... "}"
content = content.replace(
  /\n\s*\/\/ Track telemetry for custom mode creation or update\s*\n\s*if \(TelemetryService\.hasInstance\(\)\) \{[\s\S]*?\n\s*\}\s*\n(\s*\} catch)/,
  "\n$1"
)

// 9. Fix switchTab case: remove TelemetryService.hasInstance() block
content = content.replace(
  /\n\s*\/\/ Capture tab shown event[^\n]*\n\s*if \(TelemetryService\.hasInstance\(\)\) \{[\s\S]*?\n\s*\}\s*\n(\s*await provider\.postMessageToWebview\(\{)/,
  "\n$1"
)

// 10. Fix telemetrySetting case: remove all TelemetryService calls
// Remove: if (wasPreviouslyOptedIn && !isOptedIn && TelemetryService.hasInstance()) { ... }
// Remove: if (TelemetryService.hasInstance()) { ... }  
// Remove: if (!wasPreviouslyOptedIn && isOptedIn && TelemetryService.hasInstance()) { ... }
content = content.replace(
  /\n\s*\/\/ If turning telemetry OFF[^\n]*\n\s*if \(wasPreviouslyOptedIn && !isOptedIn && TelemetryService\.hasInstance\(\)\) \{[\s\S]*?\}\s*\n(\s*\/\/ Update the telemetry state)/,
  "\n$1"
)
content = content.replace(
  /\n\s*if \(TelemetryService\.hasInstance\(\)\) \{\s*\n\s*TelemetryService\.instance\.updateTelemetryState\(isOptedIn\)\s*\n\s*\}\s*\n(\s*\/\/ If turning telemetry ON)/,
  "\n$1"
)
content = content.replace(
  /\n\s*\/\/ If turning telemetry ON[^\n]*\n\s*if \(!wasPreviouslyOptedIn && isOptedIn && TelemetryService\.hasInstance\(\)\) \{[\s\S]*?\}\s*\n(\s*await provider\.postStateToWebview\(\))/,
  "\n$1"
)

// 11. Fix rooCloudSignIn case: replace body with simple break
content = content.replace(
  /case "rooCloudSignIn": \{[\s\S]*?\n\s*\}\s*\n\s*case "cloudLandingPageSignIn"/,
  'case "rooCloudSignIn": {\n\t\t\t// Cloud sign-in removed\n\t\t\tbreak\n\t\t}\n\t\tcase "cloudLandingPageSignIn"'
)

// 12. Fix cloudLandingPageSignIn case
content = content.replace(
  /case "cloudLandingPageSignIn": \{[\s\S]*?\n\s*\}\s*\n\s*case "rooCloudSignOut"/,
  'case "cloudLandingPageSignIn": {\n\t\t\t// Cloud sign-in removed\n\t\t\tbreak\n\t\t}\n\t\tcase "rooCloudSignOut"'
)

// 13. Fix rooCloudSignOut case
content = content.replace(
  /case "rooCloudSignOut": \{[\s\S]*?\n\s*\}\s*\n\s*case "openAiCodexSignIn"/,
  'case "rooCloudSignOut": {\n\t\t\t// Cloud sign-out removed\n\t\t\tbreak\n\t\t}\n\t\tcase "openAiCodexSignIn"'
)

// 14. Fix openAiCodexSignIn case
content = content.replace(
  /case "openAiCodexSignIn": \{[\s\S]*?\n\s*\}\s*\n\s*case "openAiCodexSignOut"/,
  'case "openAiCodexSignIn": {\n\t\t\t// OpenAI Codex sign-in removed\n\t\t\tbreak\n\t\t}\n\t\tcase "openAiCodexSignOut"'
)

// 15. Fix openAiCodexSignOut case
content = content.replace(
  /case "openAiCodexSignOut": \{[\s\S]*?\n\s*\}\s*\n\s*case "rooCloudManualUrl"/,
  'case "openAiCodexSignOut": {\n\t\t\t// OpenAI Codex sign-out removed\n\t\t\tbreak\n\t\t}\n\t\tcase "rooCloudManualUrl"'
)

// 16. Fix rooCloudManualUrl case
content = content.replace(
  /case "rooCloudManualUrl": \{[\s\S]*?\n\s*\}\s*\n\s*case "clearCloudAuthSkipModel"/,
  'case "rooCloudManualUrl": {\n\t\t\t// Cloud manual URL removed\n\t\t\tbreak\n\t\t}\n\t\tcase "clearCloudAuthSkipModel"'
)

// 17. Fix clearCloudAuthSkipModel case
content = content.replace(
  /case "clearCloudAuthSkipModel": \{[\s\S]*?\n\s*\}\s*\n\s*case "vertexSignOut"/,
  'case "clearCloudAuthSkipModel": {\n\t\t\tawait provider.context.globalState.update("roo-auth-skip-model", undefined)\n\t\t\tawait provider.postStateToWebview()\n\t\t\tbreak\n\t\t}\n\t\tcase "vertexSignOut"'
)

// 18. Fix switchOrganization case
content = content.replace(
  /case "switchOrganization": \{[\s\S]*?\n\s*\}\s*\n\s*case "saveCodeIndexSettingsAtomic"/,
  'case "switchOrganization": {\n\t\t\t// Organization switching removed\n\t\t\tbreak\n\t\t}\n\t\tcase "saveCodeIndexSettingsAtomic"'
)

// 19. Fix requestOpenAiCodexRateLimits case
content = content.replace(
  /case "requestOpenAiCodexRateLimits": \{[\s\S]*?\n\s*\}\s*\n\s*case "openDebugApiHistory"/,
  'case "requestOpenAiCodexRateLimits": {\n\t\t\tprovider.postMessageToWebview({ type: "openAiCodexRateLimits", error: "OpenAI Codex removed" })\n\t\t\tbreak\n\t\t}\n\t\tcase "openDebugApiHistory"'
)

// 20. Remove any remaining TelemetryService or CloudService lines
content = content.split("\n").filter(l => {
  const t = l.trim()
  if (t.startsWith("//")) return true
  if (t.includes("TelemetryService") || t.includes("CloudService")) return false
  return true
}).join("\n")

// 21. Clean up extra blank lines
content = content.replace(/\n{3,}/g, "\n\n")

fs.writeFileSync(FILE, content, "utf8")
console.log("Fixed: src/core/webview/webviewMessageHandler.ts")
console.log("Done.")