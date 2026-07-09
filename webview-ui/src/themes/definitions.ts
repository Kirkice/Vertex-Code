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
	description: "Cyber CLI dark theme with neon cyan and terminal green accents",
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
		accent: "#00FF9C",
		"accent-foreground": "#04120D",
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

		// Buttons
		"button-background": "#00E5FF",
		"button-foreground": "#061017",
		"button-hoverBackground": "#37F0FF",
		"button-secondaryBackground": "#13202B",
		"button-secondaryForeground": "#D7E7F5",
		"button-secondaryHoverBackground": "#1A2A37",

		// Inputs / dropdowns
		"input-background": "#0E1620",
		"input-foreground": "#DDEAF7",
		"input-border": "#1E2A36",
		"dropdown-background": "#101922",
		"dropdown-foreground": "#E6F1FF",
		"dropdown-border": "#203040",

		// Lists / selections
		"list-hoverBackground": "#123041",
		"list-hoverForeground": "#F4FBFF",
		"list-activeSelectionBackground": "#11384A",
		"list-activeSelectionForeground": "#F4FBFF",
		"list-focusBackground": "#123847",

		// Panels / sidebars
		"panel-border": "#1E2A36",
		"sideBar-background": "#0C1218",
		"sideBar-foreground": "#DDEAF7",
		"sideBar-border": "#1B2632",
		"sideBarSectionHeader-background": "#0F1720",
		"sideBarSectionHeader-foreground": "#E6F1FF",

		// Badges / focus
		"badge-background": "#00FF9C",
		"badge-foreground": "#04120D",
		"focusBorder": "#00E5FF",

		// Links / text
		"textLink-foreground": "#58F3FF",
		"textLink-activeForeground": "#9CF9FF",
		"textBlockQuote-background": "#0F1720",
		"textCodeBlock-background": "#0B141D",
		"textBlockQuote-border": "#00E5FF",
		"textPreformat-foreground": "#9BFFD0",
		"textPreformat-background": "#0B141D",

		// Editor groups / borders
		"editorGroup-border": "#1E2A36",
		"editorGroupHeader-tabsBackground": "#0A0F14",

		// Notifications / hover
		"notifications-background": "#101922",
		"notifications-foreground": "#E6F1FF",
		"notifications-border": "#203040",
		"editorHoverWidget-background": "#101922F2",
		"editorHoverWidget-foreground": "#E6F1FF",
		"editorHoverWidget-border": "#203040",

		// Charts / status colors
		"charts-green": "#00FF9C",
		"charts-red": "#FF5A5F",
		"charts-yellow": "#FFB020",
		"charts-blue": "#00E5FF",
		"charts-orange": "#FF8A3D",
		"charts-purple": "#7C5CFF",

		// Terminal
		"terminal-foreground": "#D7FFE9",
		"terminal-selectionBackground": "#00E5FF33",

		// Diff editor
		"diffEditor-insertedTextBackground": "#00FF9C22",
		"diffEditor-removedTextBackground": "#FF5A5F22",

		// Banner
		"banner-background": "#0F1720",
		"banner-foreground": "#E6F1FF",

		// Toolbar
		"toolbar-hoverBackground": "#123041",

		// Input validation
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

		// Widget
		"widget-border": "#203040",
		"widget-shadow": "#00000088",

		// Title bar
		"titleBar-activeForeground": "#C7D8E8",
		"titleBar-inactiveForeground": "#7F93A8",

		// Progress
		"progressBar-background": "#00E5FF",

		// Icon
		"icon-foreground": "#00E5FF",

		// Menu
		"menu-background": "#101922F2",
		"menu-foreground": "#E6F1FF",

		// Editor line highlight
		"editor-lineHighlightBorder": "#1E2A36",

		// Editor inactive selection
		"editor-inactiveSelectionBackground": "#12304166",

		// Testing icons
		"testing-iconPassed": "#00FF9C",
		"testing-iconFailed": "#FF5A5F",

		// Symbol icon
		"symbolIcon-methodForeground": "#58F3FF",
		"stringForeground": "#9BFFD0",
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
