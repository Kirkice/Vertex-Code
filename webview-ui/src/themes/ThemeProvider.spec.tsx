import React from "react"
import { render, waitFor, cleanup } from "@/utils/test-utils"

import { ThemeProvider } from "./ThemeProvider"

describe("ThemeProvider", () => {
	beforeEach(() => {
		localStorage.clear()
		document.documentElement.className = ""
		document.getElementById("vertex-theme-styles")?.remove()
	})

	afterEach(() => {
		cleanup()
		document.documentElement.className = ""
		document.getElementById("vertex-theme-styles")?.remove()
	})

	it("applies persisted jellyfish theme on first mount", async () => {
		localStorage.setItem("vertex-webview-theme", "jellyfish")

		render(
			<ThemeProvider>
				<div data-testid="theme-provider-child">child</div>
			</ThemeProvider>,
		)

		await waitFor(() => {
			expect(document.documentElement.classList.contains("vertex-theme-active")).toBe(true)
			expect(document.getElementById("vertex-theme-styles")).not.toBeNull()
		})
	})

	it("removes saved theme artifacts when persisted theme is none", async () => {
		localStorage.setItem("vertex-webview-theme", "none")

		render(
			<ThemeProvider>
				<div data-testid="theme-provider-child">child</div>
			</ThemeProvider>,
		)

		await waitFor(() => {
			expect(document.documentElement.classList.contains("vertex-theme-active")).toBe(false)
			expect(document.getElementById("vertex-theme-styles")).toBeNull()
		})
	})
})
