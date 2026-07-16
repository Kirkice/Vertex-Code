import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import styled from "styled-components"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useCopyToClipboard } from "@src/utils/clipboard"
import { loadDesmos } from "@src/utils/desmosLoader"
import type { DesmosCalculator, DesmosConfig } from "@src/types/desmos"
import { useTheme } from "@src/themes/ThemeProvider"

interface DesmosBlockProps { code: string }

function toFallbackConfig(source: string): DesmosConfig | null {
	const withoutDelimiters = source
		.trim()
		.replace(/^\[\s*/, "")
		.replace(/\s*\]$/, "")
		.replace(/^\\\[\s*/, "")
		.replace(/\s*\\\]$/, "")
		.trim()
	const afterLabel = withoutDelimiters.replace(/^.*?[：:]\s*/, "").trim()
	const unwrapped = afterLabel.replace(/^\((.*)\)\s*[。；;]?$/s, "$1").trim()
	const equation = /[a-zA-Z]\s*=\s*[^。；;\n]+/.exec(unwrapped)?.[0]?.trim()
	const latex = equation || (/^[^\s]+$/.test(unwrapped) ? unwrapped : "")

	if (!latex || !/[=<>]/.test(latex)) return null

	// A response such as y=x^a=x^(1/b) is explanatory notation, not a Desmos
	// expression. Retain the first actual equation so Desmos can graph it.
	const parts = latex.split("=")
	const normalizedLatex = parts.length > 2 ? `${parts[0]}=${parts[1]}` : latex
	return { version: 1, expressions: [{ latex: normalizedLatex }] }
}

function parseConfig(code: string): DesmosConfig {
	const normalizedCode = code.trim().replace(/^```(?:json|desmos)?\s*/i, "").replace(/\s*```$/i, "").trim()
	let value: unknown
	try {
		value = JSON.parse(normalizedCode)
	} catch {
		// Models occasionally emit a raw LaTeX expression inside a `desmos`
		// fence instead of the JSON protocol. Accept that form as a safe fallback
		// so a valid curve is still rendered rather than showing a schema error.
		value = toFallbackConfig(normalizedCode)
		if (!value) throw new globalThis.Error("invalid Desmos JSON or LaTeX expression")
	}
	if (value === null || typeof value !== "object") {
		throw new globalThis.Error("Desmos block must contain a JSON object, not null or a primitive value")
	}
	const config = value as Partial<DesmosConfig>
	if (config.version !== 1 || !Array.isArray(config.expressions) || config.expressions.length === 0) {
		throw new globalThis.Error("version must be 1 and expressions must be a non-empty array")
	}
	for (const expression of config.expressions) {
		if (!expression || typeof expression.latex !== "string" || !expression.latex.trim()) {
			throw new globalThis.Error("each expression must contain a non-empty latex string")
		}
	}
	return config as DesmosConfig
}

