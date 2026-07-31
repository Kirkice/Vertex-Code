import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
	testDir: "./visual-regression",
	testMatch: "**/*.spec.ts",
	snapshotDir: "./visual-regression/snapshots",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "dot" : "list",
	use: {
		baseURL: "http://127.0.0.1:4173",
		locale: "en-US",
		timezoneId: "UTC",
		colorScheme: "dark",
		viewport: { width: 1280, height: 900 },
		deviceScaleFactor: 1,
		trace: "retain-on-failure",
		video: "off",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "pnpm dev --mode visual-regression --host 127.0.0.1 --port 4173",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
})
