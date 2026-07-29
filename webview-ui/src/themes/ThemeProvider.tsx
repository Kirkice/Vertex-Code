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

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react"

import type { ThemeId } from "./types"
import { DEFAULT_THEME_ID } from "./types"
import { themes } from "./definitions"

// ─── localStorage key ───────────────────────────────────────────────────────
const STORAGE_KEY = "vertex-webview-theme"

// ─── The style tag ID ──────────────────────────────────────────────────────
const STYLE_TAG_ID = "vertex-theme-styles"

// ─── CSS class name for active theme ────────────────────────────────────────
const THEME_CLASS = "vertex-theme-active"

function setDocumentCanvasBackground(themeId: ThemeId): void {
	const background = themeId === "none" ? "" : themes[themeId]?.colors?.background || ""
	const root = document.getElementById("root")

	// A transparent webview canvas can retain the previous frame until an input
	// event causes a repaint. Update the actual document surfaces on transitions.
	document.documentElement.style.backgroundColor = background
	document.body.style.backgroundColor = background
	if (root) {
		root.style.backgroundColor = background
	}
}

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
		setDocumentCanvasBackground("none")
		// Done — no style tag, no class, completely clean
		try {
			const htmlStyles = getComputedStyle(document.documentElement)
			const bodyStyles = getComputedStyle(document.body)
			console.debug("[ThemeProvider.applyTheme:none]", {
				hasThemeClass: document.documentElement.classList.contains(THEME_CLASS),
				htmlVscodeEditorBackground: htmlStyles.getPropertyValue("--vscode-editor-background").trim(),
				htmlBackground: htmlStyles.getPropertyValue("--background").trim(),
				bodyBackground: bodyStyles.background,
			})
		} catch {
			// Ignore debug errors
		}
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
		setDocumentCanvasBackground(themeId)

		try {
			const htmlStyles = getComputedStyle(document.documentElement)
			const bodyStyles = getComputedStyle(document.body)
			const root = document.getElementById("root")
			const rootStyles = root ? getComputedStyle(root) : null
			console.debug("[ThemeProvider.applyTheme]", {
				themeId,
				hasThemeClass: document.documentElement.classList.contains(THEME_CLASS),
				htmlVscodeEditorBackground: htmlStyles.getPropertyValue("--vscode-editor-background").trim(),
				htmlBackground: htmlStyles.getPropertyValue("--background").trim(),
				htmlCard: htmlStyles.getPropertyValue("--card").trim(),
				bodyBackground: bodyStyles.background,
				rootBackground: rootStyles?.background,
			})
		} catch {
			// Ignore debug errors
		}
	}
}

/**
 * Apply the persisted theme before React renders any visible UI.
 *
 * Webviews can paint the document between loading the CSS and mounting the
 * React tree. If the theme is only applied from an effect, the first paint
 * uses VS Code's colors and a later interaction can expose the saved theme.
 */
export function initializeTheme(): void {
	applyTheme(loadStoredThemeId())
}

/**
 * Ensure the persisted theme is attached before the first visible paint.
 * [`useEffect()`](webview-ui/src/themes/ThemeProvider.tsx:176) can run too late for VS Code webviews,
 * causing the UI to briefly render with raw VS Code theme tokens until a later
 * interaction triggers a repaint.
 */
function applyThemeBeforePaint(themeId: ThemeId): void {
	applyTheme(themeId)
}

// ─── Context ────────────────────────────────────────────────────────────────

interface ThemeContextValue {
	/** The committed theme that is currently applied (read-only for consumers). */
	themeId: ThemeId
	/** The pending theme selected by the user but not yet saved. */
	pendingThemeId: ThemeId
	/** Set the pending theme (does NOT apply until commitTheme is called). */
	setThemeId: (id: ThemeId) => void
	/** Commit the pending theme — applies CSS + writes localStorage. */
	commitTheme: () => void
	/** Reset the pending theme back to the committed theme (discard). */
	resetPendingTheme: () => void
	/** Whether the pending theme differs from the committed theme. */
	hasPendingThemeChange: boolean
	availableThemes: string[]
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// ─── Provider ───────────────────────────────────────────────────────────────

interface ThemeProviderProps {
	children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	// The committed theme — actually applied to the DOM and persisted.
	const [themeId, setThemeIdState] = useState<ThemeId>(loadStoredThemeId)
	// The pending theme — selected by the user but not yet saved.
	const [pendingThemeId, setPendingThemeIdState] = useState<ThemeId>(themeId)

	useLayoutEffect(() => {
		applyThemeBeforePaint(themeId)
	}, [themeId])

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, themeId)
		} catch {
			// Ignore storage errors
		}
	}, [themeId])

	// setThemeId only updates the pending state — it does NOT apply the theme.
	const setThemeId = useCallback((id: ThemeId) => {
		setPendingThemeIdState(id)
	}, [])

	// Commit the pending theme — applies CSS + writes localStorage.
	const commitTheme = useCallback(() => {
		setThemeIdState(pendingThemeId)
	}, [pendingThemeId])

	// Reset the pending theme back to the committed theme (discard).
	const resetPendingTheme = useCallback(() => {
		setPendingThemeIdState(themeId)
	}, [themeId])

	const hasPendingThemeChange = pendingThemeId !== themeId

	const value = useMemo<ThemeContextValue>(
		() => ({
			themeId,
			pendingThemeId,
			setThemeId,
			commitTheme,
			resetPendingTheme,
			hasPendingThemeChange,
			availableThemes: Object.keys(themes),
		}),
		[
			themeId,
			pendingThemeId,
			setThemeId,
			commitTheme,
			resetPendingTheme,
			hasPendingThemeChange,
		],
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
