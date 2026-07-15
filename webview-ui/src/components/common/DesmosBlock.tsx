/**
 * DesmosBlock Component
 *
 * Renders interactive function curves using mathjs + manual SVG rendering.
 * This is a fully CSP-compatible implementation with no eval, no dynamic workers.
 * Triggered by `desmos` code blocks in Markdown responses.
 *
 * @module components/common/DesmosBlock
 */

import { useEffect, useRef, useState, useCallback } from "react"
import styled from "styled-components"
import { create, all } from "mathjs"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useCopyToClipboard } from "@src/utils/clipboard"
import CodeBlock from "./CodeBlock"
import type { DesmosConfig } from "@src/types/desmos"

// Create a mathjs instance (no eval, safe)
const math = create(all, {})

/**
 * Default colors for expressions when no color is specified.
 */
const DEFAULT_COLORS = [
	"#c74440", // red
	"#2d70b3", // blue
	"#388c46", // green
	"#6042a0", // purple
	"#fa7e19", // orange
	"#000000", // black
]

/**
 * Convert LaTeX expression to mathjs-compatible format.
 */
function latexToMathjs(latex: string): string {
	let expr = latex.trim()

	// Remove "y=" or "r=" prefix if present
	expr = expr.replace(/^[yr]\s*=\s*/, "")

	// Convert LaTeX functions to mathjs equivalents
	// IMPORTANT: \{ and \} must be converted BEFORE piecewise detection
	const replacements: [RegExp, string][] = [
		// Handle escaped braces first (Desmos piecewise syntax: \{...\})
		[/\\{/g, "{"],
		[/\\}/g, "}"],
		// Handle exponent grouping: ^{expr} -> ^(expr)
		[/\^{([^}]+)}/g, "^($1)"],
		// LaTeX function names
		[/\\sin/g, "sin"],
		[/\\cos/g, "cos"],
		[/\\tan/g, "tan"],
		[/\\asin/g, "asin"],
		[/\\acos/g, "acos"],
		[/\\atan/g, "atan"],
		[/\\sinh/g, "sinh"],
		[/\\cosh/g, "cosh"],
		[/\\tanh/g, "tanh"],
		[/\\ln/g, "log"],
		[/\\log/g, "log10"],
		[/\\sqrt\{([^}]+)\}/g, "sqrt($1)"],
		[/\\sqrt\s*(\w+)/g, "sqrt($1)"],
		[/\\pi/g, "pi"],
		[/\\theta/g, "theta"],
		[/\\cdot/g, "*"],
		[/\\times/g, "*"],
		[/\\div/g, "/"],
		[/\\left\(/g, "("],
		[/\\right\)/g, ")"],
		[/\\left\[/g, "["],
		[/\\right\]/g, "]"],
		[/\\left\|/g, "abs("],
		[/\\right\|/g, ")"],
		[/\^(\d+)/g, "^$1"],
		[/\\frac\{([^}]+)\}\{([^}]+)\}/g, "(($1)/($2))"],
		[/\\e/g, "e"],
	]

	for (const [pattern, replacement] of replacements) {
		expr = expr.replace(pattern, replacement)
	}

	// Handle implicit multiplication: 2x -> 2*x, x( -> x*(
	expr = expr.replace(/(\d)([a-zA-Z(])/g, "$1*$2")
	expr = expr.replace(/([a-zA-Z)])(\d)/g, "$1*$2")
	expr = expr.replace(/\)(\()/g, ")*(")
	expr = expr.replace(/\)([a-zA-Z])/g, ")*$1")

	// Handle piecewise functions: {condition: expr, condition: expr}
	// Convert to mathjs conditional: condition ? expr : (condition ? expr : default)
	if (expr.includes("{") && expr.includes(":")) {
		expr = convertPiecewise(expr)
	}

	return expr
}

/**
 * Convert piecewise LaTeX notation to mathjs conditional expressions.
 */