function preserveJellyfishColor(color: string | undefined, jellyfish: boolean): string | undefined {
	if (!color || !jellyfish || !/^#[0-9a-f]{6}$/i.test(color)) return color

	const red = 255 - Number.parseInt(color.slice(1, 3), 16)
	const green = 255 - Number.parseInt(color.slice(3, 5), 16)
	const blue = 255 - Number.parseInt(color.slice(5, 7), 16)
	return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function isParametricExpression(latex: string): boolean {
	return /^\s*\([^,]+,/.test(latex)
}

export default function DesmosBlock({ code }: DesmosBlockProps) {
	const { desmosScriptUri } = useExtensionState()
	const { t } = useAppTranslation()
	const { themeId } = useTheme()
	const { copyWithFeedback, showCopyFeedback } = useCopyToClipboard()
	const containerRef = useRef<HTMLDivElement>(null)
	const calculatorRef = useRef<DesmosCalculator | null>(null)
	const [config, setConfig] = useState<DesmosConfig | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [expanded, setExpanded] = useState(() => {
		try { return parseConfig(code).display?.defaultMode === "expanded" } catch { return false }
	})
	const [editedState, setEditedState] = useState<unknown>(null)
	const editable = config?.display?.editable !== false
	const jellyfish = themeId === "jellyfish"
	// Desmos' invertedColors mode inverts expression colors as well as the
	// canvas. Feed it complementary neon colors so the rendered result stays
	// maximally bright cyan/pink/purple/green/yellow.
	const jellyfishColors = ["#FF0A00", "#00D429", "#4BB200", "#FF0063", "#0019FF"]

	useEffect(() => {
		try { setConfig(parseConfig(code)); setError(null) }
		catch (cause) { setConfig(null); setError(cause instanceof globalThis.Error ? cause.message : String(cause)) }
	}, [code])

	useEffect(() => {
		if (!config || !containerRef.current) return
		let disposed = false
		let calculator: DesmosCalculator | undefined
		void loadDesmos(desmosScriptUri).then((Desmos) => {
			if (disposed || !containerRef.current) return
			calculator = Desmos.GraphingCalculator(containerRef.current, {
				// These are constructor options in the bundled Desmos API. Recreating
				// the calculator when the mode changes ensures the native expression
				// editor is actually mounted, instead of only changing the canvas size.
				keypad: expanded && editable,
				expressions: expanded && editable,
				settingsMenu: expanded,
				zoomButtons: true,
			})
			calculatorRef.current = calculator
			config.expressions.forEach((expression, index) => {
				const parametricDomain =
					expression.parametricDomain && isParametricExpression(expression.latex)
						? {
							min: String(expression.parametricDomain.min),
							max: String(expression.parametricDomain.max),
						}
						: undefined
				const desmosExpression: Parameters<DesmosCalculator["setExpression"]>[0] = {
					id: expression.id || `expression-${index + 1}`,
					latex: expression.latex,
				}
				const color = preserveJellyfishColor(
					expression.color || (jellyfish ? jellyfishColors[index % jellyfishColors.length] : undefined),
					jellyfish,
				)

				if (color) desmosExpression.color = color
				if (expression.hidden !== undefined) desmosExpression.hidden = expression.hidden
				if (expression.label) {
					desmosExpression.label = expression.label
					desmosExpression.showLabel = true
				}
				if (parametricDomain) desmosExpression.parametricDomain = parametricDomain

				calculator!.setExpression(desmosExpression)
			})
			config.expressions.forEach((expression, index) => {
				if (!expression.slider) return
				const sliderBounds: NonNullable<Parameters<DesmosCalculator["setExpression"]>[0]["sliderBounds"]> = {
					min: String(expression.slider.min),
					max: String(expression.slider.max),
				}
				if (expression.slider.step !== undefined) sliderBounds.step = String(expression.slider.step)
				calculator!.setExpression({
					id: `${expression.id || `expression-${index + 1}`}-slider`,
					latex: `${expression.slider.variable}=${expression.slider.value ?? expression.slider.min}`,
					sliderBounds,
				})
			})
			if (config.viewport) calculator.setMathBounds({ left: config.viewport.xmin, right: config.viewport.xmax, bottom: config.viewport.ymin, top: config.viewport.ymax })
			calculator.updateSettings({
				...config.options,
				invertedColors: jellyfish,
				keypad: expanded && editable,
				expressions: expanded && editable,
				settingsMenu: expanded,
				zoomButtons: true,
			})
			calculator.observe("change", () => setEditedState(calculator?.getState()))
		}).catch((cause) => { if (!disposed) setError(cause instanceof globalThis.Error ? cause.message : String(cause)) })
		return () => { disposed = true; calculator?.destroy(); calculatorRef.current = null }
	}, [config, desmosScriptUri, editable, expanded, jellyfish, themeId])

	useEffect(() => {
		calculatorRef.current?.updateSettings({
			invertedColors: jellyfish,
			keypad: expanded && editable,
			expressions: expanded && editable,
			settingsMenu: expanded,
			zoomButtons: true,
		})
		const timer = window.setTimeout(() => calculatorRef.current?.resize(), 0)
		return () => window.clearTimeout(timer)
	}, [expanded, editable, jellyfish])

	const resize = useCallback(() => calculatorRef.current?.resize(), [])
	useEffect(() => {
		if (typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver(resize)
		if (containerRef.current) observer.observe(containerRef.current)
		return () => observer.disconnect()
	}, [resize])

	const copy = (event: MouseEvent) => copyWithFeedback(`\`\`\`desmos\n${JSON.stringify(editedState || config, null, 2)}\n\`\`\``, event)
	const exportImage = () => {
		const data = calculatorRef.current?.screenshot({ width: 1200, height: expanded ? 800 : 500, targetPixelRatio: 2 })
		if (data) window.open(data, "_blank", "noopener,noreferrer")
	}

	return <Block>
		{config?.title && <Title>{config.title}</Title>}
		{error ? <ErrorMessage>{t("common:desmos.render_error") || "Failed to render function"}: {error}</ErrorMessage> : <Viewport $expanded={expanded} ref={containerRef} />}
		<Actions>
			{config?.display?.allowExpand !== false && <button onClick={() => setExpanded((value) => !value)}>{expanded ? t("common:desmos.collapse") : t("common:desmos.expand")}</button>}
			<button onClick={exportImage}>{t("common:desmos.export")}</button>
			<button onClick={copy}>{showCopyFeedback ? t("common:desmos.copied") : t("common:desmos.copy")}</button>
		</Actions>
	</Block>
}

const Block = styled.div`margin: 8px 0; border: 1px solid var(--vscode-widget-border); border-radius: 6px; overflow: hidden; background: var(--vscode-editor-background);`
const Title = styled.div`padding: 8px 12px; font-weight: 600; border-bottom: 1px solid var(--vscode-widget-border);`
const Viewport = styled.div<{ $expanded: boolean }>`height: ${({ $expanded }) => ($expanded ? "min(720px, 70vh)" : "320px")}; min-height: 220px; width: 100%;`
const Actions = styled.div`display: flex; gap: 6px; justify-content: flex-end; padding: 6px 8px; border-top: 1px solid var(--vscode-widget-border); button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 4px 8px; cursor: pointer; }`
const ErrorMessage = styled.div`padding: 16px; color: var(--vscode-errorForeground);`
