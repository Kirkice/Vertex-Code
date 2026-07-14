/**
 * DesmosBlock Component
 *
 * Renders interactive function curves using the Desmos Graphing Calculator API.
 * Triggered by `desmos` code blocks in Markdown responses.
 *
 * @module components/common/DesmosBlock
 */

import { useEffect, useRef, useState, useCallback } from "react"
import styled from "styled-components"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useCopyToClipboard } from "@src/utils/clipboard"
import CodeBlock from "./CodeBlock"
import type { DesmosConfig, DesmosCalculator, DesmosExpression } from "@src/types/desmos"

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
 * Load the Desmos API script if not already loaded.
 */
function loadDesmosApi(scriptSrc?: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (window.Desmos) {
			resolve()
			return
		}

		const script = document.createElement("script")
		script.src = scriptSrc || "/desmos/calculator.js"
		script.async = true
		script.onload = () => resolve()
		script.onerror = () => reject(new Error("Failed to load Desmos API"))
		document.head.appendChild(script)
	})
}

/**
 * Validate the Desmos configuration.
 */
function validateConfig(config: unknown): { valid: boolean; error?: string; config?: DesmosConfig } {
	if (!config || typeof config !== "object") {
		return { valid: false, error: "Configuration must be a JSON object" }
	}

	const cfg = config as Record<string, unknown>

	// Check version
	if (cfg.version !== 1) {
		return { valid: false, error: "version must be 1" }
	}

	// Check expressions
	if (!Array.isArray(cfg.expressions) || cfg.expressions.length === 0) {
		return { valid: false, error: "expressions must be a non-empty array" }
	}

	// Validate each expression
	for (let i = 0; i < cfg.expressions.length; i++) {
		const expr = cfg.expressions[i]
		if (!expr || typeof expr !== "object") {
			return { valid: false, error: `expressions[${i}] must be an object` }
		}
		if (typeof expr.latex !== "string" || expr.latex.trim() === "") {
			return { valid: false, error: `expressions[${i}].latex must be a non-empty string` }
		}
	}

	// Validate viewport if present
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
		if (
			typeof vp.xmin === "number" &&
			typeof vp.xmax === "number" &&
			vp.xmin >= vp.xmax
		) {
			return { valid: false, error: "viewport.xmin must be less than viewport.xmax" }
		}
		if (
			typeof vp.ymin === "number" &&
			typeof vp.ymax === "number" &&
			vp.ymin >= vp.ymax
		) {
			return { valid: false, error: "viewport.ymin must be less than viewport.ymax" }
		}
	}

	return { valid: true, config: cfg as unknown as DesmosConfig }
}

interface DesmosBlockProps {
	code: string
}