function convertPiecewise(expr: string): string {
	const inner = expr.replace(/^\{|\}$/g, "").trim()

	const parts: string[] = []
	let depth = 0
	let current = ""
	for (const char of inner) {
		if (char === "{") depth++
		else if (char === "}") depth--
		else if (char === "," && depth === 0) {
			parts.push(current.trim())
			current = ""
			continue
		}
		current += char
	}
	if (current.trim()) parts.push(current.trim())

	const conditions: { cond: string; expr: string }[] = []
	for (const part of parts) {
		const colonIdx = part.indexOf(":")
		if (colonIdx === -1) continue
		const cond = part.slice(0, colonIdx).trim()
		const exprPart = part.slice(colonIdx + 1).trim()
		conditions.push({ cond, expr: exprPart })
	}

	if (conditions.length === 0) return expr

	let result = ""
	for (let i = 0; i < conditions.length; i++) {
		const { cond, expr: exprPart } = conditions[i]
		if (i === 0) {
			result = `${cond} ? ${exprPart} : `
		} else if (i === conditions.length - 1) {
			result += `(${cond} ? ${exprPart} : 0)`
		} else {
			result += `(${cond} ? ${exprPart} : `
		}
	}

	for (let i = 0; i < conditions.length - 2; i++) {
		result += ")"
	}

	return result
}

/**
 * Validate the Desmos configuration.
 */
function validateConfig(config: unknown): { valid: boolean; error?: string; config?: DesmosConfig } {
	if (!config || typeof config !== "object") {
		return { valid: false, error: "Configuration must be a JSON object" }
	}

	const cfg = config as Record<string, unknown>

	if (cfg.version !== 1) {
		return { valid: false, error: "version must be 1" }
	}

	if (!Array.isArray(cfg.expressions) || cfg.expressions.length === 0) {
		return { valid: false, error: "expressions must be a non-empty array" }
	}

	for (let i = 0; i < cfg.expressions.length; i++) {
		const expr = cfg.expressions[i]
		if (!expr || typeof expr !== "object") {
			return { valid: false, error: `expressions[${i}] must be an object` }
		}
		if (typeof expr.latex !== "string" || expr.latex.trim() === "") {
			return { valid: false, error: `expressions[${i}].latex must be a non-empty string` }
		}
	}

	if (cfg.viewport !== undefined) {
		if (!cfg.viewport || typeof cfg.viewport !== "object") {
			return { valid: false, error: "viewport must be an object" }
		}
		const vp = cfg.viewport as Record<string, unknown>
		if (vp.xmin !== undefined && typeof vp.xmin !== "number") {
			return { valid: false, error: "viewport.xmin must be a number" }
		}
		if (vp.xmax !== undefined && typeof vp.xmax !== "number") {
			return { valid: false, error: "viewport.xmax must be a number" }
		}
		if (vp.ymin !== undefined && typeof vp.ymin !== "number") {
			return { valid: false, error: "viewport.ymin must be a number" }
		}
		if (vp.ymax !== undefined && typeof vp.ymax !== "number") {
			return { valid: false, error: "viewport.ymax must be a number" }
		}
		if (typeof vp.xmin === "number" && typeof vp.xmax === "number" && vp.xmin >= vp.xmax) {
			return { valid: false, error: "viewport.xmin must be less than viewport.xmax" }
		}
		if (typeof vp.ymin === "number" && typeof vp.ymax === "number" && vp.ymin >= vp.ymax) {
			return { valid: false, error: "viewport.ymin must be less than viewport.ymax" }
		}
	}

	return { valid: true, config: cfg as unknown as DesmosConfig }
}

/**
 * Build a smooth SVG path from points using Catmull-Rom spline -> Bezier conversion.
 * Produces a visually smooth curve instead of straight line segments.
 */
function buildSmoothPath(
	points: { x: number; y: number }[],
	xToSvg: (x: number) => number,
	yToSvg: (y: number) => number,
): string {
	if (points.length < 2) return ""

	const svgPoints = points.map((p) => ({ x: xToSvg(p.x), y: yToSvg(p.y) }))
	let path = `M ${svgPoints[0].x.toFixed(2)} ${svgPoints[0].y.toFixed(2)}`

	for (let i = 0; i < svgPoints.length - 1; i++) {
		const p0 = svgPoints[i - 1] || svgPoints[i]
		const p1 = svgPoints[i]
		const p2 = svgPoints[i + 1]
		const p3 = svgPoints[i + 2] || p2

		// Catmull-Rom to Bezier conversion
		const cp1x = p1.x + (p2.x - p0.x) / 6
		const cp1y = p1.y + (p2.y - p0.y) / 6
		const cp2x = p2.x - (p3.x - p1.x) / 6
		const cp2y = p2.y - (p3.y - p1.y) / 6

		path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
	}

	return path
}

