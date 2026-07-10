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
		background: "#221E28",
		foreground: "#E8E5ED",
		card: "#28232F",
		"card-foreground": "#E8E5ED",
		popover: "#28232F",
		"popover-foreground": "#E8E5ED",
		primary: "#E84393",
		"primary-foreground": "#2D1525",
		secondary: "#332D3D",
		"secondary-foreground": "#CCC8D2",
		muted: "#332D3D",
		"muted-foreground": "#7E7888",
		accent: "#7DD3E8",
		"accent-foreground": "#221E28",
		destructive: "#E04545",
		"destructive-foreground": "#F5F3F7",
		border: "#3D3747",
		input: "#28232F",
		ring: "#7DD3E8B3",
	},
	vscodeColors: {
		// Editor / main surface
		"editor-background": "#221E28",
		"editor-foreground": "#E8E5ED",
		"foreground": "#E8E5ED",
		"descriptionForeground": "#7E7888",
		"disabledForeground": "#655F70",
		"errorForeground": "#E04545",

		// Buttons — primary uses pink, secondary uses purple-gray
		"button-background": "#E84393",
		"button-foreground": "#2D1525",
		"button-hoverBackground": "#F06AAF",
		"button-secondaryBackground": "#332D3D",
		"button-secondaryForeground": "#CCC8D2",
		"button-secondaryHoverBackground": "#3D3649",

		// Inputs / dropdowns
		"input-background": "#28232F",
		"input-foreground": "#E8E5ED",
		"input-border": "#3D3747",
		"dropdown-background": "#28232F",
		"dropdown-foreground": "#E8E5ED",
		"dropdown-border": "#3D3747",

		// Lists / selections
		"list-hoverBackground": "#332D3D",
		"list-hoverForeground": "#F5F3F7",
		"list-activeSelectionBackground": "#E843932E",
		"list-activeSelectionForeground": "#E84393",
		"list-focusBackground": "#332D3D",

		// Panels / sidebars
		"panel-border": "#3D3747",
		"sideBar-background": "#1C1822",
		"sideBar-foreground": "#CCC8D2",
		"sideBar-border": "#352F3D",
		"sideBarSectionHeader-background": "#28232F",
		"sideBarSectionHeader-foreground": "#E8E5ED",

		// Badges / focus
		"badge-background": "#E84393",
		"badge-foreground": "#2D1525",
		"focusBorder": "#7DD3E8",

		// Links / text — cyan for links
		"textLink-foreground": "#7DD3E8",
		"textLink-activeForeground": "#A5E3F0",
		"textBlockQuote-background": "#28232F",
		"textCodeBlock-background": "#1C1822",
		"textBlockQuote-border": "#7DD3E8",
		"textPreformat-foreground": "#E8C84A",
		"textPreformat-background": "#1C1822",

		// Editor groups / borders
		"editorGroup-border": "#3D3747",
		"editorGroupHeader-tabsBackground": "#221E28",

		// Notifications / hover
		"notifications-background": "#28232F",
		"notifications-foreground": "#E8E5ED",
		"notifications-border": "#E8944A",
		"editorHoverWidget-background": "#28232FF2",
		"editorHoverWidget-foreground": "#E8E5ED",
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
		"banner-background": "#332D3D",
		"banner-foreground": "#CCC8D2",

		// Toolbar
		"toolbar-hoverBackground": "#332D3D",

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
		"widget-border": "#3D3747",
		"widget-shadow": "#00000088",

		// Title bar
		"titleBar-activeForeground": "#CCC8D2",
		"titleBar-inactiveForeground": "#7E7888",

		// Progress
		"progressBar-background": "#E8944A",

		// Icon
		"icon-foreground": "#E84393",

		// Menu
		"menu-background": "#28232FF2",
		"menu-foreground": "#E8E5ED",

		// Editor line highlight
		"editor-lineHighlightBorder": "#3D3747",

		// Editor inactive selection
		"editor-inactiveSelectionBackground": "#332D3D66",

		// Testing icons
		"testing-iconPassed": "#7DD87D",
		"testing-iconFailed": "#E04545",

		// Symbol icon
		"symbolIcon-methodForeground": "#E84393",
		"stringForeground": "#E8C84A",

		// ANSI terminal colors
		"terminal-ansiBlack": "#221E28",
		"terminal-ansiRed": "#E04545",
		"terminal-ansiGreen": "#7DD87D",
		"terminal-ansiYellow": "#E8C84A",
		"terminal-ansiBlue": "#7DD3E8",
		"terminal-ansiMagenta": "#E84393",
		"terminal-ansiCyan": "#7DD3E8",
		"terminal-ansiWhite": "#E8E5ED",
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
