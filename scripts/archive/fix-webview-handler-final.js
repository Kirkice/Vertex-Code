const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'src', 'core', 'webview', 'webviewMessageHandler.ts')
let content = fs.readFileSync(filePath, 'utf8')
const lines = content.split('\n')

// 1. Remove marketplaceManager parameter (line 94)
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('marketplaceManager?: MarketplaceManager,')) {
		lines[i] = lines[i].replace('marketplaceManager?: MarketplaceManager,', '')
		break
	}
}

// 2. Remove CloudService references (isCloudServiceAvailable, showCloudUnavailableMessage)
// Find and remove the isCloudServiceAvailable function
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('const isCloudServiceAvailable = () => CloudService.hasInstance()')) {
		lines[i] = '' // Remove this line
		break
	}
}
// Find and remove showCloudUnavailableMessage
let startIdx = -1
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('const showCloudUnavailableMessage = () => {')) {
		startIdx = i
		break
	}
}
if (startIdx !== -1) {
	// Remove 3 lines: function declaration, body, closing brace
	for (let i = startIdx; i < startIdx + 3; i++) {
		lines[i] = ''
	}
}

// 3. Fix broken .then() callback for telemetry (was lines 614-618)
// Pattern: provider.getStateToPostToWebview().then((state) => { const { telemetrySetting } = state ... })
// Remove entire broken .then() block
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('// Enable telemetry by default')) {
		// Remove from this comment through the broken .then() block
		let j = i
		while (j < lines.length && !lines[j].includes('provider.isViewLaunched = true')) {
			lines[j] = ''
			j++
		}
		break
	}
}

// 4. Fix broken try-catch blocks for cloud sign-in/out
// rooCloudSignIn - remove isCloudServiceAvailable check and showCloudUnavailableMessage
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "rooCloudSignIn":')) {
		// Find the break for this case
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].trim() === 'break' || lines[j].trim() === 'break}') {
				caseEnd = j
				break
			}
		}
		if (caseEnd !== -1) {
			// Replace entire case block with simple message
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "rooCloudSignIn": {'
			lines[i + 1] = '			vscode.window.showWarningMessage("Cloud sign-in is no longer available.")'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 5. Fix rooCloudSignOut - broken structure
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "rooCloudSignOut":')) {
		// Find next case or default to know end
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			// Replace entire case block
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "rooCloudSignOut": {'
			lines[i + 1] = '			await provider.postStateToWebview()'
			lines[i + 2] = '			provider.postMessageToWebview({ type: "authenticatedUser", userInfo: undefined })'
			lines[i + 3] = '			break'
			lines[i + 4] = '		}'
		}
		break
	}
}

// 6. Fix openAiCodexSignIn - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "openAiCodexSignIn":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "openAiCodexSignIn": {'
			lines[i + 1] = '			vscode.window.showWarningMessage("OpenAI Codex sign-in is no longer available.")'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 7. Fix openAiCodexSignOut - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "openAiCodexSignOut":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "openAiCodexSignOut": {'
			lines[i + 1] = '			vscode.window.showWarningMessage("OpenAI Codex sign-out is no longer available.")'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 8. Fix rooCloudManualUrl - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "rooCloudManualUrl":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "rooCloudManualUrl": {'
			lines[i + 1] = '			vscode.window.showWarningMessage("Cloud manual URL is no longer available.")'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 9. Fix switchOrganization - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "switchOrganization":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "switchOrganization": {'
			lines[i + 1] = '			vscode.window.showWarningMessage("Organization switching is no longer available.")'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 10. Fix requestOpenAiCodexRateLimits - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "requestOpenAiCodexRateLimits":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "requestOpenAiCodexRateLimits": {'
			lines[i + 1] = '			provider.postMessageToWebview({'
			lines[i + 2] = '				type: "openAiCodexRateLimits",'
			lines[i + 3] = '				error: "OpenAI Codex is no longer available",'
			lines[i + 4] = '			})'
			lines[i + 5] = '			break'
			lines[i + 6] = '		}'
		}
		break
	}
}

// 11. Fix filterMarketplaceItems - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "filterMarketplaceItems":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "filterMarketplaceItems": {'
			lines[i + 1] = '			// Marketplace module removed'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 12. Fix installMarketplaceItem - has orphaned code after break
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "installMarketplaceItem":') && lines[i].includes('Marketplace module removed')) {
		// Find where the orphaned code starts (after the break)
		let breakLine = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].trim() === 'break' || lines[j].trim().startsWith('break')) {
				breakLine = j
				break
			}
		}
		if (breakLine !== -1) {
			// Find next case to know where orphaned code ends
			let nextCase = -1
			for (let j = breakLine + 1; j < lines.length; j++) {
				if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
					nextCase = j
					break
				}
			}
			if (nextCase !== -1) {
				// Remove orphaned code between break and next case
				for (let j = breakLine + 1; j < nextCase; j++) {
					lines[j] = ''
				}
			}
		}
		break
	}
}

