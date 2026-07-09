/**
 * Webview Theme System Types
 *
 * Defines the interface for custom themes that override the default
 * VSCode-derived colors in the webview UI.
 *
 * @module themes/types
 */

/**
 * Semantic CSS variable names used by the webview UI.
 * These map to the CSS custom properties defined in `:root` within index.css.
 */
export interface ThemeColors {
	/** Main background color */
	background: string
	/** Main text color */
	foreground: string
	/** Card/panel background */
	card: string
	/** Card/panel text color */
	"card-foreground": string
	/** Popover/dropdown background */
	popover: string
	/** Popover/dropdown text color */
	"popover-foreground": string
	/** Primary button/accent color */
	primary: string
	/** Primary button text color */
	"primary-foreground": string
	/** Secondary button background */
	secondary: string
	/** Secondary button text color */
	"secondary-foreground": string
	/** Muted/disabled text color */
	muted: string
	/** Muted description text color */
	"muted-foreground": string
	/** Hover/accent background */
	accent: string
	/** Hover/accent text color */
	"accent-foreground": string
	/** Error/destructive color */
	destructive: string
	/** Error/destructive text color */
	"destructive-foreground": string
	/** Border color */
	border: string
	/** Input field background */
	input: string
	/** Focus ring color */
	ring: string
}

/**
 * A complete theme definition.
 */
export interface ThemeDefinition {
	/** Unique identifier for the theme */
	id: string
	/** Human-readable display name */
	name: string
	/** Optional description */
	description?: string
	/**
	 * Semantic color overrides (shadcn/ui tokens).
	 * When `undefined` or empty, the theme uses VSCode's built-in color variables.
	 */
	colors?: Partial<ThemeColors>
	/**
	 * Direct `--vscode-*` CSS variable overrides.
	 * Keys are the variable names WITHOUT the `--` prefix (e.g., `"editor-background"`).
	 * Values are CSS color strings.
	 *
	 * These override the VSCode-injected variables within the webview only,
	 * so components that directly reference `var(--vscode-*)` will also
	 * pick up the custom theme colors.
	 */
	vscodeColors?: Record<string, string>
}

/**
 * Available theme IDs.
 */
export type ThemeId = "none" | "jellyfish"

/**
 * Default theme ID.
 */
export const DEFAULT_THEME_ID: ThemeId = "none"
