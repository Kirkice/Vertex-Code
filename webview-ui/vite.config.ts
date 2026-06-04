import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
		cssCodeSplit: false,
		rollupOptions: {
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
})