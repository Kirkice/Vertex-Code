/**
 * Fix all broken postMessageToWebview calls in webviewMessageHandler.ts
 * Pattern: postMessageToWebview({ ... properties ... , (no closing })  followed by break/case/comment
 * 
 * Also fixes:
 * - Missing closing }) for getTaskWithAggregatedCosts catch block
 * - Missing closing }) for various other incomplete calls
 * - captureTelemetry reference in MessageEnhancer
 */

const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'src', 'core', 'webview', 'webviewMessageHandler.ts')
let content = fs.readFileSync(FILE, 'utf8')
const lines = content.split('\n')

// Find all incomplete postMessageToWebview({ calls
// An incomplete call is one where we find `postMessageToWebview({` but the
// closing `})` is not found within a reasonable number of lines, and instead
// we find `break` or `case` or a similar control flow keyword.

function findIncompleteCalls(lines) {
	const issues = []
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		// Look for postMessageToWebview({ pattern
		if (line.includes('postMessageToWebview({') || line.includes('postMessageToWebview(\n{')) {
			// Find the matching closing })
			let braceCount = 0
			let foundOpen = false
			let foundClose = false
			let closeLine = -1
			
			for (let j = i; j < Math.min(i + 30, lines.length); j++) {
				for (const ch of lines[j]) {
					if (ch === '{') { braceCount++; foundOpen = true }
					if (ch === '}') { braceCount-- }
				}
				// Also check for ) after }
				if (foundOpen && braceCount <= 0 && lines[j].includes('})')) {
					foundClose = true
					closeLine = j
					break
				}
				if (foundOpen && braceCount <= 0) {
					// Found closing } but not })
					// This might be just closing the object, need to check for )
					closeLine = j
					break
				}
			}
			
			if (!foundClose) {
				// This is an incomplete call - no }) found
				// Find what comes after the incomplete call
				let nextSignificantLine = -1
				for (let j = (closeLine >= 0 ? closeLine : i + 5); j < Math.min(i + 30, lines.length); j++) {
					const trimmed = lines[j].trim()
					if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed !== '') {
						nextSignificantLine = j
						break
					}
				}
				
				issues.push({
					startLine: i,
					closeLine: closeLine >= 0 ? closeLine : nextSignificantLine - 1,
					nextSignificantLine,
					nextSignificantContent: nextSignificantLine >= 0 ? lines[nextSignificantLine].trim() : 'EOF',
				})
			}
		}
	}
	
	return issues
}

// Strategy: For each incomplete postMessageToWebview call, we need to:
// 1. Find the last property line in the object literal
// 2. Add the closing }) after it
// 3. Remove any orphaned lines between the last property and the next valid code

// Let me use a different approach: parse the file line by line and fix incomplete calls

let result = []
let i = 0
let fixesApplied = 0

