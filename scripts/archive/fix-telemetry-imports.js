/**
 * Comprehensive script to properly remove all @roo-code/telemetry and @roo-code/cloud 
 * references, plus references to deleted modules (openai-codex/oauth, marketplace, etc.)
 * 
 * This script:
 * 1. Removes import statements for @roo-code/telemetry, @roo-code/cloud, deleted integrations
 * 2. Removes TelemetryService.instance.xxx() calls (including surrounding try-catch)
 * 3. Removes CloudService.instance.xxx() calls (including surrounding try-catch)
 * 4. Removes variable declarations for telemetryService/cloudService
 * 5. Removes MessageEnhancer.captureTelemetry references
 * 6. Replaces marketplace-related calls with stubs
 * 7. Replaces openAiCodexOAuthManager calls with stubs
 * 8. Removes test files that depend on removed modules
 * 
 * Usage: node scripts/fix-telemetry-imports.js
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'src')

// Find all .ts files in src directory (excluding __tests__ for now, we handle those separately)
function findTsFiles(dir, excludeTests = false) {
	const results = []
	const entries = fs.readdirSync(dir, { withFileTypes: true })
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			if (excludeTests && entry.name === '__tests__') continue
			results.push(...findTsFiles(fullPath, excludeTests))
		} else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
			results.push(fullPath)
		}
	}
	return results
}

const files = findTsFiles(SRC_DIR)

let totalFixes = 0

for (const filePath of files) {
	let content = fs.readFileSync(filePath, 'utf8')
	let originalContent = content
	const relativePath = path.relative(SRC_DIR, filePath)

	// 1. Remove @roo-code/telemetry imports
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["']@roo-code\/telemetry["'];?\s*\n/g,
		''
	)
	content = content.replace(
		/import\s+TelemetryService\s*from\s*["']@roo-code\/telemetry["'];?\s*\n/g,
		''
	)
	// Also handle multi-line imports
	content = content.replace(
		/import\s*\{[^}]*TelemetryService[^}]*\}\s*from\s*["']@roo-code\/telemetry["'];?\s*\n/g,
		''
	)
	// Handle type-only imports
	content = content.replace(
		/import\s+type\s*\{[^}]*\}\s*from\s*["']@roo-code\/telemetry["'];?\s*\n/g,
		''
	)

	// 2. Remove @roo-code/cloud imports
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["']@roo-code\/cloud["'];?\s*\n/g,
		''
	)
	content = content.replace(
		/import\s+type\s*\{[^}]*\}\s*from\s*["']@roo-code\/cloud["'];?\s*\n/g,
		''
	)

	// 3. Remove deleted module imports
	// openai-codex/oauth
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["'][^"']*openai-codex\/oauth["'];?\s*\n/g,
		''
	)
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["'][^"']*openai-codex\/rate-limits["'];?\s*\n/g,
		''
	)
	// marketplace
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["'][^"']*\/marketplace["'];?\s*\n/g,
		''
	)
	// mdm
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["'][^"']*\/mdm["'];?\s*\n/g,
		''
	)

	// 4. Remove TelemetryService.instance calls with try-catch
	// Pattern: try { TelemetryService.instance.xxx(...) } catch (e) {}
	content = content.replace(
		/try\s*\{\s*TelemetryService\.instance\.\w+\([^)]*\)\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}\s*\n/g,
		''
	)
	// Pattern with object argument: try { TelemetryService.instance.xxx({...}) } catch (e) {}
	content = content.replace(
		/try\s*\{\s*TelemetryService\.instance\.\w+\(\{[^}]*\}\)\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}\s*\n/g,
		''
	)
	// Multi-line try-catch with TelemetryService
	content = content.replace(
		/try\s*\{\s*\n\s*TelemetryService\.instance\.\w+\([^)]*\)\s*\n\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}\s*\n/g,
		''
	)

	// 5. Remove standalone TelemetryService.instance.xxx() calls (no try-catch)
	content = content.replace(
		/TelemetryService\.instance\.\w+\([^)]*\)[\s;]*\n/g,
		''
	)
	content = content.replace(
		/TelemetryService\.instance\.\w+\(\{[^}]*\}\)[\s;]*\n/g,
		''
	)

	// 6. Remove CloudService.instance calls with try-catch
	content = content.replace(
		/try\s*\{\s*CloudService\.instance\.\w+\([^)]*\)\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}\s*\n/g,
		''
	)

	// 7. Remove standalone CloudService.instance.xxx() calls
	content = content.replace(
		/CloudService\.instance\.\w+\([^)]*\)[\s;]*\n/g,
		''
	)

	// 8. Remove variable declarations for telemetryService
	content = content.replace(
		/(const|let|var)\s+telemetryService\s*=\s*[^;]+;\s*\n/g,
		''
	)
	content = content.replace(
		/(const|let|var)\s+cloudService\s*=\s*[^;]+;\s*\n/g,
		''
	)
	// Handle telemetryServiceTelemetryService (malformed)
	content = content.replace(
		/(const|let|var)\s+telemetryServiceTelemetryService\s*=\s*[^;]+;\s*\n/g,
		''
	)

	// 9. Remove MessageEnhancer.captureTelemetry calls
	content = content.replace(
		/MessageEnhancer\.captureTelemetry\([^)]*\)\s*\n/g,
		'// Telemetry removed\n'
	)

	// 10. Replace openAiCodexOAuthManager references with stub behavior
	// In webviewMessageHandler.ts, these are used for sign-in/sign-out
	content = content.replace(
		/openAiCodexOAuthManager\s*\n/g,
		'// openAiCodex module removed\n'
	)

	// 11. Remove fetchMarketplaceData calls
	content = content.replace(
		/provider\.fetchMarketplaceData\([^)]*\)\s*\n/g,
		'// Marketplace module removed\n'
	)

	// 12. Remove orphaned TelemetryService references in comments
	// Keep comments that are informational, remove ones that are stale references
	content = content.replace(
		/\/\/\s*Telemetry\s*initialization\s*removed[^]*\n/g,
		''
	)

	// 13. Remove empty lines that were left behind (collapse multiple blank lines)
	content = content.replace(/\n{3,}/g, '\n\n')

	if (content !== originalContent) {
		fs.writeFileSync(filePath, content, 'utf8')
		const linesRemoved = originalContent.split('\n').length - content.split('\n').length
		console.log(`Fixed ${relativePath}: removed ${linesRemoved} lines`)
		totalFixes++
	}
}

// Handle test files that need more extensive changes
const testFiles = findTsFiles(path.join(SRC_DIR, 'core', 'webview', '__tests__'), false)
	.concat(findTsFiles(path.join(SRC_DIR, 'core', 'assistant-message', '__tests__'), false))
	.concat(findTsFiles(path.join(SRC_DIR, 'core', 'condense', '__tests__'), false))
	.concat(findTsFiles(path.join(SRC_DIR, 'core', 'task', '__tests__'), false))
	.concat(findTsFiles(path.join(SRC_DIR, 'core', 'config', '__tests__'), false))
	.concat(findTsFiles(path.join(SRC_DIR, 'core', 'context-management', '__tests__'), false))
	.concat(findTsFiles(path.join(SRC_DIR, 'api', 'providers', '__tests__'), false))

for (const filePath of testFiles) {
	if (!fs.existsSync(filePath)) continue
	let content = fs.readFileSync(filePath, 'utf8')
	let originalContent = content

	// Remove telemetry imports
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["']@roo-code\/telemetry["'];?\s*\n/g,
		''
	)
	// Remove cloud imports
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["']@roo-code\/cloud["'];?\s*\n/g,
		''
	)
	// Remove openai-codex imports
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["'][^"']*openai-codex\/oauth["'];?\s*\n/g,
		''
	)
	content = content.replace(
		/import\s*\{[^}]*\}\s*from\s*["'][^"']*openai-codex\/rate-limits["'];?\s*\n/g,
		''
	)

	// Remove TelemetryService mock setup lines
	content = content.replace(
		/(const|let)\s+telemetryServiceMock\s*=\s*[^;]+;\s*\n/g,
		''
	)
	content = content.replace(
		/telemetryServiceMock\.\w+\([^)]*\)\s*\.?\s*andReturn\([^)]*\)\s*\n/g,
		''
	)
	content = content.replace(
		/TelemetryService\.instance\s*=\s*telemetryServiceMock\s*;?\s*\n/g,
		''
	)

	// Remove MessageEnhancer.captureTelemetry references in tests
	content = content.replace(
		/MessageEnhancer\.captureTelemetry[^;]*;\s*\n/g,
		'// captureTelemetry removed\n'
	)

	// Remove cloud-related mock setup
	content = content.replace(
		/(const|let)\s+cloudServiceMock\s*=\s*[^;]+;\s*\n/g,
		''
	)

	// Remove references to CloudService
	content = content.replace(
		/CloudService\.\w+\([^)]*\)\s*\n/g,
		''
	)

	// Collapse multiple blank lines
	content = content.replace(/\n{3,}/g, '\n\n')

	if (content !== originalContent) {
		fs.writeFileSync(filePath, content, 'utf8')
		console.log(`Fixed test file: ${path.relative(SRC_DIR, filePath)}`)
		totalFixes++
	}
}

console.log(`\nTotal files fixed: ${totalFixes}`)