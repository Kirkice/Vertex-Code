import path, { resolve } from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@src": resolve(__dirname, "./src"),
			"@roo-code/types": resolve(__dirname, "./src/types-shared/index.ts"),
			"@roo": resolve(__dirname, "./src/shared"),
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
		sourcemap: true,
		minify: true,
		cssCodeSplit: false,
		rollupOptions: {
			external: ["vscode"],
			output: {
				entryFileNames: "assets/[name].js",
				chunkFileNames: "assets/[name]-[hash].js",
				assetFileNames: (assetInfo) => {
					const name = assetInfo.name ?? ""
					if (name.endsWith(".css")) {
						return "assets/index.css"
					}
					return "assets/[name][extname]"
				},
			},
		},
	},
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	assetsInclude: ["**/*.wasm", "**/*.wav"],
	server: {
		hmr: {
			host: "localhost",
			protocol: "ws",
		},
		cors: {
			origin: "*",
			methods: "*",
			allowedHeaders: "*",
		},
	},
	optimizeDeps: {
		exclude: ["@vscode/codicons", "vscode-oniguruma", "shiki"],
	},
})