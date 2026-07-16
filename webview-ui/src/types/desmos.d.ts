/**
 * Desmos API Type Definitions
 *
 * Type definitions for the Desmos Graphing Calculator API.
 * Used by DesmosBlock component for function curve rendering.
 *
 * @module types/desmos
 */

/**
 * Desmos expression configuration.
 */
export interface DesmosExpression {
	/** Unique identifier for the expression */
	id?: string
	/** LaTeX expression string */
	latex: string
	/** Color for the curve (hex, rgb, or named color) */
	color?: string
	/** Line style configuration */
	lineStyle?: {
		width?: number
		opacity?: number
		dashed?: boolean
	}
	/** Label to display on the curve */
	label?: string
	/** Whether the expression is hidden */
	hidden?: boolean
	/** Parameter domain for parametric equations */
	parametricDomain?: {
		min: number
		max: number
	}
	/** Slider configuration for dynamic parameters */
	slider?: {
		variable: string
		min: number
		max: number
		step?: number
		value?: number
	}
}

export interface DesmosDisplayConfig {
	defaultMode?: "compact" | "expanded"
	allowExpand?: boolean
	editable?: boolean
	persistEdits?: boolean
}

/**
 * Desmos viewport configuration.
 */
export interface DesmosViewport {
	xmin?: number
	xmax?: number
	ymin?: number
	ymax?: number
}

/**
 * Desmos display options.
 */
export interface DesmosOptions {
	showGrid?: boolean
	showXAxis?: boolean
	showYAxis?: boolean
	xAxisLabel?: string
	yAxisLabel?: string
	lockViewport?: boolean
}

/**
 * Desmos configuration for the code block.
 */
export interface DesmosConfig {
	/** Protocol version (must be 1) */
	version: 1
	/** Optional title displayed above the graph */
	title?: string
	/** List of expressions to render */
	expressions: DesmosExpression[]
	/** Viewport configuration */
	viewport?: DesmosViewport
	/** Display options */
	options?: DesmosOptions
	display?: DesmosDisplayConfig
}

/**
 * Desmos Calculator instance interface.
 * This is a subset of the full Desmos API used by DesmosBlock.
 */
export interface DesmosCalculator {
	observe(event: string, callback: () => void): void
	resize(): void
	/** Set an expression */
	setExpression(expr: {
		id: string
		latex: string
		color?: string
		hidden?: boolean
		lineStyle?: {
			width?: number
			opacity?: number
			style?: string
		}
		label?: string
		showLabel?: boolean
		sliderBounds?: {
			min?: string
			max?: string
			step?: string
		}
		parametricDomain?: {
			min: string
			max: string
		}
	}): void

	/** Remove an expression by ID */
	removeExpression(expr: { id: string }): void

	/** Set the viewport */
	setMathBounds(bounds: {
		left?: number
		right?: number
		top?: number
		bottom?: number
	}): void

	/** Update graph settings */
	updateSettings(settings: {
		invertedColors?: boolean
		keypad?: boolean
		expressions?: boolean
		settingsMenu?: boolean
		zoomButtons?: boolean
		showGrid?: boolean
		showXAxis?: boolean
		showYAxis?: boolean
		xAxisLabel?: string
		yAxisLabel?: string
		lockViewport?: boolean
	}): void

	/** Take a screenshot */
	screenshot(opts?: {
		width?: number
		height?: number
		targetPixelRatio?: number
	}): string

	/** Get the current state */
	getState(): any

	/** Set the state */
	setState(state: any): void

	/** Set blank state */
	setBlank(): void

	/** Destroy the calculator */
	destroy(): void
}

/**
 * Desmos namespace (global).
 */
export interface DesmosNamespace {
	GraphingCalculator: (
		element: HTMLElement,
		options?: {
			keypad?: boolean
			expressions?: boolean
			settingsMenu?: boolean
			zoomButtons?: boolean
			lockViewport?: boolean
		},
	) => DesmosCalculator
}

declare global {
	interface Window {
		Desmos?: DesmosNamespace
	}
}
