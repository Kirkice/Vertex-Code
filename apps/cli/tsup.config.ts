import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  // CLI 必须是可直接复制运行的单文件；workspace 包不能在 dist 中保留
  // 指向 src/*.js 的开发期 ESM 导入，否则构建后用 node 执行会失败。
  noExternal: ["@roo-code/types", "@vertex/agent-runtime", "@vertex/node-host"],
  // yaml 同时提供 ESM/CJS 入口，内联后会把其 Node 兼容分支转换成
  // ESM 中不支持的动态 require。保留为运行时依赖，由 node-host 的
  // package dependency 在安装 CLI 时提供。
  external: ["yaml"],
  target: "node20",
  platform: "node",
  clean: true,
  dts: false,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
})
