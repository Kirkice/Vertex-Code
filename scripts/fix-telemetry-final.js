/**
 * Comprehensive telemetry/cloud/marketplace/openai-codex removal script
 * Handles all remaining references to deleted packages and modules
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'src')

// Files to fix (from tsc errors)
const FILES_TO_FIX = [
	// code-index files
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
	'services/code-index/service-factory.ts',
	// core files
	'core/assistant-message/presentAssistantMessage.ts',
	'core/task/validateToolResultIds.ts',
	'core/webview/webviewMessageHandler.ts',
	// api files
	'api/providers/openai-codex.ts',
	// test files
	'api/providers/__tests__/openai-codex-native-tool-calls.spec.ts',
	'core/assistant-message/__tests__/presentAssistantMessage-custom-tool.spec.ts',
	'core/condense/__tests__/condense.spec.ts',
	'core/condense/__tests__/foldedFileContext.spec.ts',
	'core/condense/__tests__/index.spec.ts',
	'core/condense/__tests__/rewind-after-condense.spec.ts',
	'core/config/__tests__/importExport.spec.ts',
	'core/context-management/__tests__/context-management.spec.ts',
	'core/context-management/__tests__/truncation.spec.ts',
	'core/task/__tests__/flushPendingToolResultsToHistory.spec.ts',
	'core/task/__tests__/grace-retry-errors.spec.ts',
	'core/task/__tests__/Task.persistence.spec.ts',
	'core/task/__tests__/Task.spec.ts',
	'core/task/__tests__/validateToolResultIds.spec.ts',
	'core/webview/__tests__/ClineProvider.apiHandlerRebuild.spec.ts',
	'core/webview/__tests__/ClineProvider.lockApiConfig.spec.ts',
	'core/webview/__tests__/ClineProvider.spec.ts',
	'core/webview/__tests__/ClineProvider.sticky-mode.spec.ts',
	'core/webview/__tests__/ClineProvider.sticky-profile.spec.ts',
	'core/webview/__tests__/ClineProvider.taskHistory.spec.ts',
	'core/webview/__tests__/messageEnhancer.test.ts',
	'core/webview/__tests__/telemetrySettingsTracking.spec.ts',
	'core/webview/__tests__/webviewMessageHandler.cloudAuth.spec.ts',
	'core/webview/__tests__/webviewMessageHandler.spec.ts',
]

function fixFile(filePath) {
	const fullPath = path.join(SRC_DIR, filePath)
	if (!fs.existsSync(fullPath)) {
		console.log(`SKIP (not found): ${filePath}`)
		return
	}
	
	let content = fs.readFileSync(fullPath, 'utf8')
	let original = content
	let changes = 0
	
	// 1. Remove entire import lines for deleted packages
	const importPatterns = [
		/@roo-code\/telemetry/g,
		/@roo-code\/cloud/g,
	]
	
	for (const pattern of importPatterns) {
		// Remove single-line imports
		const singleLineRegex = new RegExp(`^import\\s+.*from\\s+['"]${pattern.source.replace(/\\//g, '/')}['"]\\s*;?\\s*$`, 'gm')
		content = content.replace(singleLineRegex, '')
		changes++
	}
	
	// 2. Remove specific module imports
	const moduleImports = [
		../../services/marketplace,
		../../integrations/openai-codex/oauth,
		../../integrations/openai-codex/rate-limits,
	]
	
	for (const mod of moduleImports) {
		const escaped = mod.replace(/\//g, '\\/').replace(/\.\./g, '\\.\\.\\.\\.')
		// Actually let me use a simpler approach
		const regex = new RegExp(`^import\\s+\\{[^}]*\\}\\s+from\\s+['"]${mod}['"]\\s*;?\\s*$`, 'gm')
		content = content.replace(regex, '')
		changes++
		
		// Also handle dynamic imports: await import('...')
		const dynamicRegex = new RegExp(`await\\s+import\\(['"]${mod}['"]\\)`, 'g')
		// Replace dynamic imports with empty object or appropriate stub
		content = content.replace(dynamicRegex, '({})')
		changes++
	}
	
	// 3. Remove TelemetryService.instance calls (standalone or in try-catch)
	// Pattern: try { TelemetryService.instance.xxx(...) } catch (e) {}
	content = content.replace(
		/try\s*\{\s*TelemetryService\.instance\.\w+\([^)]*\)\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}\s*/g,
		''
	)
	changes++
	
	// Standalone TelemetryService.instance.xxx() calls
	content = content.replace(
		/TelemetryService\.instance\.\w+\([^)]*\)\s*/g,
		''
	)
	changes++
	
	// 4. Remove TelemetryService.instance.xxx() calls with multi-line arguments
	// More aggressive: any line containing TelemetryService.instance
	content = content.replace(
		/^\s*TelemetryService\.instance\.\w+\(.*?\)\s*;?\s*$/gm,
		''
	)
	changes++
	
	// 5. Remove captureTelemetry calls
	content = content.replace(
		/MessageEnhancer\.captureTelemetry\([^)]*\)\s*;?\s*/g,
		''
	)
	changes++
	
	// Also remove captureTelemetry method definition from MessageEnhancer if it exists
	content = content.replace(
		/\n\s*static\s+captureTelemetry\([^)]*\)\s*\{[^}]*\}/g,
		''
	)
	changes++
	
	// 6. Remove openAiCodexOAuthManager references
	// These are in openai-codex.ts - replace with stub behavior
	content = content.replace(
		/openAiCodexOAuthManager\s*\.\s*getAccessToken\(\)/g,
		'undefined'
	)
	changes++
	
	content = content.replace(
		/openAiCodexOAuthManager\s*\.\s*ensureAuthenticated\(\)/g,
		'Promise.resolve(undefined)'
	)
	changes++
	
	// 7. Remove fetchMarketplaceData references
	content = content.replace(
		/provider\s*\.\s*fetchMarketplaceData\([^)]*\)\s*;?\s*/g,
		'// Marketplace removed'
	)
	changes++
	
	// 8. Clean up empty lines (more than 2 consecutive)
	content = content.replace(/\n{3,}/g, '\n\n')
	
	// 9. Remove any remaining import { ... } from "deleted-module" that might be multi-line
	// Handle multi-line telemetry imports
	content = content.replace(
		/^import\s*\{[^}]*\}\s*from\s*["@roo-code/telemetry@]\s*;?\s*$/gm,
		''
	)
	
	// Actually need a better multi-line regex
	const lines = content.split('\n')
	const newLines = []
	let skipUntilFrom = false
	let skipTarget = null
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		
		if (skipUntilFrom) {
			if (line.includes(`from "${skipTarget}"`) || line.includes(`from '${skipTarget}'`)) {
				skipUntilFrom = false
				skipTarget = null
				continue
			}
			// Still in the import block, skip
			continue
		}
		
		// Check for multi-line import start
		if (line.match(/^import\s*\{/) && !line.includes('} from')) {
			// Check if this import targets a deleted module
			// Need to look ahead
			for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
				if (lines[j].includes('} from')) {
					const fromMatch = lines[j].match(/from\s+['"]([^'"]+)['"]/)
					if (fromMatch) {
						const modulePath = fromMatch[1]
						if (modulePath.includes('@roo-code/telemetry') || 
						    modulePath.includes('@roo-code/cloud') ||
						    modulePath === '../../services/marketplace' ||
						    modulePath === '../../integrations/openai-codex/oauth' ||
						    modulePath === '../../integrations/openai-codex/rate-limits') {
							skipUntilFrom = true
							skipTarget = modulePath
							continue
						}
					}
					break
				}
			}
			if (skipUntilFrom) continue
		}
		
		// Check for single-line import of deleted modules
		const singleImportMatch = line.match(/^import\s+.*from\s+['"]([^'"]+)['"]/)
		if (singleImportMatch) {
			const modulePath = singleImportMatch[1]
			if (modulePath.includes('@roo-code/telemetry') || 
			    modulePath.includes('@roo-code/cloud') ||
			    modulePath === '../../services/marketplace' ||
			    modulePath === '../../integrations/openai-codex/oauth' ||
			    modulePath === '../../integrations/openai-codex/rate-limits') {
				continue // Skip this line
			}
		}
		
		newLines.push(line)
	}
	
	content = newLines.join('\n')
	
	if (content !== original) {
		fs.writeFileSync(fullPath, content, 'utf8')
		console.log(`FIXED: ${filePath}`)
	} else {
		console.log(`NO CHANGE: ${filePath}`)
	}
}

// Fix all files
for (const file of FILES_TO_FIX) {
	fixFile(file)
}

console.log('\nDone! Run tsc again to check for remaining errors.')