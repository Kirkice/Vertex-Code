import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * Vitest configuration for the extension-host package.
 *
 * The extension is compiled against VS Code's runtime module, which is only
 * available inside Extension Host. Tests must therefore resolve `vscode` to
 * a deterministic Node-compatible adapter instead of relying on a globally
 * installed VS Code process.
 */
export default defineConfig({
	resolve: {
		alias: {
			vscode: fileURLToPath(new URL("./test/vscode.ts", import.meta.url)),
		},
	},
	test: {
		globals: true,
		environment: "node",
		watch: false,
	},
})
