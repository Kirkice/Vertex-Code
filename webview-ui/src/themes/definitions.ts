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
 * JellyFish theme — inspired by oh-my-pi's elegant purple-gray palette.
 * Purple-tinted gray backgrounds with pink accent and cyan links.
 *
 * Color system derived from oh-my-pi (oklch color space converted to hex):
 * - Purple-gray base (hue 307)
 * - Pink accent for primary actions
 * - Cyan for links and info states
 *
 * @see https://github.com/oh-my-pi/oh-my-pi
 */
export const jellyfishTheme: ThemeDefinition = {
	id: "jellyfish",
	name: "JellyFish",
	description: "Elegant purple-gray theme with pink accents",
	colors: {
		background: "#000000",
		foreground: "#EEEAF4",
		card: "#000000",
		"card-foreground": "#EEEAF4",
		popover: "#000000",
		"popover-foreground": "#EEEAF4",
		primary: "#E84393",
		"primary-foreground": "#2D1525",
		secondary: "#000000",
		"secondary-foreground": "#D7D0E1",
		muted: "#000000",
		"muted-foreground": "#7E7888",
		accent: "#7DD3E8",
		"accent-foreground": "#000000",
		destructive: "#FF3B6B",
		"destructive-foreground": "#F5F3F7",
		border: "#6B4D96",
		input: "#000000",
		ring: "#7DD3E8B3",
	},
	vscodeColors: {
		// Editor / main surface
		"editor-background": "#000000",
		"editor-foreground": "#EEEAF4",
		"foreground": "#EEEAF4",
		"descriptionForeground": "#7E7888",
		"disabledForeground": "#655F70",
		"errorForeground": "#E04545",

		// Buttons — primary uses pink, secondary uses purple-gray
		"button-background": "#E84393",
		"button-foreground": "#2D1525",
		"button-hoverBackground": "#F06AAF",
		"button-secondaryBackground": "#000000",
		"button-secondaryForeground": "#D7D0E1",
		"button-secondaryHoverBackground": "#000000",

		// Inputs / dropdowns
		"input-background": "#000000",
		"input-foreground": "#EEEAF4",
		"input-border": "#6B4D96",
		"dropdown-background": "#000000",
		"dropdown-foreground": "#EEEAF4",
		"dropdown-border": "#6B4D96",

		// Lists / selections
		"list-hoverBackground": "#000000",
		"list-hoverForeground": "#F5F3F7",
		"list-activeSelectionBackground": "#E8439342",
		"list-activeSelectionForeground": "#E84393",
		"list-focusBackground": "#000000",

		// Panels / sidebars
		"panel-border": "#6B4D96",
		"sideBar-background": "#000000",
		"sideBar-foreground": "#D9D2E3",
		"sideBar-border": "#6B4D96",
		"sideBarSectionHeader-background": "#000000",
		"sideBarSectionHeader-foreground": "#EEEAF4",

		// Badges / focus
		"badge-background": "#E84393",
		"badge-foreground": "#2D1525",
		"focusBorder": "#7DD3E8",

		// Links / text — cyan for links
		"textLink-foreground": "#7DD3E8",
		"textLink-activeForeground": "#A5E3F0",
		"textBlockQuote-background": "#000000",
		"textCodeBlock-background": "#000000",
		"textBlockQuote-border": "#7DD3E8",
		"textPreformat-foreground": "#E8C84A",
		"textPreformat-background": "#000000",

		// Editor groups / borders
		"editorGroup-border": "#6B4D96",
		"editorGroupHeader-tabsBackground": "#000000",

		// Notifications / hover
		"notifications-background": "#000000",
		"notifications-foreground": "#EEEAF4",
		"notifications-border": "#E8944A",
		"editorHoverWidget-background": "#000000",
		"editorHoverWidget-foreground": "#EEEAF4",
		"editorHoverWidget-border": "#7DD3E8",

		// Charts / status colors — neon spectrum
		"charts-green": "#00FF9C",
		"charts-red": "#FF3B6B",
		"charts-yellow": "#FFD060",
		"charts-blue": "#00E5FF",
		"charts-orange": "#FF8A3D",
		"charts-purple": "#BF7FFF",

		// Terminal — neon green on dark
		"terminal-foreground": "#00FF9C",
		"terminal-selectionBackground": "#E8439344",

		// Diff editor — neon green/red
		"diffEditor-insertedTextBackground": "#00FF9C22",
		"diffEditor-removedTextBackground": "#FF3B6B22",

		// Banner
		"banner-background": "#000000",
		"banner-foreground": "#D9D2E3",

		// Toolbar
		"toolbar-hoverBackground": "#000000",

		// Input validation
		"inputValidation-errorBackground": "#FF3B6B1F",
		"inputValidation-errorBorder": "#FF3B6B",
		"inputValidation-warningBackground": "#FFD0601F",
		"inputValidation-warningBorder": "#FFD060",
		"inputValidation-infoBackground": "#00E5FF1F",
		"inputValidation-infoBorder": "#00E5FF",

		// Editor warning/error
		"editorWarning-foreground": "#FFD060",
		"editorWarning-background": "#FFD0601F",
		"editorError-foreground": "#FF3B6B",

		// Widget
		"widget-border": "#6B4D96",
		"widget-shadow": "#00000088",

		// Title bar
		"titleBar-activeForeground": "#D9D2E3",
		"titleBar-inactiveForeground": "#7E7888",

		// Progress
		"progressBar-background": "#E8944A",

		// Icon
		"icon-foreground": "#E84393",

		// Menu
		"menu-background": "#000000",
		"menu-foreground": "#EEEAF4",

		// Editor line highlight
		"editor-lineHighlightBorder": "#6B4D96",

		// Editor inactive selection
		"editor-inactiveSelectionBackground": "#000000",

		// Testing icons
		"testing-iconPassed": "#00FF9C",
		"testing-iconFailed": "#FF3B6B",

		// Symbol icon
		"symbolIcon-methodForeground": "#E84393",
		"stringForeground": "#FFD060",

		// ANSI terminal colors — full neon spectrum
		"terminal-ansiBlack": "#0F0C14",
		"terminal-ansiRed": "#FF3B6B",
		"terminal-ansiGreen": "#00FF9C",
		"terminal-ansiYellow": "#FFD060",
		"terminal-ansiBlue": "#00E5FF",
		"terminal-ansiMagenta": "#E84393",
		"terminal-ansiCyan": "#BF7FFF",
		"terminal-ansiWhite": "#EEEAF4",
		"terminal-ansiBrightBlack": "#655F70",
		"terminal-ansiBrightRed": "#FF6A8E",
		"terminal-ansiBrightGreen": "#4DFFB8",
		"terminal-ansiBrightYellow": "#FFE87A",
		"terminal-ansiBrightBlue": "#58F3FF",
		"terminal-ansiBrightMagenta": "#FF6BC8",
		"terminal-ansiBrightCyan": "#D4A8FF",
		"terminal-ansiBrightWhite": "#F5F3F7",
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