export default function DesmosBlock({ code }: DesmosBlockProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const calculatorRef = useRef<DesmosCalculator | null>(null)
	const { desmosScriptUri } = useExtensionState()
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [isErrorExpanded, setIsErrorExpanded] = useState(false)
	const [config, setConfig] = useState<DesmosConfig | null>(null)
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

	// Initialize Desmos calculator
	useEffect(() => {
		if (!config || !containerRef.current) return

		let destroyed = false

		const initCalculator = async () => {
			try {
				setIsLoading(true)

				// Load Desmos API
				await loadDesmosApi(desmosScriptUri)

				if (destroyed || !containerRef.current) return

				// Create calculator
				const calculator = window.Desmos!.GraphingCalculator(containerRef.current, {
					keypad: false,
					expressions: false,
					settingsMenu: false,
					zoomButtons: true,
					lockViewport: config.options?.lockViewport ?? false,
				})

				if (destroyed) {
					calculator.destroy()
					return
				}

				calculatorRef.current = calculator

				// Set graph settings
				calculator.setGraphSettings({
					showGrid: config.options?.showGrid ?? true,
					showXAxis: config.options?.showXAxis ?? true,
					showYAxis: config.options?.showYAxis ?? true,
					xAxisLabel: config.options?.xAxisLabel,
					yAxisLabel: config.options?.yAxisLabel,
					lockViewport: config.options?.lockViewport ?? false,
				})

				// Set viewport
				if (config.viewport) {
					calculator.setMathBounds({
						left: config.viewport.xmin ?? -10,
						right: config.viewport.xmax ?? 10,
						top: config.viewport.ymax ?? 10,
						bottom: config.viewport.ymin ?? -10,
					})
				}

				// Add expressions
				config.expressions.forEach((expr, index) => {
					const id = expr.id || `expr-${index}`
					const color = expr.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]

					const exprConfig: Parameters<DesmosCalculator["setExpression"]>[0] = {
						id,
						latex: expr.latex,
						color,
						hidden: expr.hidden ?? false,
					}

					if (expr.lineStyle) {
						exprConfig.lineStyle = {
							width: expr.lineStyle.width,
							opacity: expr.lineStyle.opacity,
							style: expr.lineStyle.dashed ? "DASHED" : "SOLID",
						}
					}

					if (expr.label) {
						exprConfig.label = expr.label
						exprConfig.showLabel = true
					}

					if (expr.parametricDomain) {
						exprConfig.parametricDomain = {
							min: String(expr.parametricDomain.min),
							max: String(expr.parametricDomain.max),
						}
					}

					calculator.setExpression(exprConfig)
				})

				setIsLoading(false)
			} catch (e) {
				if (!destroyed) {
					setError(`Failed to initialize Desmos: ${e instanceof Error ? e.message : String(e)}`)
					setIsLoading(false)
				}
			}
		}

		initCalculator()

		return () => {
			destroyed = true
			if (calculatorRef.current) {
				calculatorRef.current.destroy()
				calculatorRef.current = null
			}
		}
	}, [config, desmosScriptUri])

	// Export screenshot
	const handleExport = useCallback(() => {
		if (!calculatorRef.current) return

		try {
			const screenshot = calculatorRef.current.screenshot({
				width: 800,
				height: 600,
				targetPixelRatio: 2,
			})

			vscode.postMessage({
				type: "openImage",
				text: screenshot,
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
			{config?.title && <Title>{config.title}</Title>}

			{isLoading && <LoadingMessage>{t("common:desmos.loading") || "Loading Desmos..."}</LoadingMessage>}

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
				<CalculatorContainer $isLoading={isLoading}>
					<CalculatorCanvas ref={containerRef} />
					<Toolbar>
						<ToolbarButton onClick={handleExport} title={t("common:desmos.export") || "Export as PNG"}>
							<span className="codicon codicon-device-camera" />
						</ToolbarButton>
						<ToolbarButton onClick={handleCopy} title={t("common:desmos.copy") || "Copy configuration"}>
							<span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`} />
						</ToolbarButton>
					</Toolbar>
				</CalculatorContainer>
			)}
		</DesmosBlockContainer>
	)
}

// Styled components
const DesmosBlockContainer = styled.div`
	position: relative;
	margin: 8px 0;
	border: 1px solid var(--vscode-panel-border);
	border-radius: 4px;
	overflow: hidden;
`

const Title = styled.div`
	padding: 8px 12px;
	font-weight: 500;
	font-size: 0.9em;
	color: var(--vscode-foreground);
	background: var(--vscode-editor-background);
	border-bottom: 1px solid var(--vscode-panel-border);
`

const LoadingMessage = styled.div`
	padding: 16px;
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

const CalculatorContainer = styled.div<{ $isLoading: boolean }>`
	position: relative;
	opacity: ${(props) => (props.$isLoading ? 0.3 : 1)};
	transition: opacity 0.2s ease;
`

const CalculatorCanvas = styled.div`
	width: 100%;
	height: 300px;
	min-height: 200px;

	/* Desmos calculator styles override */
	& .dcg-calculator {
		height: 100% !important;
	}
`

const Toolbar = styled.div`
	position: absolute;
	top: 8px;
	right: 8px;
	display: flex;
	gap: 4px;
	opacity: 0;
	transition: opacity 0.2s ease;

	${CalculatorContainer}:hover & {
		opacity: 1;
	}
`

const ToolbarButton = styled.button`
	padding: 6px;
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	border: none;
	border-radius: 4px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		background: var(--vscode-button-hoverBackground);
	}
`
