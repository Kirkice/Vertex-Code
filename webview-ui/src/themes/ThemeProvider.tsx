/**
 * ThemeProvider — React context + CSS variable injection for webview themes.
 *
 * When a custom theme is selected, this provider overrides the `:root` CSS
 * custom properties (e.g., `--background`, `--primary`) with the theme's
 * hardcoded color values. When "None" is selected, all overrides are removed
 * so the webview falls back to VSCode's built-in color variables.
 *
 * Theme selection is persisted in `localStorage` so it survives webview reloads.
 *
 * @module themes/ThemeProvider
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import type { ThemeId, ThemeColors } from "./types"
import { DEFAULT_THEME_ID } from "./types"
import { themes } from "./definitions"

// ─── localStorage key ───────────────────────────────────────────────────────
const STORAGE_KEY = "vertex-webview-theme"

// ─── CSS variable names that map to :root semantic tokens ───────────────────
const CSS_VAR_KEYS: (keyof ThemeColors)[] = [
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"destructive-foreground",
	"border",
	"input",
	"ring",
]

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read the persisted theme ID from localStorage.
 * Falls back to DEFAULT_THEME_ID if the stored value is invalid.
 */
function loadStoredThemeId(): ThemeId {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored && stored in themes) {
			return stored as ThemeId
		}
	} catch {
		// localStorage may be unavailable in some environments
	}
	return DEFAULT_THEME_ID
}

/**
 * Apply theme color overrides to `document.documentElement`.
 * Sets `--<key>` CSS custom properties for each color in the theme.
 */
function applyThemeOverrides(colors: Partial<ThemeColors>): void {
	const root = document.documentElement
	for (const key of CSS_VAR_KEYS) {
		const value = colors[key]
		if (value) {
			root.style.setProperty(`--${key}`, value)
		}
	}
}

/**
 * Apply `--vscode-*` variable overrides to `document.documentElement`.
 * Keys in the map are variable names WITHOUT the `--` prefix.
 */
function applyVscodeOverrides(vscodeColors: Record<string, string>): void {
	const root = document.documentElement
	for (const [key, value] of Object.entries(vscodeColors)) {
		root.style.setProperty(`--vscode-${key}`, value)
	}
}

/**
 * Remove all theme color overrides from `document.documentElement`,
 * restoring the default VSCode-derived values from the `:root` stylesheet.
 */
function removeThemeOverrides(): void {
	const root = document.documentElement
	for (const key of CSS_VAR_KEYS) {
		root.style.removeProperty(`--${key}`)
	}
}

/**
 * Remove all `--vscode-*` variable overrides from `document.documentElement`.
 */
function removeVscodeOverrides(vscodeColors: Record<string, string>): void {
	const root = document.documentElement
	for (const key of Object.keys(vscodeColors)) {
		root.style.removeProperty(`--vscode-${key}`)
	}
}

// ─── Context ────────────────────────────────────────────────────────────────

interface ThemeContextValue {
	/** Current theme ID */
	themeId: ThemeId
	/** Switch to a different theme */
	setThemeId: (id: ThemeId) => void
	/** List of available theme IDs in display order */
	availableThemes: string[]
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// ─── Provider ───────────────────────────────────────────────────────────────

interface ThemeProviderProps {
	children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const [themeId, setThemeIdState] = useState<ThemeId>(loadStoredThemeId)

	// Track previously applied vscode override keys for proper cleanup
	const prevVscodeKeysRef = useRef<string[]>([])

	// Apply / remove CSS overrides whenever the theme changes
	useEffect(() => {
		const theme = themes[themeId]
		if (theme?.colors) {
			applyThemeOverrides(theme.colors)
		} else {
			removeThemeOverrides()
		}

		// Remove previously applied --vscode-* overrides first
		if (prevVscodeKeysRef.current.length > 0) {
			const root = document.documentElement
			for (const key of prevVscodeKeysRef.current) {
				root.style.removeProperty(`--vscode-${key}`)
			}
			prevVscodeKeysRef.current = []
		}

		// Apply new --vscode-* overrides
		if (theme?.vscodeColors) {
			applyVscodeOverrides(theme.vscodeColors)
			prevVscodeKeysRef.current = Object.keys(theme.vscodeColors)
		}

		// Persist to localStorage
		try {
			localStorage.setItem(STORAGE_KEY, themeId)
		} catch {
			// Ignore storage errors
		}

		// Cleanup on unmount — remove overrides so VSCode defaults are restored
		return () => {
			removeThemeOverrides()
			if (prevVscodeKeysRef.current.length > 0) {
				const root = document.documentElement
				for (const key of prevVscodeKeysRef.current) {
					root.style.removeProperty(`--vscode-${key}`)
				}
			}
		}
	}, [themeId])

	const setThemeId = useCallback((id: ThemeId) => {
		setThemeIdState(id)
	}, [])

	const value = useMemo<ThemeContextValue>(
		() => ({
			themeId,
			setThemeId,
			availableThemes: Object.keys(themes),
		}),
		[themeId, setThemeId],
	)

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Hook to access the current theme state and setter.
 * Must be used within a `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext)
	if (!ctx) {
		throw new Error("useTheme must be used within a <ThemeProvider>")
	}
	return ctx
}