interface DesmosBlockProps {
	code: string
}

// SVG dimensions
const SVG_WIDTH = 600
const SVG_HEIGHT = 300
const PADDING = { top: 20, right: 20, bottom: 40, left: 50 }
const SAMPLE_COUNT = 500

export default function DesmosBlock({ code }: DesmosBlockProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isErrorExpanded, setIsErrorExpanded] = useState(false)
	const [config, setConfig] = useState<DesmosConfig | null>(null)
	const [svgContent, setSvgContent] = useState<string>("")
	const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()
	const { t } = useAppTranslation()

	// Parse and validate the configuration
	useEffect(() => {
		try {
			const parsed = JSON.parse(code)
			const validation = validateConfig(parsed)
			if (!validation.valid) {
				setError(validation.error || "Invalid configuration")
				setIsLoading(false)
				return
			}
			setConfig(validation.config!)
			setError(null)
		} catch (e) {
			setError(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`)
			setIsLoading(false)
		}
	}, [code])

	// Render plot using mathjs + manual SVG
	useEffect(() => {
		if (!config) return

		let destroyed = false

		const renderPlot = async () => {
			try {
				setIsLoading(true)

				const xmin = config.viewport?.xmin ?? -10
				const xmax = config.viewport?.xmax ?? 10
				const ymin = config.viewport?.ymin ?? -10
				const ymax = config.viewport?.ymax ?? 10

				const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right
				const plotHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom

				// Scale functions: math coords -> SVG coords
				const xToSvg = (x: number) => PADDING.left + ((x - xmin) / (xmax - xmin)) * plotWidth
				const yToSvg = (y: number) => PADDING.top + plotHeight - ((y - ymin) / (ymax - ymin)) * plotHeight

				// Build SVG parts
				const svgParts: string[] = []
	
				// ── Cyberpunk color palette ──
				const CYBER = {
					bgDark: "#0a0e1a",
					bgGrad1: "#0d1117",
					bgGrad2: "#161b2e",
					gridMinor: "#1a2332",
					gridMajor: "#2a3a52",
					axis: "#4a9eff",
					text: "#7a8ba8",
					textBright: "#aabbcc",
					legendBg: "#0d1117",
					legendBorder: "#2a3a52",
					scanline: "#4a9eff",
				}
	
				// ── Defs: gradients, filters, markers ──
				svgParts.push(`<defs>`)
	
				// Neon glow filter (strong)
				svgParts.push(`<filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="3" result="blur1" />
					<feGaussianBlur stdDeviation="6" in="SourceGraphic" result="blur2" />
					<feMerge>
						<feMergeNode in="blur2" />
						<feMergeNode in="blur1" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>`)
	
				// Soft glow for axes
				svgParts.push(`<filter id="axisGlow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="1.5" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>`)
	
				// Neon arrow markers
				svgParts.push(`<marker id="arrowX" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
					<path d="M0,0 L10,5 L0,10 L2,5 Z" fill="${CYBER.axis}" opacity="0.9" />
				</marker>`)
				svgParts.push(`<marker id="arrowY" markerWidth="10" markerHeight="10" refX="5" refY="2" orient="auto">
					<path d="M0,10 L5,0 L10,10 L5,8 Z" fill="${CYBER.axis}" opacity="0.9" />
				</marker>`)
	
				svgParts.push(`</defs>`)
	
				// ── Outer dark background ──
				svgParts.push(`<rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${CYBER.bgDark}" />`)
	
				// ── Plot area transparent / clean background ──
				svgParts.push(`<rect x="${PADDING.left}" y="${PADDING.top}" width="${plotWidth}" height="${plotHeight}" rx="8" ry="8" fill="transparent" />`)
	
				// ── Plot area border (neon outline) ──
				svgParts.push(`<rect x="${PADDING.left}" y="${PADDING.top}" width="${plotWidth}" height="${plotHeight}" rx="8" ry="8" fill="none" stroke="${CYBER.axis}" stroke-width="1" opacity="0.3" />`)
	
				// ── Clip path ──
				svgParts.push(`<clipPath id="plotClip"><rect x="${PADDING.left}" y="${PADDING.top}" width="${plotWidth}" height="${plotHeight}" rx="8" ry="8" /></clipPath>`)
	
				// ── Scanline effect (subtle horizontal lines) ──
				svgParts.push(`<g clip-path="url(#plotClip)" opacity="0.03">`)
				for (let sy = PADDING.top; sy < PADDING.top + plotHeight; sy += 3) {
					svgParts.push(`<line x1="${PADDING.left}" y1="${sy}" x2="${PADDING.left + plotWidth}" y2="${sy}" stroke="${CYBER.scanline}" stroke-width="0.5" />`)
				}
				svgParts.push(`</g>`)

				// ── Grid (semi-transparent, two levels) ──
				if (config.options?.showGrid ?? true) {
					const xRange = xmax - xmin
					const yRange = ymax - ymin
					// Major grid
					const xStep = xRange > 5 ? Math.ceil(xRange / 10) : xRange / 10
					const yStep = yRange > 5 ? Math.ceil(yRange / 10) : yRange / 10
					// Minor grid (half step)
					const xMinorStep = xStep / 2
					const yMinorStep = yStep / 2

					svgParts.push(`<g clip-path="url(#plotClip)">`)

					// Minor grid lines (very dark)
					for (let x = Math.ceil(xmin / xMinorStep) * xMinorStep; x <= xmax; x += xMinorStep) {
						if (Math.abs(x % xStep) < 0.001) continue
						const sx = xToSvg(x)
						svgParts.push(`<line x1="${sx}" y1="${PADDING.top}" x2="${sx}" y2="${PADDING.top + plotHeight}" stroke="${CYBER.gridMinor}" stroke-width="0.5" />`)
					}
					for (let y = Math.ceil(ymin / yMinorStep) * yMinorStep; y <= ymax; y += yMinorStep) {
						if (Math.abs(y % yStep) < 0.001) continue
						const sy = yToSvg(y)
						svgParts.push(`<line x1="${PADDING.left}" y1="${sy}" x2="${PADDING.left + plotWidth}" y2="${sy}" stroke="${CYBER.gridMinor}" stroke-width="0.5" />`)
					}
	
					// Major grid lines (slightly brighter)
					for (let x = Math.ceil(xmin / xStep) * xStep; x <= xmax; x += xStep) {
						const sx = xToSvg(x)
						svgParts.push(`<line x1="${sx}" y1="${PADDING.top}" x2="${sx}" y2="${PADDING.top + plotHeight}" stroke="${CYBER.gridMajor}" stroke-width="0.8" opacity="0.6" />`)
					}
					for (let y = Math.ceil(ymin / yStep) * yStep; y <= ymax; y += yStep) {
						const sy = yToSvg(y)
						svgParts.push(`<line x1="${PADDING.left}" y1="${sy}" x2="${PADDING.left + plotWidth}" y2="${sy}" stroke="${CYBER.gridMajor}" stroke-width="0.8" opacity="0.6" />`)
					}

					svgParts.push(`</g>`)
				}

				// ── Axes with arrows ──
				if (config.options?.showXAxis ?? true) {
					if (ymin <= 0 && ymax >= 0) {
						const sy = yToSvg(0)
						svgParts.push(`<line x1="${PADDING.left}" y1="${sy}" x2="${PADDING.left + plotWidth - 4}" y2="${sy}" stroke="${CYBER.axis}" stroke-width="1.5" opacity="0.8" marker-end="url(#arrowX)" filter="url(#axisGlow)" />`)
					}
				}
				if (config.options?.showYAxis ?? true) {
					if (xmin <= 0 && xmax >= 0) {
						const sx = xToSvg(0)
						svgParts.push(`<line x1="${sx}" y1="${PADDING.top + plotHeight}" x2="${sx}" y2="${PADDING.top + 4}" stroke="${CYBER.axis}" stroke-width="1.5" opacity="0.8" marker-end="url(#arrowY)" filter="url(#axisGlow)" />`)
					}
				}

				// ── Tick labels ──
				svgParts.push(`<g clip-path="url(#plotClip)">`)
				const xRange = xmax - xmin
				const yRange = ymax - ymin
				const xStep = xRange > 5 ? Math.ceil(xRange / 10) : xRange / 10
				const yStep = yRange > 5 ? Math.ceil(yRange / 10) : yRange / 10

				// X tick labels
				for (let x = Math.ceil(xmin / xStep) * xStep; x <= xmax; x += xStep) {
					if (Math.abs(x) < 0.001) continue // Skip origin
					const sx = xToSvg(x)
					const sy = yToSvg(0)
					const labelY = ymin <= 0 && ymax >= 0 ? sy + 14 : PADDING.top + plotHeight + 14
					svgParts.push(`<text x="${sx}" y="${labelY}" text-anchor="middle" fill="${CYBER.text}" font-size="10" font-family="'JetBrains Mono', 'Fira Code', 'Consolas', monospace">${xStep < 1 ? x.toFixed(2) : x.toFixed(0)}</text>`)
				}
				// Y tick labels
				for (let y = Math.ceil(ymin / yStep) * yStep; y <= ymax; y += yStep) {
					if (Math.abs(y) < 0.001) continue
					const sy = yToSvg(y)
					const sx = xToSvg(0)
					const labelX = xmin <= 0 && xmax >= 0 ? sx - 8 : PADDING.left - 8
					svgParts.push(`<text x="${labelX}" y="${sy + 3}" text-anchor="end" fill="${CYBER.text}" font-size="10" font-family="'JetBrains Mono', 'Fira Code', 'Consolas', monospace">${yStep < 1 ? y.toFixed(2) : y.toFixed(0)}</text>`)
				}
				// Origin label
				if ((xmin <= 0 && xmax >= 0) && (ymin <= 0 && ymax >= 0)) {
					const ox = xToSvg(0)
					const oy = yToSvg(0)
					svgParts.push(`<text x="${ox - 10}" y="${oy + 15}" text-anchor="end" fill="${CYBER.text}" font-size="10" font-family="'JetBrains Mono', 'Fira Code', 'Consolas', monospace">0</text>`)
				}
				svgParts.push(`</g>`)

				// ── Axis labels ──
				const xLabel = config.options?.xAxisLabel || "x"
				const yLabel = config.options?.yAxisLabel || "y"
				svgParts.push(`<text x="${PADDING.left + plotWidth / 2}" y="${SVG_HEIGHT - 8}" text-anchor="middle" fill="${CYBER.textBright}" font-size="12" font-weight="600" font-family="'JetBrains Mono', 'Fira Code', 'Consolas', monospace" letter-spacing="2">${xLabel}</text>`)
				svgParts.push(`<text x="14" y="${PADDING.top + plotHeight / 2}" text-anchor="middle" fill="${CYBER.textBright}" font-size="12" font-weight="600" font-family="'JetBrains Mono', 'Fira Code', 'Consolas', monospace" letter-spacing="2" transform="rotate(-90, 14, ${PADDING.top + plotHeight / 2})">${yLabel}</text>`)

				// ── Plot curves with glow and smooth paths ──
				svgParts.push(`<g clip-path="url(#plotClip)">`)

				const legendItems: { color: string; label: string }[] = []

				for (let i = 0; i < config.expressions.length; i++) {
					const expr = config.expressions[i]
					if (expr.hidden) continue

					const color = expr.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
					const mathjsExpr = latexToMathjs(expr.latex)

					let compiled
					try {
						compiled = math.compile(mathjsExpr)
					} catch (e) {
						console.warn(`Failed to compile expression: ${mathjsExpr}`, e)
						continue
					}

					// Sample points
					const points: { x: number; y: number }[] = []
					const dx = (xmax - xmin) / SAMPLE_COUNT

					for (let j = 0; j <= SAMPLE_COUNT; j++) {
						const x = xmin + j * dx
						let y: number
						try {
							const result = compiled.evaluate({ x })
							y = typeof result === "number" ? result : NaN
						} catch {
							y = NaN
						}

						if (isNaN(y) || !isFinite(y)) {
							points.push({ x, y: NaN }) // Gap marker
							continue
						}

						const yClamped = Math.max(ymin - (ymax - ymin), Math.min(ymax + (ymax - ymin), y))
						points.push({ x, y: yClamped })
					}

					// Build smooth path using Catmull-Rom -> Bezier conversion
					const pathSegments: string[] = []
					let currentSegment: { x: number; y: number }[] = []

					for (const pt of points) {
						if (isNaN(pt.y)) {
							// Flush current segment
							if (currentSegment.length > 1) {
								pathSegments.push(buildSmoothPath(currentSegment, xToSvg, yToSvg))
							}
							currentSegment = []
						} else {
							currentSegment.push(pt)
						}
					}
					if (currentSegment.length > 1) {
						pathSegments.push(buildSmoothPath(currentSegment, xToSvg, yToSvg))
					}

					const pathData = pathSegments.join(" ")
					const dashArray = expr.lineStyle?.dashed ? 'stroke-dasharray="6,4"' : ""
					const strokeWidth = expr.lineStyle?.width ?? 2.5
					const opacity = expr.lineStyle?.opacity ?? 1

					// Outer glow (wide, very transparent)
					svgParts.push(`<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth + 8}" opacity="${opacity * 0.08}" stroke-linecap="round" stroke-linejoin="round" ${dashArray} />`)
	
					// Mid glow
					svgParts.push(`<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth + 4}" opacity="${opacity * 0.2}" stroke-linecap="round" stroke-linejoin="round" ${dashArray} />`)
	
					// Inner glow
					svgParts.push(`<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth + 1}" opacity="${opacity * 0.5}" stroke-linecap="round" stroke-linejoin="round" ${dashArray} />`)
	
					// Main curve (bright core)
					svgParts.push(`<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" ${dashArray} />`)
	
					// White hot core
					svgParts.push(`<path d="${pathData}" fill="none" stroke="#ffffff" stroke-width="${Math.max(0.5, strokeWidth - 1.5)}" opacity="${opacity * 0.4}" stroke-linecap="round" stroke-linejoin="round" ${dashArray} />`)

					// Collect legend item
					if (expr.label) {
						legendItems.push({ color, label: expr.label })
					}
				}

				svgParts.push(`</g>`)

				// ── Legend ──
				if (legendItems.length > 0) {
					const legendX = PADDING.left + plotWidth - 10
					const legendY = PADDING.top + 10
					const legendHeight = legendItems.length * 20 + 8
					const legendWidth = 100

					svgParts.push(`<rect x="${legendX - legendWidth}" y="${legendY}" width="${legendWidth}" height="${legendHeight}" rx="4" ry="4" fill="${CYBER.legendBg}" fill-opacity="0.85" stroke="${CYBER.legendBorder}" stroke-width="1" />`)
	
					legendItems.forEach((item, idx) => {
						const ly = legendY + 18 + idx * 22
						svgParts.push(`<line x1="${legendX - legendWidth + 10}" y1="${ly}" x2="${legendX - legendWidth + 28}" y2="${ly}" stroke="${item.color}" stroke-width="3" stroke-linecap="round" opacity="0.4" />`)
						svgParts.push(`<line x1="${legendX - legendWidth + 10}" y1="${ly}" x2="${legendX - legendWidth + 28}" y2="${ly}" stroke="${item.color}" stroke-width="2" stroke-linecap="round" />`)
						svgParts.push(`<text x="${legendX - legendWidth + 34}" y="${ly + 4}" fill="${CYBER.textBright}" font-size="11" font-family="'JetBrains Mono', 'Fira Code', 'Consolas', monospace">${item.label}</text>`)
					})
				}

				if (!destroyed) {
					setSvgContent(svgParts.join("\n"))
					setIsLoading(false)
				}
			} catch (e) {
				if (!destroyed) {
					setError(`Failed to render plot: ${e instanceof Error ? e.message : String(e)}`)
					setIsLoading(false)
				}
			}
		}

		renderPlot()

		return () => {
			destroyed = true
		}
	}, [config])

	// Export screenshot as SVG
	const handleExport = useCallback(() => {
		if (!containerRef.current) return

		try {
			const svgElement = containerRef.current.querySelector("svg")
			if (!svgElement) return

			const svgClone = svgElement.cloneNode(true) as SVGElement
			const serializer = new XMLSerializer()
			const svgString = serializer.serializeToString(svgClone)
			const encodedSvg = encodeURIComponent(svgString)
			const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`

			vscode.postMessage({
				type: "openImage",
				text: dataUrl,
			})
		} catch (e) {
			console.error("Failed to export screenshot:", e)
		}
	}, [])

	// Copy configuration
	const handleCopy = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			const content = config
				? `\`\`\`desmos\n${JSON.stringify(config, null, 2)}\n\`\`\``
				: code
			copyWithFeedback(content, e)
		},
		[config, code, copyWithFeedback],
	)

	return (
		<DesmosBlockContainer>
			{config?.title && (
				<PanelHeader>
					<PanelKicker>PLOT-01</PanelKicker>
					<PanelTitleGroup>
						<Title>{config.title}</Title>
						<PanelSubtitle>FUNCTION ANALYSIS HUD</PanelSubtitle>
					</PanelTitleGroup>
					<PanelStatus>LIVE</PanelStatus>
				</PanelHeader>
			)}

			{isLoading && <LoadingMessage>{t("common:desmos.loading") || "Loading plot..."}</LoadingMessage>}

			{error ? (
				<ErrorContainer>
					<ErrorHeader
						onClick={() => setIsErrorExpanded(!isErrorExpanded)}
						$isExpanded={isErrorExpanded}>
						<ErrorInfo>
							<WarningIcon className="codicon codicon-warning" />
							<ErrorTitle>{t("common:desmos.render_error") || "Failed to render function"}</ErrorTitle>
						</ErrorInfo>
						<ErrorActions>
							<CopyButton onClick={handleCopy}>
								<span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`} />
							</CopyButton>
							<span className={`codicon codicon-chevron-${isErrorExpanded ? "up" : "down"}`} />
						</ErrorActions>
					</ErrorHeader>
					{isErrorExpanded && (
						<ErrorDetails>
							<ErrorMessage>{error}</ErrorMessage>
							<CodeBlock language="json" source={code} />
						</ErrorDetails>
					)}
				</ErrorContainer>
			) : (
				<PlotContainer $isLoading={isLoading}>
					<HudChromeTop />
					<HudChromeBottom />
					<PlotViewport ref={containerRef}>
						<svg
							width="100%"
							height={SVG_HEIGHT}
							viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
							style={{ maxWidth: "100%", display: "block" }}
							dangerouslySetInnerHTML={{ __html: svgContent }}
						/>
					</PlotViewport>
					<Toolbar>
						<ToolbarMeta>
							<span>ANALYTICS</span>
							<span>SVG</span>
						</ToolbarMeta>
						<ToolbarButtons>
						<ToolbarButton onClick={handleExport} title={t("common:desmos.export") || "Export as SVG"}>
							<span className="codicon codicon-device-camera" />
						</ToolbarButton>
						<ToolbarButton onClick={handleCopy} title={t("common:desmos.copy") || "Copy configuration"}>
							<span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`} />
						</ToolbarButton>
						</ToolbarButtons>
					</Toolbar>
				</PlotContainer>
			)}
		</DesmosBlockContainer>
	)
}

