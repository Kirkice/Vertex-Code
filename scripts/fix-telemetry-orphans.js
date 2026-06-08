/**
 * Comprehensive script to fix orphaned TelemetryService code fragments.
 * 
 * Patterns fixed:
 * 1. Orphaned ConsecutiveMistakeError blocks (comment + error constructor + closing paren)
 * 2. Dangling object literals in catch blocks (error:, stack:, location:, ... })
 * 3. Orphaned TelemetryService.hasInstance() conditionals
 * 4. Missing closing braces for methods
 * 5. Unused TelemetryEventName imports
 * 6. Orphaned "Capture telemetry" comments with dangling code
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'src')

// Files to fix
const FILES_TO_FIX = [
	// Core files
	'core/assistant-message/presentAssistantMessage.ts',
	'core/config/ProviderSettingsManager.ts',
	'core/task/validateToolResultIds.ts',
	'core/webview/messageEnhancer.ts',
	'core/webview/webviewMessageHandler.ts',
	'core/task/Task.ts',
	'api/providers/fetchers/modelCache.ts',
	'services/code-index/manager.ts',
	// Code-index files
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
]

function fixFile(filePath) {
	const fullPath = path.join(SRC_DIR, filePath)
	if (!fs.existsSync(fullPath)) {
		console.log(`  SKIP: File not found: ${fullPath}`)
		return false
	}
	
	let content = fs.readFileSync(fullPath, 'utf8')
	let original = content
	let modified = false
	
	// ===== Pattern 1: Orphaned ConsecutiveMistakeError + closing paren =====
	// In presentAssistantMessage.ts - the "Track tool repetition" comment followed by
	// new ConsecutiveMistakeError(...) and a dangling )
	// The comment may have tab/space after the period before new ConsecutiveMistakeError
	content = content.replace(
		/\t*\/\/ Track tool repetition in telemetry via PostHog exception tracking and event\.\s*\n\t+new ConsecutiveMistakeError\(\s*\n\t+`Tool repetition limit reached for \$\{block\.name\}`,?\s*\n\t+cline\.taskId,?\s*\n\t+cline\.consecutiveMistakeCount,?\s*\n\t+cline\.consecutiveMistakeLimit,?\s*\n\t+"tool_repetition",?\s*\n\t+cline\.apiConfiguration\.apiProvider,?\s*\n\t+cline\.api\.getModel\(\)\.id,?\s*\n\t+\),?\s*\n\t+\)\s*\n/g,
		''
	)
	
	// ===== Pattern 2: Dangling object literals in catch blocks =====
	// These appear as: valid_statement\r\n\t\t\t\terror: ..., stack: ..., location: "...", \r\n\t\t\t})
	// OR: valid_statement\r\n\t\t\terror: ..., stack: ..., location: "...", \r\n\t\t\t})
	// The object literal properties were args to removed telemetryService.captureException(...)
	// Match various indent levels
	
	// Sub-pattern 2a: Inside catch blocks, after a valid statement on the same line
	// e.g., "this.fileHashes = {}\t\t\terror: error instanceof Error ..."
	// e.g., "console.error(\"Failed ...\", error)\t\t\terror: error instanceof Error ..."
	// We need to find lines that have a valid statement followed by orphaned object properties
	
	// Remove orphaned object literal lines (error:, stack:, location:, attempt:, ... followed by })
	// These always appear after a valid statement that's already complete
	// Pattern: line with valid code, then on same line starts orphaned properties
	// Followed by more property lines, then closing })
	
	// Match the most common pattern: 
	// <valid line>\t\t\terror: error instanceof Error ? error.message : String(error),
	// \t\t\tstack: error instanceof Error ? error.stack : undefined,
	// \t\t\tlocation: "some_string",
	// \t\t\tattempt: number_or_expr,   (optional)
	// \t\t})
	
	const orphanedObjLiteralPattern = /\t+(?:error: error instanceof Error \? error\.message : String\(error\),\r?\n\t+stack: error instanceof Error \? error\.stack : undefined,\r?\n\t+location: "[^"]*",(?:\r?\n\t+attempt: [^,]+,)?\r?\n\t+\})\r?\n/g
	content = content.replace(orphanedObjLiteralPattern, '\n')
	
	// Also handle variant where it uses sanitizeErrorMessage
	const orphanedObjLiteralPattern2 = /\t+(?:error: sanitizeErrorMessage\(error instanceof Error \? error\.message : String\(error\)\),\r?\n\t+stack: error instanceof Error \? sanitizeErrorMessage\(error\.stack \|\| ""\) : undefined,\r?\n\t+location: "[^"]*",(?:\r?\n\t+[^}]+,)?\r?\n\t+\})\r?\n/g
	content = content.replace(orphanedObjLiteralPattern2, '\n')
	
	// ===== Pattern 3: Orphaned TelemetryService.hasInstance() conditionals =====
	// In validateToolResultIds.ts - lines like:
	// if (missingToolUseIds.length > 0 && TelemetryService.hasInstance()) {    new MissingToolResultError(...)
	//   ...object literal...
	// }
	// Need to remove entire blocks
	
	// Pattern: if (... && TelemetryService.hasInstance()) { followed by orphaned code then }
	content = content.replace(
		/if \([^)]*TelemetryService\.hasInstance\(\)\)[^{\n]*\{\s*\n?\t+new (?:MissingToolResultError|ToolResultIdMismatchError)\([^)]*\),?\s*\n?\t+\{[^}]+\},?\s*\n?\t+\)\s*\n?\t+\}/g,
		''
	)
	
	// ===== Pattern 4: Missing closing brace for load() method in ProviderSettingsManager.ts =====
	// The load() method's try-catch is missing the closing } before the next method
	// After "throw new Error(...)" line, need to add closing } for the method
	// Check if the closing brace is missing between load() and sanitizeProviderConfig()
	
	if (filePath.includes('ProviderSettingsManager')) {
		// Look for the pattern where load() method's closing } is missing
		// After the catch block, there should be a } to close the method
		// Currently it goes from catch block directly to sanitizeProviderConfig without the method closing brace
		const loadMethodEndPattern = /throw new Error\(`Failed to read provider profiles from secrets: \$\{error\`\)\r?\n\t\}\r?\n\r?\n\t\/\*\r?\n\t \* Sanitizes/g
		if (loadMethodEndPattern.test(content)) {
			content = content.replace(
				/loadMethodEndPattern,
				`throw new Error(\`Failed to read provider profiles from secrets: \${error}\`)
	}

	/**
	 * Sanitizes`
			)
		}
	}
	
	// ===== Pattern 5: Remove unused TelemetryEventName from imports =====
	// Only remove if TelemetryEventName is not used in the file body
	const teImportPattern = /import\s*\{([^}]*)\}\s*from\s*"@roo-code\/types"/g
	content = content.replace(teImportPattern, (match, imports) => {
		const importList = imports.split(',').map(s => s.trim())
		// Check if TelemetryEventName is actually used in the file (not just imported)
		const hasUsage = content.includes('TelemetryEventName') && 
			!content.match(/^import\s*\{[^}]*TelemetryEventName[^}]*\}\s*from\s*"@roo-code\/types"/)
		
		if (importList.includes('TelemetryEventName') && !hasUsage) {
			const newList = importList.filter(s => s !== 'TelemetryEventName')
			if (newList.length === 0) {
				return '' // Remove entire import if empty
			}
			// Reconstruct with proper spacing
			if (newList.length === 1) {
				return `import { ${newList[0]} } from "@roo-code/types"`
			}
			return `import {\n\t${newList.join(',\n\t')},\n} from "@roo-code/types"`
		}
		return match
	})
	
	// ===== Pattern 6: Orphaned "Capture telemetry" comments with dangling code =====
	// These appear as: "// Capture telemetry before ..." or "// Capture telemetry for ..."
	// followed by orphaned object literal properties and closing })
	
	content = content.replace(
		/\t*\/\/ Capture telemetry (?:before|for) [^\n]*\r?\n\t+error: error instanceof Error \? error\.message : String\(error\),\r?\n\t+stack: error instanceof Error \? error\.stack : undefined,\r?\n\t+location: "[^"]*",(?:\r?\n\t+attempt: [^,]+,)?\r?\n\t+\})\r?\n/g,
		''
	)
	
	// Also handle "// Capture telemetry for validation errors" pattern
	content = content.replace(
		/\t*\/\/ Capture telemetry for validation errors\r?\n\t+error: error instanceof Error \? error\.message : String\(error\),\r?\n\t+stack: error instanceof Error \? error\.stack : undefined,\r?\n\t+location: "[^"]*"\r?\n\t+\})\r?\n/g,
		''
	)
	
	// ===== Pattern 7: Remove extra blank lines from removed imports =====
	// Replace 3+ consecutive blank lines with 2
	content = content.replace(/\n{4,}/g, '\n\n\n')
	
	// ===== Pattern 8: Fix messageEnhancer.ts - remove unused TelemetryEventName =====
	// The TelemetryEventName import is unused since captureTelemetry method just has "// Telemetry removed"
	
	// ===== Pattern 9: Fix orphaned telemetry variable declarations =====
	// e.g., "const telemetryService = ..." or standalone "telemetryService" references
	content = content.replace(
		/\t*const telemetryService(?:\.\w+)?\s*=\s*[^\n]*\r?\n/g,
		''
	)
	content = content.replace(
		/\t*telemetryService\.\w+\([^)]*\)\r?\n/g,
		''
	)
	
	// Check if content changed
	if (content !== original) {
		fs.writeFileSync(fullPath, content, 'utf8')
		console.log(`  FIXED: ${filePath}`)
		modified = true
	} else {
		console.log(`  NO CHANGE: ${filePath}`)
	}
	
	return modified
}

// Also do a project-wide search for remaining TelemetryService references
function searchRemainingReferences() {
	console.log('\n--- Searching for remaining TelemetryService/telemetryService references ---')
	const allTsFiles = []
	
	function walkDir(dir) {
		const entries = fs.readdirSync(dir, { withFileTypes: true })
		for (const entry of entries) {
			const full = path.join(dir, entry.name)
			if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
				walkDir(full)
			} else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
				allTsFiles.push(full)
			}
		}
	}
	
	walkDir(SRC_DIR)
	
	for (const file of allTsFiles) {
		const content = fs.readFileSync(file, 'utf8')
		const lines = content.split('\n')
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes('TelemetryService') && !lines[i].includes('import')) {
				const relPath = path.relative(SRC_DIR, file)
				console.log(`  ${relPath}:${i + 1}: ${lines[i].trim()}`)
			}
		}
	}
}

console.log('=== Fixing Telemetry Orphaned Code ===\n')
let totalFixed = 0
for (const file of FILES_TO_FIX) {
	if (fixFile(file)) totalFixed++
}
console.log(`\nTotal files fixed: ${totalFixed}`)

searchRemainingReferences()
console.log('\n=== Done ===')