import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  noExternal: ["@roo-code/types"],
  target: "node20",
  platform: "node",
  clean: true,
  dts: false,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
})
