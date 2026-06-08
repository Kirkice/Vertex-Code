/**
 * Robust line-by-line fix for orphaned TelemetryService code fragments.
 * 
 * Key insight: All orphaned fragments share a common pattern -
 * they contain property names like "error:", "stack:", "location:", "attempt:"
 * that were originally inside an object literal passed to a removed function call.
 * The function call name and opening ({ were deleted, leaving these properties
 * as dangling fragments sometimes glued onto valid statement lines.
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'src')

// Orphaned property names that indicate dangling object literal fragments
const ORPHAN_PROPS = ['error:', 'stack:', 'location:', 'attempt:', 'message:']

function isOrphanedPropLine(line) {
	const trimmed = line.trim()
	for (const prop of ORPHAN_PROPS) {
		if (trimmed.startsWith(prop)) return true
	}
	return false
}

function isClosingOrphan(line) {
	const trimmed = line.trim()
	return trimmed === '})' || trimmed === '}' || trimmed === '),'
}

function isCaptureTelemetryComment(line) {
	return line.trim().startsWith('// Capture telemetry') || 
	       line.trim().startsWith('// Track') && line.includes('telemetry')
}

function fixFileLineByLine(filePath) {
	const fullPath = path.join(SRC_DIR, filePath)
	if (!fs.existsSync(fullPath)) {
		console.log(`  SKIP: ${filePath} (not found)`)
		return false
	}
	
	let content = fs.readFileSync(fullPath, 'utf8')
	const lines = content.split('\n')
	const result = []
	let skipMode = false
	let i = 0
	
	while (i < lines.length) {
		const line = lines[i]
		
		if (skipMode) {
			// In skip mode, we skip orphaned property lines and closing }) lines
			if (isOrphanedPropLine(line) || isClosingOrphan(line) || 
			    line.trim() === '' && (i + 1 < lines.length && isOrphanedPropLine(lines[i+1]))) {
				// Check if this is the closing }) that ends the orphan block
				if (line.trim() === '})' || line.trim() === '})' || line.trim().match(/^\}\)?$/)) {
					skipMode = false
				}
				i++
				continue
			}
			// If we hit a line that's NOT an orphan pattern, exit skip mode
			skipMode = false
			// Don't increment i - process this line normally
		}
		
		// Pattern A: Valid statement on same line as orphaned "error:" property
		// The orphaned property always appears after multiple tabs (2+) indicating it was
		// originally indented as part of a nested object literal
		// e.g., "this.fileHashes = {}\t\t\terror: error instanceof Error ..."
		// e.g., "console.error(\"Failed\", error)\t\t\terror: ..."
		// e.g., "// Capture telemetry ...\t\t\terror: ..."
		// We split at the point where tabs+error: appears, keeping only the valid statement
		const matchGlued = line.match(/^(.*?)(\t{2,}\w+:\s(?:error|stack|location|attempt|message))/)
		if (matchGlued) {
			// Find the exact position of the orphaned property and keep everything before it
			const splitIdx = line.indexOf(matchGlued[2])
			const validPart = line.substring(0, splitIdx).trimEnd()
			result.push(validPart)
			skipMode = true
			i++
			continue
		}
		
		// Pattern B: Comment line followed by orphaned properties on same line
		// e.g., "// Capture telemetry before reformatting the error\t\t\terror: ..."
		const matchCommentGlued = line.match(/^(\s*\/\/\s*(?:Capture|Track)\s+telemetry.*?)(\s+error:\s)/)
		if (matchCommentGlued) {
			// Skip entire line and enter skip mode
			skipMode = true
			i++
			continue
		}
		
		// Pattern C: Standalone orphaned "error:" line (not glued to valid code)
		if (isOrphanedPropLine(line) && !line.includes('console.error') && !line.includes('await cline.say("error"') && !line.includes('.recordToolError')) {
			skipMode = true
			i++
			continue
		}
		
		// Pattern D: "// Capture telemetry" comment line (standalone, not glued)
		if (isCaptureTelemetryComment(line)) {
			// Skip this comment line
			i++
			// If next line is an orphaned property, enter skip mode
			if (i < lines.length && isOrphanedPropLine(lines[i])) {
				skipMode = true
			}
			continue
		}
		
		// Pattern E: Closing }) that's orphaned (no matching opening function call)
		// Only skip if we're already processing orphan patterns nearby
		// This is handled by skipMode
		
		// Pattern F: Orphaned TelemetryService.hasInstance() blocks
		if (line.includes('TelemetryService.hasInstance()') && !line.startsWith('import')) {
			// Find the entire if block - it starts with this line and ends with a matching }
			// We need to skip everything until we find the closing }
			let braceCount = 0
			let foundOpenBrace = false
			let startI = i
			
			// Count braces from this line onward
			for (let j = i; j < lines.length; j++) {
				for (const ch of lines[j]) {
					if (ch === '{') { braceCount++; foundOpenBrace = true }
					if (ch === '}') { braceCount-- }
				}
				if (foundOpenBrace && braceCount <= 0) {
					// Skip all lines from i to j (inclusive)
					i = j + 1
					break
				}
			}
			if (braceCount > 0) {
				// Couldn't find closing brace - just skip this line
				i++
			}
			continue
		}
		
		// Normal line - keep it
		result.push(line)
		i++
	}
	
	const newContent = result.join('\n')
	
	// Also fix missing closing braces and unused imports
	let finalContent = fixUnusedImports(newContent)
	finalContent = fixProviderSettingsManager(finalContent, filePath)
	finalContent = finalContent.replace(/\n{4,}/g, '\n\n\n')
	
	if (finalContent !== content) {
		fs.writeFileSync(fullPath, finalContent, 'utf8')
		console.log(`  FIXED: ${filePath}`)
		return true
	}
	
	console.log(`  NO CHANGE: ${filePath}`)
	return false
}

function fixUnusedImports(content) {
	// Remove TelemetryEventName from imports if not used in body
	const importPattern = /import\s*\{([^}]*)\}\s*from\s*"@roo-code\/types"/
	const match = content.match(importPattern)
	if (match) {
		const importsStr = match[1]
		const importList = importsStr.split(',').map(s => s.trim()).filter(s => s.length > 0)
		const bodyWithoutImport = content.replace(match[0], '')
		
		let changed = false
		let newList = [...importList]
		
		// Remove TelemetryEventName if unused
		if (newList.includes('TelemetryEventName') && !bodyWithoutImport.includes('TelemetryEventName')) {
			newList = newList.filter(s => s !== 'TelemetryEventName')
			changed = true
		}
		
		// Remove GlobalState if unused  
		if (newList.includes('GlobalState') && !bodyWithoutImport.includes('GlobalState')) {
			newList = newList.filter(s => s !== 'GlobalState')
			changed = true
		}
		
		if (changed) {
			if (newList.length === 0) {
				content = content.replace(match[0] + '\n', '')
			} else {
				content = content.replace(match[0], `import { ${newList.join(', ')} } from "@roo-code/types"`)
			}
		}
	}
	return content
}

function fixProviderSettingsManager(content, filePath) {
	if (!filePath.includes('ProviderSettingsManager')) return content
	
	// The load() method is missing its closing brace
	// Pattern: catch block ends with }, then empty line, then /** for next method
	// Need to add } to close the load() method
	
	// Find the load method and check if it has proper closing
	const loadMatch = content.match(/private async load\(\): Promise<ProviderProfiles> \{[\s\S]*?throw new Error\(`Failed to read provider profiles from secrets: \$\{error\`\)\n\t\}\n\n\t\/\*\*/)
	if (loadMatch) {
		content = content.replace(
			/throw new Error\(`Failed to read provider profiles from secrets: \$\{error\`\)\n\t\}\n\n\t\/\*\*/g,
			"throw new Error(`Failed to read provider profiles from secrets: ${error}`)\n\t}\n\t}\n\n\t/**"
		)
	}
	
	// Also handle \r\n variant
	const loadMatchRN = content.match(/private async load\(\): Promise<ProviderProfiles> \{[\s\S]*?throw new Error\(`Failed to read provider profiles from secrets: \$\{error\`\)\r?\n\t\}\r?\n\r?\n\t\/\*\*/)
	if (loadMatchRN && !loadMatch) {
		content = content.replace(
			/throw new Error\(`Failed to read provider profiles from secrets: \$\{error\`\)\r?\n\t\}\r?\n\r?\n\t\/\*\*/g,
			"throw new Error(`Failed to read provider profiles from secrets: ${error}`)\n\t}\n\t}\n\n\t/**"
		)
	}
	
	return content
}

// Process all damaged files
const ALL_FILES = [
	// Core files that still have errors
	'core/config/ProviderSettingsManager.ts',
	'core/task/validateToolResultIds.ts',
	'core/webview/webviewMessageHandler.ts',
	'core/task/Task.ts',
	'api/providers/fetchers/modelCache.ts',
	'services/code-index/manager.ts',
	// Code-index files that still have errors
	'services/code-index/cache-manager.ts',
	'services/code-index/embedders/bedrock.ts',
	'services/code-index/embedders/gemini.ts',
	'services/code-index/embedders/mistral.ts',
	'services/code-index/embedders/ollama.ts',
	'services/code-index/embedders/openai-compatible.ts',
	'services/code-index/embedders/openai.ts',
	'services/code-index/embedders/openrouter.ts',
	'services/code-index/embedders/vercel-ai-gateway.ts',
	'services/code-index/orchestrator.ts',
	'services/code-index/processors/file-watcher.ts',
	'services/code-index/processors/parser.ts',
	'services/code-index/processors/scanner.ts',
	'services/code-index/search-service.ts',
	'core/webview/messageEnhancer.ts',
]

console.log('=== Fixing Telemetry Orphaned Code (V2 - Line by Line) ===\n')

let totalFixed = 0
for (const file of ALL_FILES) {
	if (fixFileLineByLine(file)) totalFixed++
}

console.log(`\nTotal files fixed: ${totalFixed}`)
console.log('=== Done ===')