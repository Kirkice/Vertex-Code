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
		background: "#0F0C14",
		foreground: "#EEEAF4",
		card: "#1A1520",
		"card-foreground": "#E8E5ED",
		popover: "#1A1520",
		"popover-foreground": "#E8E5ED",
		primary: "#E84393",
		"primary-foreground": "#2D1525",
		secondary: "#251D2E",
		"secondary-foreground": "#CCC8D2",
		muted: "#1F1828",
		"muted-foreground": "#7E7888",
		accent: "#7DD3E8",
		"accent-foreground": "#0F0C14",
		destructive: "#E04545",
		"destructive-foreground": "#F5F3F7",
		border: "#3D3150",
		input: "#15111B",
		ring: "#7DD3E8B3",
	},
	vscodeColors: {
		// Editor / main surface
		"editor-background": "#0F0C14",
		"editor-foreground": "#EEEAF4",
		"foreground": "#EEEAF4",
		"descriptionForeground": "#7E7888",
		"disabledForeground": "#655F70",
		"errorForeground": "#E04545",

		// Buttons — primary uses pink, secondary uses purple-gray
		"button-background": "#E84393",
		"button-foreground": "#2D1525",
		"button-hoverBackground": "#F06AAF",
		"button-secondaryBackground": "#251D2E",
		"button-secondaryForeground": "#D7D0E1",
		"button-secondaryHoverBackground": "#312850",

		// Inputs / dropdowns
		"input-background": "#15111B",
		"input-foreground": "#EEEAF4",
		"input-border": "#3D3150",
		"dropdown-background": "#1A1520",
		"dropdown-foreground": "#EEEAF4",
		"dropdown-border": "#3D3150",

		// Lists / selections
		"list-hoverBackground": "#251D2E",
		"list-hoverForeground": "#F5F3F7",
		"list-activeSelectionBackground": "#E8439342",
		"list-activeSelectionForeground": "#E84393",
		"list-focusBackground": "#251D2E",

		// Panels / sidebars
		"panel-border": "#3D3150",
		"sideBar-background": "#0C0A10",
		"sideBar-foreground": "#D9D2E3",
		"sideBar-border": "#1F1828",
		"sideBarSectionHeader-background": "#15111B",
		"sideBarSectionHeader-foreground": "#EEEAF4",

		// Badges / focus
		"badge-background": "#E84393",
		"badge-foreground": "#2D1525",
		"focusBorder": "#7DD3E8",

		// Links / text — cyan for links
		"textLink-foreground": "#7DD3E8",
		"textLink-activeForeground": "#A5E3F0",
		"textBlockQuote-background": "#241D2E",
		"textCodeBlock-background": "#17121E",
		"textBlockQuote-border": "#7DD3E8",
		"textPreformat-foreground": "#E8C84A",
		"textPreformat-background": "#17121E",

		// Editor groups / borders
		"editorGroup-border": "#4A3C59",
		"editorGroupHeader-tabsBackground": "#18141F",

		// Notifications / hover
		"notifications-background": "#241D2E",
		"notifications-foreground": "#EEEAF4",
		"notifications-border": "#E8944A",
		"editorHoverWidget-background": "#241D2EF2",
		"editorHoverWidget-foreground": "#EEEAF4",
		"editorHoverWidget-border": "#7DD3E8",

		// Charts / status colors
		"charts-green": "#7DD87D",
		"charts-red": "#E04545",
		"charts-yellow": "#E8C84A",
		"charts-blue": "#7DD3E8",
		"charts-orange": "#E8944A",
		"charts-purple": "#E84393",

		// Terminal
		"terminal-foreground": "#7DD87D",
		"terminal-selectionBackground": "#E8439333",

		// Diff editor
		"diffEditor-insertedTextBackground": "#7DD87D22",
		"diffEditor-removedTextBackground": "#E0454522",

		// Banner
		"banner-background": "#31283D",
		"banner-foreground": "#D9D2E3",

		// Toolbar
		"toolbar-hoverBackground": "#31283D",

		// Input validation
		"inputValidation-errorBackground": "#E045451F",
		"inputValidation-errorBorder": "#E04545",
		"inputValidation-warningBackground": "#E8C84A1F",
		"inputValidation-warningBorder": "#E8C84A",
		"inputValidation-infoBackground": "#7DD3E81F",
		"inputValidation-infoBorder": "#7DD3E8",

		// Editor warning/error
		"editorWarning-foreground": "#E8C84A",
		"editorWarning-background": "#E8C84A1F",
		"editorError-foreground": "#E04545",

		// Widget
		"widget-border": "#4A3C59",
		"widget-shadow": "#00000088",

		// Title bar
		"titleBar-activeForeground": "#D9D2E3",
		"titleBar-inactiveForeground": "#7E7888",

		// Progress
		"progressBar-background": "#E8944A",

		// Icon
		"icon-foreground": "#E84393",

		// Menu
		"menu-background": "#241D2EF2",
		"menu-foreground": "#EEEAF4",

		// Editor line highlight
		"editor-lineHighlightBorder": "#4A3C59",

		// Editor inactive selection
		"editor-inactiveSelectionBackground": "#31283D80",

		// Testing icons
		"testing-iconPassed": "#7DD87D",
		"testing-iconFailed": "#E04545",

		// Symbol icon
		"symbolIcon-methodForeground": "#E84393",
		"stringForeground": "#E8C84A",

		// ANSI terminal colors
		"terminal-ansiBlack": "#18141F",
		"terminal-ansiRed": "#E04545",
		"terminal-ansiGreen": "#7DD87D",
		"terminal-ansiYellow": "#E8C84A",
		"terminal-ansiBlue": "#7DD3E8",
		"terminal-ansiMagenta": "#E84393",
		"terminal-ansiCyan": "#7DD3E8",
		"terminal-ansiWhite": "#EEEAF4",
		"terminal-ansiBrightBlack": "#655F70",
		"terminal-ansiBrightRed": "#F06A6A",
		"terminal-ansiBrightGreen": "#A5E8A5",
		"terminal-ansiBrightYellow": "#F0D87A",
		"terminal-ansiBrightBlue": "#A5E3F0",
		"terminal-ansiBrightMagenta": "#F06AAF",
		"terminal-ansiBrightCyan": "#A5E3F0",
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