// Styled components
const DesmosBlockContainer = styled.div`
	position: relative;
	margin: 8px 0;
	border: 1px solid color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
	border-radius: 10px;
	overflow: hidden;
	background: linear-gradient(180deg, rgba(7, 11, 20, 0.96), rgba(8, 12, 24, 0.98));
	box-shadow:
		0 0 0 1px rgba(92, 139, 255, 0.08) inset,
		0 10px 30px rgba(0, 0, 0, 0.35),
		0 0 24px rgba(74, 158, 255, 0.08);
`

const PanelHeader = styled.div`
	display: grid;
	grid-template-columns: auto 1fr auto;
	align-items: center;
	gap: 10px;
	padding: 8px 12px 6px;
	border-bottom: 1px solid rgba(74, 158, 255, 0.12);
	background:
		linear-gradient(90deg, rgba(74, 158, 255, 0.08), transparent 18%),
		linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0));
`

const PanelKicker = styled.div`
	font-size: 10px;
	line-height: 1;
	letter-spacing: 1.8px;
	font-weight: 700;
	color: #59d6ff;
	padding: 4px 6px;
	border: 1px solid rgba(89, 214, 255, 0.25);
	border-radius: 999px;
	background: rgba(89, 214, 255, 0.08);
`

const PanelTitleGroup = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
`

const Title = styled.div`
	font-weight: 600;
	font-size: 12px;
	line-height: 1.2;
	letter-spacing: 0.4px;
	color: #f4f8ff;
