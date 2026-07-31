import { expect, test } from "@playwright/test"

const graphicsWorkspaceUrl = "/?graphics-visual-regression"

test.describe("Graphics Workspace browser regression", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(graphicsWorkspaceUrl)
		await expect(page.getByTestId("graphics-feature-home")).toBeVisible()
		await expect(page.getByRole("tablist")).toBeVisible()
		await page.addStyleTag({
			content: `
				*, *::before, *::after {
					animation-duration: 0s !important;
					animation-delay: 0s !important;
					transition-duration: 0s !important;
					transition-delay: 0s !important;
				}
			`,
		})
	})

	test("matches the Graphics Workspace visual baseline", async ({ page }) => {
		await expect(page).toHaveScreenshot("graphics-workspace.png", {
			fullPage: true,
			animations: "disabled",
		})
	})

	test("preserves browser keyboard navigation and ARIA tab relationships", async ({ page }) => {
		const tabs = page.getByRole("tab")
		const featureTab = tabs.nth(0)
		const assetsTab = tabs.nth(1)
		const runtimeTab = tabs.nth(2)

		await featureTab.focus()
		await page.keyboard.press("ArrowRight")
		await expect(assetsTab).toBeFocused()
		await expect(assetsTab).toHaveAttribute("aria-selected", "true")

		await page.keyboard.press("End")
		await expect(runtimeTab).toBeFocused()
		await expect(runtimeTab).toHaveAttribute("aria-selected", "true")

		await page.keyboard.press("Home")
		await expect(featureTab).toBeFocused()
		await expect(featureTab).toHaveAttribute("aria-controls", "tab-feature-panel")
		await expect(page.locator("#tab-feature-panel")).toHaveAttribute("aria-labelledby", "tab-feature")
	})
})