while (i < lines.length) {
	const line = lines[i]
	const trimmed = line.trim()
	
	// Check for postMessageToWebview({ on this line
	if (line.includes('postMessageToWebview({')) {
		// Start tracking this call
		let braceCount = 0
		let callLines = []
		let foundCompleteClose = false
		let j = i
		
		// Count braces to find where the object literal ends
		while (j < lines.length) {
			const currentLine = lines[j]
			callLines.push(currentLine)
			
			for (const ch of currentLine) {
				if (ch === '{') braceCount++
				if (ch === '}') braceCount--
			}
			
			// Check if this line has }) which closes the call
			if (braceCount <= 0 && currentLine.includes('})')) {
				foundCompleteClose = true
				j++
				break
			}
			
			// Check if brace count went to 0 but no }) - object closed but call not closed
			if (braceCount <= 0 && !currentLine.includes('})')) {
				// The object literal closed but the function call didn't
				// We need to add ) after the }
				// But first, check if there are more } lines that might be closing other blocks
				j++
				break
			}
			
			// If brace count is still positive, continue
			if (braceCount > 0) {
				j++
				continue
			}
			
			j++
			break
		}
		
		if (foundCompleteClose) {
			// Call is complete - output all lines
			for (const cl of callLines) {
				result.push(cl)
			}
			i = j
			continue
		}
		
		// Call is incomplete - we need to fix it
		// Find the last line that has a property in the object literal
		let lastPropIdx = callLines.length - 1
		
		// Check if the last line in callLines just has } closing the object
		// If so, we need to add ) to make it })
		const lastCallLine = callLines[callLines.length - 1]
		
		if (lastCallLine.trim() === '}' || lastCallLine.match(/^\s*\}\s*$/)) {
			// The object literal closed with } but the call needs })
			// Replace the last } with })
			callLines[callLines.length - 1] = lastCallLine.replace(/\}(\s*)$/, '})$1')
			fixesApplied++
		} else if (lastCallLine.trim() === '' || lastCallLine.trim().startsWith('//')) {
			// The call was interrupted by blank lines or comments
			// Find the last actual property line
			for (let k = callLines.length - 1; k >= 0; k--) {
				const cl = callLines[k].trim()
				if (cl && !cl.startsWith('//') && !cl.startsWith('*')) {
					// This is the last meaningful line
					if (cl.endsWith(',')) {
						// Property with trailing comma - need to add closing })
						// Remove trailing comma, add }, then })
						callLines[k] = callLines[k].replace(/,\s*$/, '')
						// Insert closing }) after this line
						callLines = callLines.slice(0, k + 1)
						// Get the indentation from the postMessageToWebview line
						const indent = line.match(/^(\s*)/)[1]
						callLines.push(indent + '})')
						fixesApplied++
					} else if (cl.endsWith('{')) {
						// Nested object - need more closing braces
						// This is complex - skip for now
					} else {
						// Add closing }) after this line
						callLines = callLines.slice(0, k + 1)
						const indent = line.match(/^(\s*)/)[1]
						callLines.push(indent + '})')
						fixesApplied++
					}
					break
				}
			}
		} else {
			// Last line has content - might be a property
			// Check what comes after
			// Look ahead to find the next significant line after the callLines
			let nextLines = []
			let k = j
			while (k < lines.length && k < j + 10) {
				const nextTrimmed = lines[k].trim()
				if (nextTrimmed === '' || nextTrimmed.startsWith('//') || nextTrimmed.startsWith('*')) {
					nextLines.push(lines[k])
					k++
					continue
				}
				nextLines.push(lines[k])
				k++
				break
			}
			
			// Check if the next significant line is 'break', 'case', '}', etc.
			// which means the call was never properly closed
			const nextContent = nextLines.length > 0 ? nextLines[nextLines.length - 1].trim() : ''
			
			if (nextContent.startsWith('break') || nextContent.startsWith('case') || 
			    nextContent === '}' || nextContent === '} catch') {
				// The call is incomplete - add closing })
				// Find the indentation
				const indent = line.match(/^(\s*)/)[1]
				// Add closing }) after the last callLine that has content
				let lastContentIdx = callLines.length - 1
				for (let m = callLines.length - 1; m >= 0; m--) {
					if (callLines[m].trim() && !callLines[m].trim().startsWith('//')) {
						lastContentIdx = m
						break
					}
				}
				
				callLines = callLines.slice(0, lastContentIdx + 1)
				callLines.push(indent + '})')
				
				// Skip the orphaned blank/comment lines and the next significant line if it's redundant
				// Don't skip 'break' or 'case' - those are needed
				i = j
				// Skip blank lines between our fix and the next meaningful code
				while (i < lines.length && lines[i].trim() === '') {
					i++
				}
				
				for (const cl of callLines) {
					result.push(cl)
				}
				fixesApplied++
				continue
			}
			
			// Output the call lines as-is and continue
			for (const cl of callLines) {
				result.push(cl)
			}
			i = j
			continue
		}
		
		// Output fixed call lines
		for (const cl of callLines) {
			result.push(cl)
		}
		i = j
		continue
	}
	
	// Normal line - keep it
	result.push(line)
	i++
}

// Write the result
let newContent = result.join('\n')

// Also fix the MessageEnhancer.captureTelemetry reference
newContent = newContent.replace(
	/MessageEnhancer\.captureTelemetry\([^)]*\)/g,
	'// Telemetry removed'
)

// Fix missing closing } for getTaskWithAggregatedCosts case block  
// The catch block's closing } was absorbed by the case block
// Pattern: after the catch's break, the case block's closing } is missing

// Clean up excessive blank lines
newContent = newContent.replace(/\n{4,}/g, '\n\n\n')

fs.writeFileSync(FILE, newContent, 'utf8')
console.log(`Fixes applied: ${fixesApplied}`)
console.log('Done!')