`

const PanelSubtitle = styled.div`
	font-size: 10px;
	line-height: 1;
	letter-spacing: 1.6px;
	text-transform: uppercase;
	color: rgba(170, 187, 204, 0.72);
`

const PanelStatus = styled.div`
	font-size: 10px;
	line-height: 1;
	letter-spacing: 1.6px;
	font-weight: 700;
	color: #8bffb0;
	padding: 4px 6px;
	border-radius: 999px;
	background: rgba(139, 255, 176, 0.08);
	border: 1px solid rgba(139, 255, 176, 0.18);
`

const LoadingMessage = styled.div`
	padding: 18px 16px;
	text-align: center;
	color: var(--vscode-descriptionForeground);
	font-style: italic;
	font-size: 0.9em;
`

const ErrorContainer = styled.div`
	background: var(--vscode-editor-background);
`

const ErrorHeader = styled.div<{ $isExpanded: boolean }>`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	cursor: pointer;
	border-bottom: ${(props) =>
		props.$isExpanded ? "1px solid var(--vscode-editorGroup-border)" : "none"};

	&:hover {
		background: var(--vscode-list-hoverBackground);
	}
`

const ErrorInfo = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`

const WarningIcon = styled.span`
	color: var(--vscode-editorWarning-foreground);
	font-size: 16px;
`

