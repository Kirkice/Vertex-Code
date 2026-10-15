# Vertex 类型包

`@roo-code/types` 提供 Vertex CLI 及其 Node.js 运行时共享的 TypeScript 类型与运行时校验 schema。

> 包名和部分导出类型保留 `@roo-code` / `RooCodeAPI` 的历史名称，以避免破坏已有的类型级集成；CLI 运行时不提供编辑器扩展 API。

## 安装

```bash
npm install @roo-code/types
```

## 使用

```typescript
import {
  rooCliFinalOutputSchema,
  rooCliStreamEventSchema,
  type RooCliFinalOutput,
  type RooCliStreamEvent,
} from "@roo-code/types"

const event: RooCliStreamEvent = rooCliStreamEventSchema.parse(input)
const result: RooCliFinalOutput = rooCliFinalOutputSchema.parse(output)
```

可用的导出声明请参阅 [`packages/types/src/index.ts`](../src/index.ts)，CLI 协议定义位于 [`packages/types/src/cli.ts`](../src/cli.ts)。
