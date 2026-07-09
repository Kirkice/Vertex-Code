/**
 * Built-in Theme Definitions
 *
 * Contains all available webview themes. Each theme defines a set of
 * CSS custom property overrides that replace the default VSCode-derived colors.
 *
 * @module themes/definitions
 */

import type { ThemeDefinition } from "./types"

/**
 * "None" theme — uses VSCode's built-in color variables.
 * No overrides are applied; the webview follows the user's active VSCode theme.
 */
export const noneTheme: ThemeDefinition = {
	id: "none",
	name: "None",
	description: "Follow VSCode theme",
	colors: undefined,
}

/**
 * JellyFish theme — inspired by the JellyFish VSCode theme extension.
 * Deep navy/purple dark background with vibrant neon pink, cyan, and yellow accents.
 *
 * @see https://marketplace.visualstudio.com/items?itemName=PawelBorkar.jellyfish
 */
export const jellyfishTheme: ThemeDefinition = {
	id: "jellyfish",
	name: "JellyFish",
	description: "Cyber CLI dark theme with multi-color neon accents",
	colors: {
		background: "#0A0F14",
		foreground: "#E6F1FF",
		card: "#0F1720",
		"card-foreground": "#E6F1FF",
		popover: "#101922",
		"popover-foreground": "#E6F1FF",
		primary: "#00E5FF",
		"primary-foreground": "#061017",
		secondary: "#13202B",
		"secondary-foreground": "#D7E7F5",
		muted: "#13202B",
		"muted-foreground": "#8AA0B6",
		accent: "#7C5CFF",
		"accent-foreground": "#FFFFFF",
		destructive: "#FF5A5F",
		"destructive-foreground": "#FFF5F5",
		border: "#1E2A36",
		input: "#0E1620",
		ring: "#00E5FF",
	},
	vscodeColors: {
		// Editor / main surface
		"editor-background": "#0A0F14",
		"editor-foreground": "#E6F1FF",
		"foreground": "#E6F1FF",
		"descriptionForeground": "#8AA0B6",
		"disabledForeground": "#5B6B7A",
		"errorForeground": "#FF5A5F",

		// Buttons — primary uses cyan, secondary uses purple
		"button-background": "#00E5FF",
		"button-foreground": "#061017",
		"button-hoverBackground": "#37F0FF",
		"button-secondaryBackground": "#1A1530",
		"button-secondaryForeground": "#C4B5FF",
		"button-secondaryHoverBackground": "#241B40",

		// Inputs / dropdowns — input border uses subtle purple
		"input-background": "#0E1620",
		"input-foreground": "#DDEAF7",
		"input-border": "#2A1F4A",
		"dropdown-background": "#101922",
		"dropdown-foreground": "#E6F1FF",
		"dropdown-border": "#2A1F4A",

		// Lists / selections — hover uses purple tint
		"list-hoverBackground": "#1A1530",
		"list-hoverForeground": "#F4FBFF",
		"list-activeSelectionBackground": "#241B40",
		"list-activeSelectionForeground": "#C4B5FF",
		"list-focusBackground": "#1A1530",

		// Panels / sidebars
		"panel-border": "#1E2A36",
		"sideBar-background": "#0C1218",
		"sideBar-foreground": "#DDEAF7",
		"sideBar-border": "#1B2632",
		"sideBarSectionHeader-background": "#0F1720",
		"sideBarSectionHeader-foreground": "#E6F1FF",

		// Badges / focus — badge uses orange for contrast
		"badge-background": "#FF8A3D",
		"badge-foreground": "#1A0F00",
		"focusBorder": "#00E5FF",

		// Links / text — links use pink-magenta
		"textLink-foreground": "#FF6B9D",
		"textLink-activeForeground": "#FF9CB8",
		"textBlockQuote-background": "#0F1720",
		"textCodeBlock-background": "#0B141D",
		"textBlockQuote-border": "#7C5CFF",
		"textPreformat-foreground": "#FFB020",
		"textPreformat-background": "#0B141D",

		// Editor groups / borders
		"editorGroup-border": "#1E2A36",
		"editorGroupHeader-tabsBackground": "#0A0F14",

		// Notifications / hover — notification border uses orange
		"notifications-background": "#101922",
		"notifications-foreground": "#E6F1FF",
		"notifications-border": "#FF8A3D",
		"editorHoverWidget-background": "#101922F2",
		"editorHoverWidget-foreground": "#E6F1FF",
		"editorHoverWidget-border": "#7C5CFF",

		// Charts / status colors — full spectrum
		"charts-green": "#00FF9C",
		"charts-red": "#FF5A5F",
		"charts-yellow": "#FFB020",
		"charts-blue": "#00E5FF",
		"charts-orange": "#FF8A3D",
		"charts-purple": "#7C5CFF",

		// Terminal — green text on dark
		"terminal-foreground": "#00FF9C",
		"terminal-selectionBackground": "#7C5CFF33",

		// Diff editor — green/red
		"diffEditor-insertedTextBackground": "#00FF9C22",
		"diffEditor-removedTextBackground": "#FF5A5F22",

		// Banner — uses purple
		"banner-background": "#1A1530",
		"banner-foreground": "#C4B5FF",

		// Toolbar — hover uses purple tint
		"toolbar-hoverBackground": "#1A1530",

		// Input validation — multi-color
		"inputValidation-errorBackground": "#FF5A5F1F",
		"inputValidation-errorBorder": "#FF5A5F",
		"inputValidation-warningBackground": "#FFB0201F",
		"inputValidation-warningBorder": "#FFB020",
		"inputValidation-infoBackground": "#00E5FF1F",
		"inputValidation-infoBorder": "#00E5FF",

		// Editor warning/error
		"editorWarning-foreground": "#FFB020",
		"editorWarning-background": "#FFB0201F",
		"editorError-foreground": "#FF5A5F",

		// Widget — border uses purple
		"widget-border": "#2A1F4A",
		"widget-shadow": "#00000088",

		// Title bar
		"titleBar-activeForeground": "#C7D8E8",
		"titleBar-inactiveForeground": "#7F93A8",

		// Progress — uses orange
		"progressBar-background": "#FF8A3D",

		// Icon — uses pink-magenta
		"icon-foreground": "#FF6B9D",

		// Menu
		"menu-background": "#101922F2",
		"menu-foreground": "#E6F1FF",

		// Editor line highlight
		"editor-lineHighlightBorder": "#1E2A36",

		// Editor inactive selection
		"editor-inactiveSelectionBackground": "#1A153066",

		// Testing icons
		"testing-iconPassed": "#00FF9C",
		"testing-iconFailed": "#FF5A5F",

		// Symbol icon — method uses purple, string uses orange
		"symbolIcon-methodForeground": "#7C5CFF",
		"stringForeground": "#FFB020",

		// ANSI terminal colors — full neon spectrum
		"terminal-ansiBlack": "#0A0F14",
		"terminal-ansiRed": "#FF5A5F",
		"terminal-ansiGreen": "#00FF9C",
		"terminal-ansiYellow": "#FFB020",
		"terminal-ansiBlue": "#00E5FF",
		"terminal-ansiMagenta": "#FF6B9D",
		"terminal-ansiCyan": "#7C5CFF",
		"terminal-ansiWhite": "#E6F1FF",
		"terminal-ansiBrightBlack": "#5B6B7A",
		"terminal-ansiBrightRed": "#FF8A8E",
		"terminal-ansiBrightGreen": "#4DFFB8",
		"terminal-ansiBrightYellow": "#FFD060",
		"terminal-ansiBrightBlue": "#58F3FF",
		"terminal-ansiBrightMagenta": "#FF9CB8",
		"terminal-ansiBrightCyan": "#A48BFF",
		"terminal-ansiBrightWhite": "#F4FBFF",
	},
}

/**
 * Registry of all available themes, keyed by theme ID.
 */
export const themes: Record<string, ThemeDefinition> = {
	none: noneTheme,
	jellyfish: jellyfishTheme,
}

/**
 * Ordered list of theme IDs for display in the UI selector.
 */
export const themeOrder: string[] = ["none", "jellyfish"]