// 13. Fix removeInstalledMarketplaceItem - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "removeInstalledMarketplaceItem":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "removeInstalledMarketplaceItem": {'
			lines[i + 1] = '			// Marketplace module removed'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 14. Fix installMarketplaceItemWithParameters - replace with stub
for (let i = 0; i < lines.length; i++) {
	if (lines[i].includes('case "installMarketplaceItemWithParameters":')) {
		let caseEnd = -1
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].match(/^\s*case "/) || lines[j].match(/^\s*default:/)) {
				caseEnd = j - 1
				break
			}
		}
		if (caseEnd !== -1) {
			for (let j = i; j <= caseEnd; j++) {
				lines[j] = ''
			}
			lines[i] = '		case "installMarketplaceItemWithParameters": {'
			lines[i + 1] = '			// Marketplace module removed'
			lines[i + 2] = '			break'
			lines[i + 3] = '		}'
		}
		break
	}
}

// 15. Remove TelemetryService.hasInstance() blocks - these are orphaned
// Pattern: if (TelemetryService.hasInstance()) { ... empty ... }
content = lines.join('\n')

// Remove orphaned TelemetryService blocks in updatePrompt case
content = content.replace(
	/if \(TelemetryService\.hasInstance\(\)\)\ {\s*\/\/ Determine which setting was changed[\s\S]*?if \(changedSettings\.length > 0\) {\s*}\s*}\s*}/,
	''
)

// Remove orphaned TelemetryService blocks in updateCustomMode case
content = content.replace(
	/\/\/ Track telemetry for custom mode creation or update\s*if \(TelemetryService\.hasInstance\(\)\)\ {\s*if \(isNewMode\) {\s*\/\/ This is a new custom mode\s*} else {\s*\/\/ Determine which setting was changed[\s\S]*?if \(changedSettings\.length > 0\) {\s*}\s*}\s*}\s*}/,
	''
)

// Fix telemetrySetting case - remove all TelemetryService.hasInstance() blocks
content = content.replace(
	/case "telemetrySetting": {\s*const telemetrySetting = message\.text as TelemetrySetting\s*const previousSetting = getGlobalState\("telemetrySetting"\) || "unset"\s*const isOptedIn = telemetrySetting !== "disabled"\s*const wasPreviouslyOptedIn = previousSetting !== "disabled"\s*\/\/ If turning telemetry OFF, fire event BEFORE disabling\s*if \(wasPreviouslyOptedIn && !isOptedIn && TelemetryService\.hasInstance\(\)\)\ {\s*}\s*\/\/ Update the telemetry state\s*await updateGlobalState\("telemetrySetting", telemetrySetting\)\s*if \(TelemetryService\.hasInstance\(\)\)\ {\s*}\s*\/\/ If turning telemetry ON, fire event AFTER enabling\s*if \(!wasPreviouslyOptedIn && isOptedIn && TelemetryService\.hasInstance\(\)\)\ {\s*}\s*await provider\.postStateToWebview\(\)\s*break\s*}/,
	`case "telemetrySetting": {
			const telemetrySetting = message.text as TelemetrySetting
			await updateGlobalState("telemetrySetting", telemetrySetting)
			await provider.postStateToWebview()
			break
		}`
)

// Remove orphaned TelemetryService block in switchTab case
content = content.replace(
	/\/\/ Capture tab shown event for all switchTab messages[\s\S]*?if \(TelemetryService\.hasInstance\(\)\)\ {\s*}\s*/,
	''
)

// Remove unused imports
content = content.replace(/,\n\tTelemetryEventName,\n/, '\n')
// Remove TelemetryEventName if it's still there
content = content.replace(/\tTelemetryEventName,\n/, '')

// Remove marketplaceManager references
content = content.replace(/marketplaceManager/g, '// marketplaceManager removed')

// Remove isCloudServiceAvailable() and showCloudUnavailableMessage() references
content = content.replace(/isCloudServiceAvailable\(\)/g, 'false')
content = content.replace(/showCloudUnavailableMessage\(\)/g, '/* cloud removed */')

// Remove CloudService.hasInstance() 
content = content.replace(/CloudService\.hasInstance\(\)/g, 'false')

// Remove empty lines (multiple consecutive blank lines -> single blank line)
content = content.replace(/\n{3,}/g, '\n\n')

fs.writeFileSync(filePath, content, 'utf8')
console.log('Fixed webviewMessageHandler.ts')