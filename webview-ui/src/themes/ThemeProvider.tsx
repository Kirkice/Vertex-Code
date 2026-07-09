/**
 * ThemeProvider — React context + CSS variable injection for webview themes.
 *
 * Simplest possible approach:
 * - None: do nothing, don't touch any CSS variables
 * - JellyFish: set a CSS class on <html> that triggers all theme overrides
 *   via a <style> tag injected into the document head
 *
 * This avoids all inline style / cleanup / ref issues.
 *
 * @module themes/ThemeProvider
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import type { ThemeId } from "./types"
import { DEFAULT_THEME_ID } from "./types"
import { themes } from "./definitions"

// ─── localStorage key ───────────────────────────────────────────────────────
const STORAGE_KEY = "vertex-webview-theme"

// ─── The style tag ID ──────────────────────────────────────────────────────
const STYLE_TAG_ID = "vertex-theme-styles"

// ─── CSS class name for active theme ────────────────────────────────────────
const THEME_CLASS = "vertex-theme-active"

// ─── Generate CSS for a theme ───────────────────────────────────────────────

/**
 * Generate a complete CSS string for a theme.
 * Uses a class selector on <html> so it can be toggled by adding/removing the class.
 */
function generateThemeCSS(themeId: ThemeId): string {
	const theme = themes[themeId]
	if (!theme || !theme.colors) return ""

	const lines: string[] = []

	// Semantic variables
	lines.push(`html.${THEME_CLASS} {`)
	for (const [key, value] of Object.entries(theme.colors)) {
		lines.push(`  --${key}: ${value};`)
	}
	// Decorative variables
	lines.push(`  --vertex-theme-border: rgba(0, 229, 255, 0.34);`)
	lines.push(`  --vertex-theme-border-soft: rgba(0, 229, 255, 0.18);`)
	lines.push(`}`)

	// --vscode-* overrides — set on both html and body
	if (theme.vscodeColors) {
		lines.push(`html.${THEME_CLASS},`)
		lines.push(`html.${THEME_CLASS} body {`)
		for (const [key, value] of Object.entries(theme.vscodeColors)) {
			lines.push(`  --vscode-${key}: ${value};`)
		}
		lines.push(`}`)
	}

	return lines.join("\n")
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read the persisted theme ID from localStorage.
 */
function loadStoredThemeId(): ThemeId {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored && stored in themes) {
			return stored as ThemeId
		}
	} catch {
		// localStorage may be unavailable
	}
	return DEFAULT_THEME_ID
}

/**
 * Apply theme by injecting a <style> tag and toggling a CSS class on <html>.
 * - None: remove the style tag and the class — zero footprint
 * - JellyFish: inject style tag, add class — all overrides via CSS
 */
function applyTheme(themeId: ThemeId): void {
	// Remove existing style tag
	const existing = document.getElementById(STYLE_TAG_ID)
	if (existing) {
		existing.remove()
	}

	// Remove theme class from <html>
	document.documentElement.classList.remove(THEME_CLASS)

	if (themeId === "none") {
		// Done — no style tag, no class, completely clean
		return
	}

	// Generate and inject CSS
	const css = generateThemeCSS(themeId)
	if (css) {
		const style = document.createElement("style")
		style.id = STYLE_TAG_ID
		style.textContent = css
		document.head.appendChild(style)

		// Add class to <html> to activate the CSS rules
		document.documentElement.classList.add(THEME_CLASS)
	}
}

// ─── Context ────────────────────────────────────────────────────────────────

interface ThemeContextValue {
	themeId: ThemeId
	setThemeId: (id: ThemeId) => void
	availableThemes: string[]
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// ─── Provider ───────────────────────────────────────────────────────────────

interface ThemeProviderProps {
	children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const [themeId, setThemeIdState] = useState<ThemeId>(loadStoredThemeId)

	useEffect(() => {
		applyTheme(themeId)

		try {
			localStorage.setItem(STORAGE_KEY, themeId)
		} catch {
			// Ignore storage errors
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

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext)
	if (!ctx) {
		throw new Error("useTheme must be used within a <ThemeProvider>")
	}
	return ctx
}