const ErrorTitle = styled.span`
	font-weight: 500;
	color: var(--vscode-foreground);
`

const ErrorActions = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
`

const CopyButton = styled.button`
	padding: 4px;
	color: var(--vscode-editor-foreground);
	background: transparent;
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		opacity: 0.8;
	}
`

const ErrorDetails = styled.div`
	padding: 12px;
`

const ErrorMessage = styled.div`
	margin-bottom: 8px;
	color: var(--vscode-descriptionForeground);
	font-size: 0.9em;
`

const PlotContainer = styled.div<{ $isLoading: boolean }>`
	position: relative;
	opacity: ${(props) => (props.$isLoading ? 0.3 : 1)};
	transition: opacity 0.2s ease;
	padding: 8px 8px 10px;
	background:
		radial-gradient(circle at top right, rgba(122, 68, 255, 0.16), transparent 28%),
		radial-gradient(circle at left center, rgba(0, 224, 255, 0.12), transparent 24%),
		linear-gradient(180deg, rgba(10, 14, 26, 0.98), rgba(8, 12, 24, 0.98));
`

const PlotViewport = styled.div`
	position: relative;
	border-radius: 10px;
	overflow: hidden;
	background: rgba(5, 8, 16, 0.85);
	min-height: 320px;
	box-shadow:
		inset 0 0 0 1px rgba(74, 158, 255, 0.14),
		inset 0 0 40px rgba(74, 158, 255, 0.05);
`

const HudChromeTop = styled.div`
	position: absolute;
	top: 8px;
	left: 12px;
	width: 120px;
	height: 1px;
	background: linear-gradient(90deg, rgba(89, 214, 255, 0.8), transparent);
	z-index: 2;
	pointer-events: none;
`

const HudChromeBottom = styled.div`
	position: absolute;
	bottom: 10px;
	right: 12px;
	width: 140px;
	height: 1px;
	background: linear-gradient(90deg, transparent, rgba(255, 84, 122, 0.75));
	z-index: 2;
	pointer-events: none;
`

const Toolbar = styled.div`
	position: absolute;
	top: 16px;
	right: 16px;
	display: flex;
	align-items: center;
	gap: 10px;
	opacity: 0;
	transition: opacity 0.2s ease;
	padding: 6px 8px;
	border-radius: 8px;
	background: rgba(6, 10, 18, 0.72);
	backdrop-filter: blur(10px);
	border: 1px solid rgba(74, 158, 255, 0.14);

	${PlotContainer}:hover & {
		opacity: 1;
	}
`

const ToolbarMeta = styled.div`
	display: flex;
	gap: 8px;
	font-size: 10px;
	letter-spacing: 1.4px;
	text-transform: uppercase;
	color: rgba(170, 187, 204, 0.7);
`

const ToolbarButtons = styled.div`
	display: flex;
	gap: 4px;
`

const ToolbarButton = styled.button`
	padding: 6px;
	background: rgba(74, 158, 255, 0.12);
	color: #d6ecff;
	border: 1px solid rgba(74, 158, 255, 0.16);
	border-radius: 6px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		background: rgba(74, 158, 255, 0.2);
		box-shadow: 0 0 16px rgba(74, 158, 255, 0.15);
	}
`
