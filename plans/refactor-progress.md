# Vertex Code 工程化重构进度记录

> 最后更新：2026-07-21
>
> 用途：下次继续工作前，先阅读本文档，快速恢复当前重构背景、已完成内容、验证结果和后续执行顺序。

## 一、项目目标

本轮工作的总体目标是：

1. 降低 Webview、Provider、Task Runtime 之间的耦合。
2. 将巨型消息路由器拆分为职责清晰、可独立测试的 Handler。
3. 建立稳定的 VS Code Extension Host 测试基线。
4. 在不改变现有功能的前提下，逐步推进 `Task` 和 `ClineProvider` 的端口化与服务化。
5. 为潜在的 Rust 性能优化保留 benchmark-first 评估路径，不在缺少基准数据时贸然引入 Rust。

## 二、已经完成

### 1. 项目分析与文档

- 已完成整体功能模块、目录结构、技术栈和架构特点分析。
- 已重写根目录 `README.md`，补充：
    - 单模型和多模型切换。
    - Mode-level LLM routing。
    - Provider Profile。
    - Task History、Checkpoint、Worktree。
    - MCP、Skills、Code Index、Graphics Mode。
    - 开发、测试、类型检查和打包命令。
- 已识别三个主要巨型中心：
    - `src/core/task/Task.ts`
    - `src/core/webview/ClineProvider.ts`
    - `src/core/webview/webviewMessageHandler.ts`

### 2. Webview Handler 拆分

已完成阶段 1-4 的消息边界拆分：

#### 阶段 1：模型、媒体和 Mode 路由

- `src/core/webview/routerModelsHandler.ts`
- `src/core/webview/mediaFileHandler.ts`
- `src/core/webview/modeRoutingHandler.ts`

#### 阶段 2：Settings 和 Provider Profile

- `src/core/webview/settingsMessageHandler.ts`
- `src/core/webview/profileMessageHandler.ts`

#### 阶段 3：Worktree 和 Checkpoint

- `src/core/webview/worktreeCheckpointMessageHandler.ts`

#### 阶段 4：Task History、导出和删除

- `src/core/webview/taskHistoryMessageHandler.ts`

#### 路由边界基础设施

- `src/core/webview/ports.ts`
- `src/core/webview/webviewMessageHandler.ts`

主路由器现在使用前置 Handler 分发，并删除了已抽离消息的重复 legacy 分支。尚未抽离的 MCP、Skills、Marketplace、Code Index、TTS、Commands 等消息仍由主路由器处理。

### 3. 测试基线与 Handler 测试

已新增扩展宿主测试配置：

- `src/vitest.config.ts`
- `src/test/vscode.ts`

测试适配器复用了 `packages/vscode-shim`，解决了测试环境无法解析 `vscode` 包的问题。

已新增独立 Handler 测试：

- `src/core/webview/__tests__/settingsMessageHandler.spec.ts`
- `src/core/webview/__tests__/profileMessageHandler.spec.ts`
- `src/core/webview/__tests__/worktreeCheckpointMessageHandler.spec.ts`
- `src/core/webview/__tests__/taskHistoryMessageHandler.spec.ts`

测试覆盖了：

- Settings 更新、命令列表清洗、MCP 设置、导入导出。
- Provider Profile pin、upsert、加载、删除确认和剩余 Profile 激活。
- Worktree 列表、创建、结果消息和边界返回值。
- Task History 清理、批量删除、成本聚合和错误响应。
- 已有的模型路由、路径穿越和 Mode routing 回归测试。

## 三、最近一次验证结果

以下结果均已执行并通过：

### 定向测试

7 个测试文件通过，28 个测试通过：

- `webviewMessageHandler.lockApiConfig.spec.ts`
- `webviewMessageHandler.readFileContent.spec.ts`
- `webviewMessageHandler.routerModels.spec.ts`
- `settingsMessageHandler.spec.ts`
- `profileMessageHandler.spec.ts`
- `taskHistoryMessageHandler.spec.ts`
- `worktreeCheckpointMessageHandler.spec.ts`

模型路由测试中出现的 DeepSeek 错误日志是专门覆盖异常分支的预期输出，不是测试失败。

### 类型、格式和构建

- `pnpm --filter vertex check-types`：通过。
- 相关文件 `prettier --check`：通过。
- `pnpm bundle`：通过。

### 已知环境信息

- `.nvmrc` 与 [`.tool-versions`](../.tool-versions:1) 均声明 Node `20.20.2`；当前机器未发现可用的 Node 版本管理器，实际运行时仍为 Node `24.11.1`，因此 Node 20 验收尚未完成。
- 在当前 Node 24 环境执行 `pnpm install --frozen-lockfile` 后，关键 [ClineProvider.spec.ts](../src/core/webview/__tests__/ClineProvider.spec.ts:362) 验证通过：`92 passed`；该结果不能替代 Node 20 发布基线。
- `pnpm bundle` 与 [TypeScript](../src/package.json:423) 类型检查已通过，生成的 `bin/vertex-3.56.0.vsix` 包含 `extension/package.json` 与 `extension/dist/extension.js`。
- `vsce ls --tree` 仍被当前安装树中的 `invalid`/`missing` 依赖阻断；`pnpm install --frozen-lockfile` 没有改变该问题，后续需在 Node 20 环境重新建立干净依赖树。
- 已下载 VS Code `1.128.0` 并尝试 Extension Host smoke test，但归档版 Windows `Code.exe` 将 CLI 参数报告为 `bad option`，测试进程以 code 9 退出；这属于当前测试运行器/VS Code 下载包兼容性问题，尚不能计为 smoke test 通过。

- 项目声明 Node `20.20.2`。
- 当前执行环境是 Node `24.11.1`，pnpm 输出 engine warning，但本轮类型检查和构建均成功。
- 当前没有把“全量测试通过”作为验收结论；此前全量测试存在既有 `vscode` 解析问题及 Graphics 相关失败，后续如果需要发布级验收，仍应单独处理。

## 四、当前未完成事项

### 1. 阶段 5：Task Runtime 解耦

阶段 5A、5B 已完成，阶段 5C-0 已完成“新端口与旧 Provider 兼容适配器”的第一版实现；阶段 5C-1 已完成状态/日志/Webview 投影的可回退接入；阶段 5C-2 已完成 Profile、Mode、History 端口契约和旧 Provider 适配器。当前尚未替换 `Task.ts` 的核心 Provider 依赖。

`Task.ts` 仍直接或间接依赖：

- `ClineProvider` 的完整类型和大量 facade 方法。
- MCP Hub 和 MCP Server Manager。
- Skills Manager。
- Checkpoint、Diff、Workspace 和 VS Code Extension Context。
- Tool 实现、工具状态、系统提示构建和 Mode handoff。
- Provider Profile、Task History 和 Webview 状态推送。

之前尝试直接建立宽泛 `TaskHostPort` 并替换 `Task` 类型依赖时，类型检查暴露出大量跨模块耦合。该尝试已撤销，没有保留不完整接口，也没有为了通过编译而使用大面积 `any` 或强制类型断言。

本阶段的正式策略已经确定为 **双轨迁移 / Strangler Fig**：旧 `Task.ts` 路径继续作为默认生产路径，新实现先独立编写、测试和影子验证，只有通过显式开关和发布级验收后才逐簇替换，最后再删除旧代码。这样可以避免当前用户使用的已构建插件因半成品重构而不可用。

### 2. Webview 端口仍需要继续收窄

目前仍存在以下过渡技术债：

- `WebviewHostPort` 接口偏大。
- Worktree Handler 已改为使用 `WorktreeHostPort`。
- Checkpoint Task 调用已改为使用 `CheckpointTaskPort`，移除了该 Handler 中的 `as any`。
- Task History Handler 已改为使用 `TaskHistoryPort` 交叉能力契约，移除了对 `ClineProvider` 的直接类型导入。
- `WebviewHostPort` 仍承载多个能力，后续应从 `WebviewHandlerContext` 中拆出更细粒度的 capability ports。
- Router Models 返回处仍存在 `Partial<RouterModels>` 到 `RouterModels` 的强制断言。
- `Record<string, any>` 等宽泛类型仍需逐步替换。
- 新增的 `TaskStatePort` 目前仅作为阶段 5C 的契约草案，尚未迁移 `Task.ts`。

### 3. 全量测试与发布级验证

尚未完成：

- 全量 `src` 测试的稳定通过。本次基线运行结果为：339 个测试文件中 300 个通过、36 个失败、3 个跳过；5177 个测试中 4957 个通过、186 个失败、34 个跳过，并发现 3 个未处理错误。
- 当前全量失败主要集中在既有 Provider/Graphics/快照和 VS Code mock 兼容性问题，不能直接归因于本轮 Worktree、Task History 或端口契约修改；需要逐文件分类后再修复。
- Graphics 相关既有失败的归因与修复。
- Node `20.20.2` 环境下的最终验证。
- VSIX 打包后的安装或 Extension Host smoke test。

### 4. Rust 性能优化

尚未引入 Rust。当前候选模块为 Code Index：

- 目录扫描。
- 文件过滤和批量读取。
- 文本分块。
- SHA-256 或其他哈希计算。
- Tree-sitter 预处理。

必须先建立 TypeScript 基线、真实项目 benchmark、内存和吞吐对比，再决定是否使用 Rust + napi-rs。没有 benchmark 时不要直接增加 native 构建链路。

## 五、Task.ts 依赖簇式解耦实施方案

### 5.1 目标与非目标

**目标 / Goals**

- 让 Task Runtime 依赖稳定的能力端口，而不是依赖完整的 `ClineProvider` 类。
- 保持现有 API 请求、工具调用、MCP、Checkpoint、消息持久化和 Webview 协议行为不变。
- 每次只迁移一个依赖簇，能够独立测试、独立回滚和独立发布。
- 让新旧实现可以在同一版本插件中并存，旧实现默认启用。

**非目标 / Non-goals**

- 第一阶段不重写 `Task.ts` 的 API stream 主循环。
- 第一阶段不删除 `ClineProvider`、`Task.ts` 或任何旧 Provider facade 方法。
- 不通过 `any`、强制类型断言、吞异常或删除功能分支来降低迁移成本。
- 不对有副作用的 API 请求、文件写入和 MCP 工具执行“双跑”。

### 5.2 目标分层结构

```text
Task.ts（旧稳定实现，默认路径）
        │
        ├── LegacyTaskHostAdapter ── ClineProvider
        │
        └── TaskRuntimeFacade（新旁路，feature flag 默认关闭）
                ├── TaskStatePort
                ├── TaskEventPort
                ├── TaskWebviewPort
                ├── TaskProfilePort
                ├── TaskHistoryPort
                ├── TaskMcpPort
                ├── TaskSkillsPort
                ├── TaskCheckpointPort
                └── TaskToolsPort
```

端口只描述 Task 真正需要的能力；Provider 负责提供 adapter。Task 不应知道 Provider 的完整类结构、Webview Handler 细节或具体服务定位方式。

### 5.3 阶段 5C-0：建立基础宿主端口与适配器（当前第一执行单元）

**新增契约建议**

```ts
export interface TaskStatePort {
	getState(): Promise<TaskRuntimeState | undefined>
	log(message: string): void
}

export interface TaskEventPort {
	onProviderProfileChanged(listener: () => void | Promise<void>): DisposableLike
}

export interface TaskWebviewPort {
	postMessage(message: ExtensionMessage): Promise<void> | void
	postStateWithoutTaskHistory(): Promise<void>
}

export interface TaskHostPort extends TaskStatePort, TaskEventPort, TaskWebviewPort {
	readonly context: vscode.ExtensionContext
	readonly cwd: string
}
```

**实现方式**

1. 新增 `src/core/task/runtime/ports.ts`，只放 Task Runtime 端口和稳定 DTO。
2. 新增 `src/core/task/runtime/LegacyTaskHostAdapter.ts`，将当前 `ClineProvider` 映射到新端口。
3. adapter 内部可以暂时调用完整 Provider；这是兼容层，不代表 Task 继续依赖 Provider 类型。
4. 在 `ClineProvider.createTask()` 创建 Task 时同时构造 adapter，但旧 `Task` 构造参数仍保留。
5. 新增端口 contract test，验证 adapter 与现有 Provider 行为一致。
6. 新实现默认不参与 API 请求和工具执行，避免双重副作用。

**验收标准**

- 生产默认路径行为不变。
- 新 adapter 可以从 Provider 正确读取状态、记录日志、发送 Webview 消息和订阅 Profile 变化。
- contract test、相关 Task 测试、类型检查和 bundle 全部通过。
- 关闭新 feature flag 时，生成的插件与改造前行为一致。

### 5.4 阶段 5C-1：Task 状态、日志和 Webview 投影

迁移范围：

- `getState()`；
- `log()`；
- `postMessageToWebview()`；
- `postStateToWebviewWithoutTaskHistory()`；
- Provider Profile changed 事件监听。

迁移方法：

1. 先让新 facade 读取同一份 Provider 状态，不改变状态来源。
2. 对状态 DTO 做字段级快照/等价比较。
3. 只替换无副作用的 UI 投影调用。
4. 若新投影失败，捕获并回退到旧 Provider 投影；不得吞掉错误，必须记录日志。

验收标准：Task 状态字段、消息类型、发送顺序和异常行为与旧实现一致；相关测试覆盖 Provider 消失、Webview 已销毁和异步更新竞态。

### 5.5 阶段 5C-2：Provider Profile、Mode Handoff 和 Task History

本轮已完成 5C-2 的第一段安全接入：

- `TaskRuntimeFeatureFlags` 已按依赖簇拆分为 `profileRouting`、`modeHandoff` 和 `historyProjection`，默认均为 `legacy`；
- `TaskOptions` 支持可选 `taskDependencies` 和各簇 feature flag，不改变现有 Provider 构造参数；
- 新 Task 可在显式打开开关时，通过端口读取 Mode/Profile，并通过 History 端口更新历史；
- 端口读取、事件订阅和 History 写入失败时回退到旧 Provider 路径；
- 默认生产路径仍使用旧 Profile/Mode/History 副作用；
- `LegacyTaskHostAdapter` 已补充 Profile、Mode、routing、History 和默认开关契约测试。

剩余门禁：将显式 `taskHost`/依赖端口从 Provider 创建入口注入，并补充 Task 构造级 feature-flag 回滚测试；在此之前不切换插件默认路径。

建议端口：

- `TaskProfilePort`：读取/激活 Profile、更新 Task Profile 名称、读取 Mode routing 状态。
- `TaskModePort`：切换 Mode、创建 handoff、读取 custom modes。
- `TaskHistoryPort`：保存消息、更新历史项、读取聚合成本、恢复任务。

迁移顺序：

1. 先迁移只读 profile/mode 状态。
2. 再迁移显式用户触发的 Profile/Mode 切换。
3. 最后迁移 History 持久化和恢复。

有副作用的激活、持久化和 handoff 不做双执行；通过 shadow mode 只比较参数和预期结果，实际动作只由旧路径执行，直到开关切换。

### 5.6 阶段 5C-3：MCP 与 Skills

已开始迁移准备：`TaskDependencyPorts` 已增加 `TaskMcpPort` 与 `TaskSkillsPort` 最小能力，`LegacyTaskHostAdapter` 提供旧 `ClineProvider` 的兼容实现。当前仅建立端口和读取适配，MCP 工具调用、Skills 写操作和提示词主路径仍保持旧实现，避免真实副作用双执行。新增 4 项 MCP/Skills 读取契约测试已通过，TypeScript 检查通过。

建议端口：

- `TaskMcpPort`：读取启用状态、等待 Hub ready、读取工具/资源、执行 MCP 操作。
- `TaskSkillsPort`：读取当前模式可用 Skills、解析 Skill 内容和资源。

迁移要求：

- 新端口不能直接暴露 `McpHub`、`SkillsManager` 的全部方法。
- MCP server 初始化失败、超时和工具调用失败必须保持旧错误语义。
- 只允许单次真实工具调用；shadow 阶段只比较工具名称、参数 schema 和路由结果。
- MCP/Skills 相关测试必须覆盖禁用、未初始化、超时、服务消失和权限失败。

### 5.7 阶段 5C-4：Checkpoint、Workspace 和 Tool Runtime

已建立 Checkpoint 与 Tool Runtime 的最小端口契约，并由 Legacy Adapter 提供安全占位实现。占位方法不会触发真实 Checkpoint/MCP/工具副作用；实际调用接入仍待独立 adapter、单次执行保护和回滚测试完成。

这是高风险阶段，放在前述依赖簇稳定之后。

- `TaskCheckpointPort`：保存、恢复、diff、初始化状态和超时。
- `TaskWorkspacePort`：cwd、文件上下文、DiffView、工作区配置。
- `TaskToolsPort`：构建工具列表、权限、工具状态、执行结果和取消。

工具和 Checkpoint 有明显外部副作用，禁止新旧同时执行。必须先把旧实现封装为 adapter，再以 feature flag 在单次请求级别选择旧或新路径，并记录选择结果、耗时、错误和回滚原因。

### 5.8 阶段 5C-5：最后处理 API stream 主循环

只有以下条件全部满足后才允许触碰 `recursivelyMakeClineRequests()` 和 `attemptApiRequest()`：

- 前置依赖簇已完成端口化；
- 新旧状态和事件序列通过 contract test；
- 相关全量测试稳定；
- Extension Host smoke test 通过；
- 已有插件真实回归验证；
- 有明确的单请求回滚开关。

主循环迁移必须按“一个 chunk 类型/一个错误分支/一个持久化边界”切片，禁止一次性重写数千行逻辑。

### 5.9 Feature flag 与回滚设计

建议使用内部配置，不立即暴露给普通用户：

```text
vertex.experimental.taskRuntime = "legacy" | "shadow" | "new"
```

- `legacy`：默认值，完全使用旧实现。
- `shadow`：新实现只读取/比较无副作用结果，不执行真实外部动作。
- `new`：指定依赖簇使用新 adapter；任意异常按簇回退到 legacy。

每个依赖簇还应有独立开关，例如 `taskStateProjection`、`taskProfileRouting`、`taskMcp`，避免一个簇失败导致整个新 Runtime 被启用。

### 5.10 每簇统一验收门禁

每个依赖簇完成后必须执行：

1. 端口 contract tests；
2. Task 单元和相关集成测试；
3. Webview/Provider 回归测试；
4. 全量相关测试并记录既有失败；
5. TypeScript strict 类型检查；
6. Prettier/ESLint；
7. bundle 和 VSIX 内容检查；
8. Node `20.20.2` 验证；
9. Extension Host smoke test；
10. 旧路径回滚测试。

未通过任何一项，都只能保留新代码和测试，不能切换默认路径，更不能删除旧实现。

## 六、推荐的下一次执行顺序

### 下一步 A：先补强测试，不要直接重写 Task 主循环

1. 为当前 Handler 测试增加边界分支：
    - Settings 的 terminal profile 变更和 idle terminal 清理。
    - Profile 保存、重命名、错误处理和空 Profile 删除。
    - Checkpoint payload 校验、取消任务、超时和 restore。
    - Task History 删除失败、批量删除失败、当前任务导出和分享提示。
2. 运行新增测试和现有相关 Webview 测试。
3. 保持类型检查和 bundle 验证通过。

### 下一步 B：拆分 Task Runtime 的依赖簇

#### 兼容性迁移原则：旧实现保留，新实现并行验证

Task Runtime 不采用“一次性替换”策略。当前用户正在使用现有工程构建的插件，因此所有 Task 解耦工作必须遵循 Strangler Fig / 双轨迁移原则：

1. **旧路径保持默认且可运行**：`Task.ts` 现有主循环、Provider 调用链和持久化行为先不删除、不改写为半成品。
2. **新能力独立实现**：先建立新的端口、adapter、facade 和 contract test；新代码不得反向破坏旧 Provider 路径。
3. **先做等价测试，再做影子验证**：对无副作用的状态读取、事件投影和序列化结果执行新旧实现对比；涉及 API 请求、文件写入、MCP 工具调用的路径禁止直接双执行，避免重复副作用。
4. **通过显式 feature flag 切换**：新实现默认关闭，支持测试环境、开发环境和受控用户开启；发生错误时可以立即切回旧实现。
5. **按依赖簇逐步接入**：状态/事件 → Webview 投影 → Profile/Mode/History → MCP/Skills → Checkpoint/Tools；每次只切换一个依赖簇。
6. **建立回滚条件**：新路径出现异常、行为差异、性能回退、未处理 Promise 或关键测试失败时，保持旧路径并暂停该簇迁移。
7. **最后才删除旧代码**：只有在新路径经过定向测试、全量相关测试、类型检查、bundle、Extension Host smoke test 和实际插件回归后，才提交独立的旧代码删除变更。

因此，后续实现阶段不会让当前已构建插件强制使用未验证的新 Task Runtime；每个阶段都应能独立构建、安装和回滚。

建议按以下低风险顺序推进：

1. 以当前 `TaskStatePort` 为基础，先建立真实的只读状态 adapter 和 Task 侧 contract test。
2. 优先迁移只读状态和日志能力：
    - `getState`
    - `log`
    - `postMessageToWebview`
    - `postStateToWebviewWithoutTaskHistory`
3. 再抽离 `TaskHistoryPort`。
4. 再抽离 `ModeProfilePort`。
5. 再抽离 `McpPort` 和 `SkillsPort`。
6. 最后才考虑 Tool、Checkpoint 和 API stream 主循环。
7. 每完成一个依赖簇，都必须增加独立测试并运行类型检查、定向测试和 bundle。

当前阶段状态：

- 阶段 5A：已完成。
- 阶段 5B：已完成。
- 阶段 5C：进行中；已在 Provider 的新建任务和历史恢复入口显式注入同一个 `LegacyTaskHostAdapter`，同时传入 `taskHost` 与 `taskDependencies`。新状态投影仍受 `stateProjection: "legacy"` 默认开关保护，未改变生产行为。
- 本次新增回归保护：修正状态/Webview 投影 fallback 的递归调用，legacy fallback 现在直接调用 Provider 的原始投影方法；更新 Adapter 的完整 feature flag 契约测试。
- 本次验证：`LegacyTaskHostAdapter.spec.ts` 与 `Task.mode-handoff.spec.ts` 共 2 个测试文件、6 个测试通过；`pnpm exec tsc --noEmit`（在 `src` 目录执行）通过；相关文件 Prettier 检查通过。运行环境为 Node `24.11.1`，不是项目声明的 Node `20.20.2`。
- 已补充 Task 构造级开关与回滚测试：默认 `stateProjection: "legacy"` 时，即使注入 `taskHost` 也仍调用 Provider 原始投影；显式 `stateProjection: "new"` 时使用端口，端口失败后回退到 Provider 并记录日志。
- 本次新增验证：相关 2 个测试文件共 7 个测试通过；`pnpm exec tsc --noEmit`（在 `src` 目录执行）通过；相关文件 Prettier 检查通过。测试仍在 Node `24.11.1` 下运行。
- 已补充 Profile/Mode 依赖簇的构造级测试：显式 `profileRouting: "new"`、`modeHandoff: "new"` 时从端口读取 Profile/Mode；端口读取失败时分别回退到 Provider 状态并记录日志。
- 本次新增验证：相关 2 个测试文件共 9 个测试通过；`pnpm exec tsc --noEmit`（在 `src` 目录执行）通过；相关文件 Prettier 检查通过。测试仍在 Node `24.11.1` 下运行。
- 已补充 History 依赖簇测试：显式 `historyProjection: "new"` 时 History 更新只通过新端口执行一次；新端口失败时回退到 Provider，并记录回退日志。
- 本次新增验证：相关 2 个测试文件共 11 个测试通过；`pnpm exec tsc --noEmit`（在 `src` 目录执行）通过；相关文件 Prettier 检查通过。测试仍在 Node `24.11.1` 下运行。
- 已补充 MCP 依赖簇测试：显式 `mcp: "new"` 时从 MCP 端口读取启用状态和 Hub，并正确统计已连接服务器工具；MCP 禁用时不重复读取 Hub；端口异常时保持非致命空计数行为。
- 本次新增验证：相关 2 个测试文件共 13 个测试通过；`pnpm exec tsc --noEmit`（在 `src` 目录执行）通过；相关文件 Prettier 检查通过。测试仍在 Node `24.11.1` 下运行。MCP 异常日志是测试覆盖的预期输出。
- Skills 端口已接入用户内容处理主路径：新增 `TaskSkillsPort.getSkillContent()`，`skills: "new"` 时 slash-command lookup 使用端口，默认 legacy 时仍使用原 `SkillsManager`。
- 已补充 Skills 测试：验证 new 端口 lookup、legacy manager lookup，以及 Skills 端口类型契约；未执行任何 Skills 副作用双跑。
- 本次新增验证：相关 2 个测试文件共 15 个测试通过；`pnpm exec tsc --noEmit`（在 `src` 目录执行）通过；相关文件 Prettier 检查通过。测试仍在 Node `24.11.1` 下运行。MCP 异常日志是测试覆盖的预期输出。
- Checkpoint 端口已接入 `checkpointSave`、`checkpointRestore` 和 `checkpointDiff`：`checkpoint: "new"` 时单次调用端口，失败后回退旧实现并记录日志；默认 legacy 不变。
- 已补充 Checkpoint new/失败回退测试；本次相关 2 个测试文件共 16 个测试通过。`pnpm exec tsc --noEmit`（在 `src` 目录执行）与 Prettier 检查通过，测试仍在 Node `24.11.1` 下运行。
- Tools 端口已接入 Task 的工具构建边界：所有 native tools 构建调用统一经过 `buildToolsWithRuntime()`；`tools: "new"` 时使用 `TaskToolsPort.buildTools()`，失败后回退 legacy builder 并记录日志，默认 legacy 不变。
- 已补充 Tools new/失败回退测试；本次相关 2 个测试文件共 17 个测试通过。`pnpm exec tsc --noEmit`（在 `src` 目录执行）与相关文件 Prettier 检查通过，测试仍在 Node `24.11.1` 下运行。
- `stateProjection` 已完成真实接入：消息新增和更新、队列状态投影现在统一经过 `projectStateWithoutTaskHistory()` / `projectWebviewMessage()`；显式 `stateProjection: "new"` 时使用 Task Host，失败回退 Provider，默认 legacy 保持不变。初始化错误日志也通过注入的 Host 记录。
- 已补充 state projection new 路径测试；本次相关 2 个测试文件共 18 个测试通过。`pnpm exec tsc --noEmit`（在 `src` 目录执行）与相关文件 Prettier 检查通过，测试仍在 Node `24.11.1` 下运行。
- 修复了 `handleDedicatedModelRequest()` 的无关请求提前读取 Provider state 问题：只有 Ollama/LM Studio 分支需要 `getState()`，Roo/OpenAI/VS Code LM 等分支不再要求旧测试 mock 提供该方法；`webviewMessageHandler.spec.ts` 当前 36 个测试全部通过。
- 最新全量测试结果：306 个测试文件通过、31 个失败、3 个跳过；5022 个测试通过、137 个失败、34 个跳过；6 个 snapshot 失败。Task Runtime 相关定向测试未见失败。
- 全量失败已初步分类：Bedrock ARN/跨区域解析、Graphics 路由与 workflow、Checkpoint Windows/Git 超时、Code Index mock/错误文案、System Info 的 `homedir().toPosix` mock、空测试 suite，以及其他旧 Provider/VS Code mock 兼容问题；目前没有证据表明这些由本轮 Task Runtime 端口接入引入。
- 本轮新增修复后的验收：`pnpm exec tsc --noEmit` 通过；相关文件 Prettier 检查通过；`pnpm bundle` 通过。执行环境仍为 Node `24.11.1`，Node `20.20.2` 和 Extension Host smoke test 尚未完成。
- 本轮补齐了 Webview/ClineProvider 测试替身的 Task handoff、Webview 状态投影和编辑消息提交能力，并让 Provider 对缺少可选 handoff 能力的旧 Task 替身保持兼容；相关 5 个测试文件共 53 个测试通过。
- 当前仍未完成：全量既有失败的逐项治理、发布级 Extension Host 验收，以及 API stream 主循环解耦；后者继续保持冻结。当前剩余失败主要集中在既有 Bedrock/Graphics/Checkpoint/Code Index、Provider/VS Code mock、快照和空测试 suite 问题，尚无证据表明由本轮 Task Runtime 端口接入引起。
- 继续收窄 Webview capability port：`TaskStatePort` 与 `WebviewHostPort.getState()` 的 `apiConfiguration` 已统一收窄为 `ProviderSettings`，移除了该边界上的 `Record<string, unknown>` / `Record<string, any>`。
- 相关 `ports.spec.ts`、`webviewMessageHandler.spec.ts` 与 Router Models 定向测试共 3 个文件、44 个测试通过；`pnpm exec tsc --noEmit` 与相关文件 Prettier 检查通过。
- 已建立独立的 `WebviewMcpPort` capability contract，并让 `WebviewHostPort` 通过接口继承保持兼容；补充端口契约测试，尚未改变 MCP handler 的运行时调用路径。
- MCP capability port 收窄验证完成：`ports.spec.ts`、`settingsMessageHandler.spec.ts`、`webviewMessageHandler.spec.ts` 共 3 个文件、41 个测试通过；`pnpm exec tsc --noEmit` 与端口文件 Prettier 检查通过。当前仍保留 `WebviewHostPort` 的兼容继承，避免一次性改动所有 Handler。
- 设置 Handler 已开始直接使用 `WebviewHandlerContext.mcp` capability，而不是从通用 `provider` 读取 MCP Hub；入口由 `webviewMessageHandler` 显式注入同一 Provider adapter，旧行为保持兼容。相关 2 个测试文件共 5 个测试通过，类型检查和 Prettier 检查通过。
- 按“先补强 Handler 边界测试”的下一步继续推进：为 Settings Handler 增加 terminal profile 变更/不变更分支测试，验证仅 profile 实际变化时调用 `TerminalRegistry.closeIdleTerminals()`。
- 本次新增验证：`settingsMessageHandler.spec.ts` 共 6 个测试通过；`pnpm exec tsc --noEmit` 和该文件 Prettier 检查通过。未触碰 Task API stream 主循环，旧 Provider 路径保持不变。

### 下一步 C：最后评估 Provider 解耦和 Rust

- 将 `ClineProvider` 拆成 Task Session、Task History、Provider Profile、Workspace、Capability 和 State Projection 服务。
- 对 Code Index 做 benchmark。
- 只有当 Rust 版本在真实负载下显著改善耗时或内存，并且构建发布成本可接受时，才引入 napi-rs。

## 九、本次全量测试基线记录

### ClineProvider 测试基线收敛（本轮）

- `src/core/webview/__tests__/ClineProvider.spec.ts` 已从 `9 failed / 83 passed` 收敛到 `92 passed`。
- 修复范围限定在测试适配层：补齐局部 `vscode`、`fs/promises`、URI、Webview 和 Task fixture；未修改 `Task.ts` 主循环。
- 校正 `MessageManager.rewindToTimestamp` 测试替身：由测试 fixture 负责精确按时间戳截断，避免重复实现编辑边界算法。
- 更新过时的资源根和 Webview HTML 断言；MCP 文件创建失败按当前 Handler 契约验证日志记录，不虚构模态错误提示。
- 当前仍存在非阻断测试噪声：MCP 空 JSON 解析日志、TaskHistoryStore `fs.watch` 目录不存在日志，以及本地 Node/Vite `file://` 警告；后续在隔离测试基础设施阶段处理。

执行命令：

```bash
pnpm exec vitest run --reporter=dot
```

此前基线结果：

- Test Files：300 passed / 36 failed / 3 skipped，共 339 个。
- Tests：4957 passed / 186 failed / 34 skipped，共 5177 个。
- Unhandled Errors：3 个。
- 观察到的代表性非本轮回归问题：
    - `ClineProvider` 测试中的 VS Code mock URI 为 `undefined`，导致 `.toString()` 异常。
    - `DiffViewProvider` 测试的 `path` mock 缺少 `normalize` 导出。
    - Bedrock 错误处理测试输出大量预期错误日志。
    - 另有快照、Graphics 和既有 Provider 测试失败，需要按测试文件逐项确认。

本轮复核结果：

- Test Files：306 passed / 31 failed / 3 skipped，共 340 个。
- Tests：5022 passed / 137 failed / 34 skipped，共 5193 个。
- Snapshots：6 个失败；未发现 Task Runtime 定向测试失败。
- 相关修复后的定向测试：5 个文件、53 个测试全部通过。

## 十、本轮继续收敛记录（2026-07-21）

- 修复 `isPathInIgnoredDirectory` 将路径计算产生的 `..` 误判为隐藏目录的问题；Code Index `DirectoryScanner` 因此不再把所有相对路径过滤为空。
- 修复 `system-info` 与 `RooProtectedController` 对全局 `String.prototype.toPosix` 的隐式依赖，改为显式使用 `toPosixPath`。
- 对齐 `ClineProvider.lockApiConfig` 测试与实际的 `createModeHandoff: false` 调用契约。
- 本轮定向回归：12 个测试文件、123 个测试全部通过，其中包含 Provider/Webview、路径兼容和 Code Index scanner。
- 验证通过：`pnpm check-types`、相关文件 Prettier 检查、`pnpm bundle`。当前环境为 Node `24.11.1`，项目声明版本为 `20.20.2`，Node 20 与 Extension Host smoke test 仍待执行。
- 本轮未重新执行全量测试；此前记录的全量结果仍为 306 个测试文件通过、31 个失败、3 个跳过；5022 个测试通过、137 个失败、34 个跳过；6 个 snapshot 失败。

## 七、重要工程约束

- 不要在测试未通过时继续做高风险 `Task.ts` 大范围重构。
- 不要把类型检查通过等同于功能完整通过。
- 不要把未执行的全量测试描述为通过。
- 不要通过删除功能分支、放宽类型为 `any` 或吞掉异常来让测试变绿。
- 保持中文和英文双语注释，尤其是公共端口、Handler 边界和关键生命周期逻辑。
- 每次任务结束都记录：已完成、当前进行中、剩余事项、测试结果和已知风险。

## 八、快速恢复提示

下次开始时，可以直接使用以下上下文：

> 继续 `plans/refactor-progress.md` 中记录的 Vertex Code 工程化重构。阶段 1-4 Webview Handler 已完成并通过定向测试、类型检查和 bundle；先检查当前工作区和测试状态，再从阶段 5 的依赖簇式 TaskHostPort 解耦开始。不要直接重写 Task 主循环，不要牺牲原功能，所有修改都要补测试并记录验证结果。

## 十一、本轮 Node 20 发布基线与全量治理（2026-07-21）

### 本轮追加更新（2026-07-21）

已完成：

- Task Runtime 的 State/Profile/Mode/History/MCP/Skills/Checkpoint/Tools 路径已接入 ProductionTaskRuntimeAdapter。
- API stream 中的状态读取、限流/重试配置和上下文压缩 Webview 通知已统一经过 Runtime helper；legacy 路径保持不变，新路径异常自动回退。
- Checkpoint 增加并发重复调用保护，Skills、Tools、MCP 和 History 均具备失败回退测试。
- Node 20.20.2 全量验证：341/341 个测试文件通过，5199 个测试中 5165 通过、34 pending、0 failed；snapshot 20/20 匹配。
- Node 20 类型检查、生产 bundle、VSIX 均通过；最新产物为 `bin/vertex-3.56.0.vsix`，约 41.41 MB。

剩余内容：

- API Handler 创建和 Provider 专有副作用仍保留在 ClineProvider 兼容边界内，尚未完全下沉为独立 Runtime port。
- MCP 工具实际执行、Native Tool 执行和 API stream 主流程仍依赖 Provider/Task 既有执行链；当前已完成单次路由与失败回退，未删除 legacy 实现。
- 需要在真实运行时回归覆盖 Provider 切换、Mode handoff、MCP/Skills 服务不可用、Checkpoint 超时和工具执行异常后，再评估移除 LegacyTaskHostAdapter。

当前结论：发布基线和依赖簇迁移已通过；剩余工作集中在 Provider 专有副作用的最终拆分与真实运行时回归，不再是全量测试失败治理或 Node 20 基线问题。

- 使用官方 portable Node `20.20.2` 执行 `pnpm install --frozen-lockfile`，安装通过；`.nvmrc` / `.tool-versions` 与实际运行时一致。
- Node 20 全量 Vitest 最终结果：`341/341` 个测试文件通过；`5199` 个测试中 `5165` 通过、`34` pending、`0` failed；snapshot `20/20` 匹配，`0` unmatched。
- 已治理的失败簇包括：Bedrock ARN（GovCloud/China/default prompt router/cross-region）、旧 Provider Telemetry 断言、路径 `toPosix` mock、CustomModes schema 错误处理、Graphics 路由/workflow 注册、Checkpoint Windows/Git 超时、OpenAI embedder 错误文案、空 suite、Task 工具与模式切换 mock、6 个快照更新。
- Node 20 `pnpm --dir src check-types` 通过；Node 20 `pnpm bundle` 通过；Node 20 `pnpm --dir src vsix` 通过，产物为 `bin/vertex-3.56.0.vsix`。
- Extension Host smoke 通过：隔离 user-data 启动时 VS Code 正确识别 `--extensionDevelopmentPath`，`VertexOrganization.vertex` 激活成功并记录 `vertex.activationCompleted`；未发现 `bad option`。专用宿主取证完成后已停止，避免遗留后台进程。
- Task Runtime 新增 `TaskRuntimeInvocationGuard`，保护 Checkpoint 并发重复调用；Skills 端口异常回退 legacy Manager；新增对应 guard、Skills fallback、Checkpoint 并发回归测试。生产入口已改为注入 `ProductionTaskRuntimeAdapter`，MCP/Skills/Checkpoint/Tools/State/Profile/Mode/History 依赖簇默认走新路径；Mode 副作用操作和 MCP/工具实际执行仍保留原 Provider 调用边界。
- 系统提示构建已接入 Runtime 读取：状态、MCP Hub、Skills metadata 通过端口进入 Prompt，服务异常时回退 legacy；定向 Prompt/Task/ClineProvider 回归 `122/122` 通过。
- 已完成生产路径回归：Adapter 定向测试、Task 回退测试、ClineProvider 回归、Node 20 全量测试、bundle/VSIX 和 Extension Host smoke 均通过。新 Adapter 未绑定 Task、服务不可用或运行异常时，Task 会记录诊断并回退 legacy 实现；默认开关后续只需在发现真实运行时问题时按依赖簇回滚。

### 本轮追加更新（2026-07-28）

已完成：

- 新增 `TaskApiPort`，Task 初始 API Handler 创建和 Provider 配置切换后的 Handler 重建均通过注入的 Runtime Adapter；Production 与 Legacy Adapter 均提供实现，Task 保留创建失败回退。
- API stream 实际 `createMessage` 发起也已纳入 `TaskApiPort`，Handler 创建、重建和请求发起共享同一 Runtime 边界。
- assistant-message 工具调度入口的 Task 状态读取已复用 Runtime state projection；Provider reference 不可用时安全返回，不再强制直接读取 Provider。
- Native Tool 分发 switch 已下沉到 `runtime/nativeToolExecutor.ts`，Production/Legacy Adapter 通过 `TaskToolsPort.executeNativeTool` 路由；assistant-message 仅准备请求上下文和回调。
- 新增 MCP `callTool` / `readResource` Runtime 端口，MCP 工具执行、资源读取以及流式 assistant-message 的 MCP Hub 解析优先走 Runtime Adapter。
- 对有副作用的 MCP 执行明确禁止异常后再次走 legacy，避免服务已收到请求后发生重复执行；执行异常交由现有工具错误处理和用户重试流程处理。
- 新增 API Handler 路由、MCP Adapter 调用和 MCP 失败不重复执行回归测试。

本轮验证：

- Runtime、MCP、assistant-message 定向回归：5 个测试文件、37 个测试全部通过。
- Runtime Adapter 与 Legacy Adapter 回归：2 个测试文件、10 个测试全部通过。
- Provider/Mode 运行时回归：5 个测试文件、60 个测试全部通过，覆盖 API Handler rebuild、sticky profile、sticky mode、锁定配置和 Task mode-handoff。
- Native Tool、assistant-message、工具目录和 Runtime 回归：33 个测试文件、563 个测试通过、5 个跳过。
- `pnpm --dir src check-types` 通过；当前执行环境为 Node `24.11.1`，仅产生项目要求 Node `20.20.2` 的 engine warning。
- `git diff --check` 未发现新增空白错误。
- 当前 Node `24.11.1` 全量 Vitest：`339` 个测试文件通过、`3` 个跳过、`0` 个失败；`5171` 个测试通过、`34` 个跳过。
- 当前 Node `24.11.1` `pnpm bundle` 通过；本结果用于本轮改动回归，Node `20.20.2` 发布基线仍以既有专门验证记录为准。

当前进行中：

- API stream 主循环仍在 `Task.ts` 中，当前已完成 API Handler 创建边界，但尚未拆分请求编排、重试和流式状态机。

剩余门禁：

- Native Tool 执行端口已完成；仍需在真实 Extension Host 中验证文件写入、命令执行、MCP、Checkpoint 和子任务等副作用链路。
- 完成 Provider 切换、Mode handoff、MCP/Skills 不可用、Checkpoint 超时和工具异常的真实 Extension Host 回归。
- 真实回归通过后再评估移除 `LegacyTaskHostAdapter` 及 legacy 分支，最后重跑 Node 20 全量测试、类型检查、bundle、VSIX 和 smoke test。
### 本轮追加更新（2026-07-28，最终验证）

- Native Tool Runtime Adapter 改造后的 Node `24.11.1` 全量 Vitest 已通过：`339` 个测试文件通过、`3` 个跳过、`0` 个失败；`5172` 个测试通过、`34` 个跳过。
- 本轮 Native Tool、MCP、assistant-message 与 Runtime 定向回归保持通过；`pnpm --dir src check-types`、`pnpm bundle` 与 `git diff --check` 均通过。
- 当前尚未完成的门禁仍是：API stream 主循环拆分、真实 Extension Host 对文件/命令/MCP/Checkpoint/子任务副作用的回归，以及 Node `20.20.2` 下对本轮改动重新执行安装、全量测试、类型检查和 bundle/VSIX。
- 在上述真实运行时回归和 Node 20 发布基线复核完成前，不删除 `LegacyTaskHostAdapter`，也不宣称重构全部完成。
### 本轮追加更新（2026-07-28，API stream 拆分第一步）

- 将 API stream 的取消感知 iterator 抽出到 `runtime/apiStreamCoordinator.ts`，保留底层 iterator 供尾部 usage drain 使用，并补充已取消请求与顺序测试。
- 将流式响应内容状态抽出到 `runtime/apiStreamContentState.ts`，集中管理 assistant 文本、reasoning 格式化和 grounding sources；`Task.ts` 主循环仅负责事件编排。
- 相关回归：9 个测试文件、90 个测试通过；`pnpm --dir src check-types` 与 Prettier 检查通过。
- API stream 主循环的 chunk 分发和重试状态机已拆分；真实 Extension Host 回归仍待完成，本轮全量测试、类型检查和 bundle 已通过。
- 全量验证已完成：`341` 个测试文件通过、`3` 个跳过、`0` 个失败；`5177` 个测试通过、`34` 个跳过。`pnpm --dir src check-types`、`pnpm bundle` 和 `git diff --check` 均通过（本轮环境为 Node `24.11.1`，仅有 Node `20.20.2` engine warning）。
### 本轮追加更新（2026-07-28，API stream 拆分完成）

- `apiStreamCoordinator.ts` 负责可取消 iterator 和底层 stream 读取；`apiStreamContentState.ts` 负责文本、reasoning、grounding 状态。
- `apiStreamChunkDispatcher.ts` 已接管 reasoning、usage、grounding、text、partial tool call 和 complete tool call 的 chunk 分类分发；Task 仅保留工具副作用 handler。
- `apiStreamRetryPolicy.ts` 已接管首包失败的 context-window、自动重试和用户确认重试决策；重试副作用仍由 Task 执行，避免改变现有交互。
- 新增 dispatcher/retry contract tests；相关回归 59 个文件、797 个测试通过，新增 5 个 Runtime 测试通过。
- 最新 Node `24.11.1` 全量 Vitest：`343` 个测试文件通过、`3` 个跳过、`0` 个失败；`5182` 个测试通过、`34` 个跳过。类型检查、Prettier、bundle 和 `git diff --check` 均通过。
- API stream 已完成“主循环负责编排、Runtime 模块负责读取/状态/分发/策略”的拆分；剩余验收不再是单元逻辑拆分，而是真实 Extension Host 回归与 Node `20.20.2` 发布基线复验。

### 本轮追加更新（2026-07-28，真实 Extension Host 副作用回归完成）

- 新增 `src/extensionHostSideEffectSmoke.ts`，仅在 `VERTEX_EXTENSION_HOST_SMOKE=1` 时注册内部回归命令，不改变普通生产启动路径。
- 新增 `scripts/run-extension-host-side-effects.mjs` 和 `scripts/extension-host-side-effects.test.js`：使用隔离 user-data、临时 Git workspace 和归档版 VS Code，在真实 Extension Host 中执行生产 `Task`/Runtime 路径。
- 新增本地 stdio MCP fixture `scripts/extension-host-mcp-server.cjs`，覆盖真实 MCP server 连接、工具发现和工具调用。
- 已实际通过：`write_to_file` 文件写入、`execute_command` 命令执行、MCP `echo` 工具调用、Checkpoint shadow git 初始化与保存、父任务到子任务的委派及清理。
- 可重复命令：`pnpm test:extension-host:side-effects`。本轮结果：VS Code Extension Host exit code `0`，回归报告包含 `checkpoint.initialized=true`、`subtask.created=true`，无业务失败。
- 启动器会清理 `ELECTRON_RUN_AS_NODE=1`，避免当前开发 shell 把 Code.exe 误当 Node 进程而产生 `bad option`；归档包现已可用于真实宿主测试。
- 本轮 `pnpm --dir src check-types`、`pnpm bundle`、真实 Extension Host 回归均通过；Node `20.20.2` 发布基线仍需在对应 Node 环境重新执行。
- 剩余门禁：Node 20 下重新安装依赖/全量测试/类型检查/bundle/VSIX；随后再评估 `LegacyTaskHostAdapter` 的移除，当前不能宣称整个重构完成。

### 本轮追加更新（2026-07-28，Node 20.20.2 发布基线复验完成）

- 使用官方便携版 Node `20.20.2` 驱动 pnpm `10.8.1`，未修改系统 Node；`pnpm install --frozen-lockfile` 成功，10 个 workspace 项目依赖一致。
- Node 20 全量 Vitest：`343` 个测试文件通过、`3` 个跳过、`0` 个失败；`5182` 个测试通过、`34` 个跳过。
- Node 20 `pnpm --dir src check-types` 通过。
- Node 20 `pnpm bundle` 通过。
- Node 20 `pnpm --dir src vsix` 通过，产物为 `bin/vertex-3.56.0.vsix`，约 `41.42 MB`。
- 当前已完成真实 Extension Host 副作用回归和 Node 20 发布基线复验；剩余工作转为 LegacyTaskHostAdapter/Provider 专有副作用的最终解耦评估，以及在确认无兼容风险后再移除 legacy 路径。

### 本轮追加更新（2026-07-28，子任务 Runtime 依赖簇迁移）

- 新增 `TaskSubtaskPort`，由 `ProductionTaskRuntimeAdapter` 和 `LegacyTaskHostAdapter` 分别承接父任务到子任务的委派。
- `Task.startSubtask()` 不再直接读取 `providerRef` 或调用 `ClineProvider.delegateParentAndOpenChild()`。
- `NewTaskTool` 改为调用 `task.startSubtask()`，子任务副作用不再绕过 Task Runtime。
- 定向回归：8 个测试文件、41 个测试通过；类型检查和 bundle 通过。
- Extension Host smoke 已重新通过，文件写入、命令执行、MCP、Checkpoint 以及经 Runtime 委派的子任务全部通过。
- 当前仍保留 Provider 直接依赖的部分主要是 legacy fallback、系统 Prompt 组装、Provider 生命周期/持久化兼容和 Orchestrator 专用能力；这些需要继续按簇迁移，暂不删除 `LegacyTaskHostAdapter`。

### 本轮追加更新（2026-07-28，系统 Prompt 服务依赖簇迁移）

- `Task.getSystemPrompt()` 改为通过 `TaskHostPort` 获取 Extension Context，通过 `TaskDependencyPorts` 获取 MCP 状态、MCP Hub 和 Skills 查询，不再直接读取 `providerRef`、`provider.context` 或 `provider.getSkillsManager()`。
- `ProductionTaskRuntimeAdapter` 和 `LegacyTaskHostAdapter` 统一负责 MCP Hub 的既有实例读取及 `McpServerManager` 初始化回退，保留原有兼容行为。
- 定向回归：5 个测试文件、42 个测试通过；`pnpm --dir src check-types`、`pnpm bundle` 和真实 Extension Host smoke 全部通过。
- Node `20.20.2` 复验：343 个测试文件通过、3 个跳过；5183 个测试通过、34 个跳过；类型检查、bundle、VSIX 全部通过，产物仍为 `bin/vertex-3.56.0.vsix`（41.42 MB）。
- 剩余 Provider 直接依赖已收敛到 legacy fallback、Provider 生命周期/持久化兼容、初始化监听和 Orchestrator 专用能力；Prompt 服务解析这一簇已完成，暂不删除 `LegacyTaskHostAdapter`。

### 本轮追加更新（2026-07-28，历史持久化依赖簇迁移）

- `Task.saveClineMessages()` 统一通过 `TaskRuntimeHistoryPort.updateHistoryItem()` 写入任务历史；legacy adapter 仍在端口内部承接原 Provider 实现。
- 新 Runtime 路径发生写入异常时保留 Provider 回退；legacy 路径不再在 Task 内重复执行同一个 Provider 写入，避免副作用重复调用。
- 定向回归：`Task.mode-handoff.spec.ts` 与 `Task.persistence.spec.ts` 共 24 个测试通过，覆盖端口写入、失败回退、重试和消息持久化。
- Node `20.20.2` 最终复验：343 个测试文件通过、3 个跳过；5183 个测试通过、34 个跳过；类型检查、bundle、VSIX 全部通过，VSIX 为 `bin/vertex-3.56.0.vsix`（41.42 MB）。
- 当前剩余 Provider 直接依赖主要是初始化/生命周期监听、Provider 专属 Orchestrator 能力以及必要的 legacy fallback；历史持久化主路径已完成 Runtime 化，仍暂不删除 `LegacyTaskHostAdapter`。

### 本轮追加更新（2026-07-28，子任务迁移后的 Node 20 基线复验）

- Node `20.20.2` 下重新执行全量 Vitest：`343` 个测试文件通过、`3` 个跳过、`0` 个失败；`5183` 个测试通过、`34` 个跳过。
- Node 20 `pnpm --dir src check-types` 通过。
- Node 20 `pnpm bundle` 通过。
- Node 20 `pnpm --dir src vsix` 通过，产物为 `bin/vertex-3.56.0.vsix`，大小 `41.42 MB`。
- 子任务 Runtime 迁移后的真实 Extension Host smoke 仍通过，已覆盖文件写入、命令执行、MCP、Checkpoint 和 Runtime 委派的子任务副作用。
- 当前剩余工作仍集中在 Task 的其他 Provider 专有依赖簇：legacy fallback、系统 Prompt 组装、Provider 生命周期/持久化兼容和 Orchestrator 专用能力；完成这些迁移并通过回归后，才评估移除 `LegacyTaskHostAdapter`。

### 状态校正（2026-07-28，Prompt 与历史簇已在后续轮次完成）

- 上述“当前进行中/剩余”记录属于子任务迁移完成时的阶段快照；之后系统 Prompt 服务解析簇和历史持久化簇均已完成并通过 Node 20 复验。
- 当前准确的剩余范围为：Provider 初始化/生命周期监听、Orchestrator 专属能力，以及必要的 legacy fallback 清理与最终兼容风险评估。

### 本轮追加更新（2026-07-28，Provider 初始化与生命周期监听解耦完成）

- Task 的 Mode/Profile 初始化统一先通过 `TaskModePort`、`TaskProfilePort` 读取；Runtime 失败时保留原 Provider 状态回退和诊断日志。
- Provider Profile 变化统一通过 `TaskEventPort.onProviderProfileChanged()` 订阅，`Task.dispose()` 统一释放 Runtime subscription，不再在 Task 内直接调用 Provider `on/off`。
- Legacy/Production Adapter 对缺少 `provider.on/off` 的测试或过渡宿主安全跳过订阅，避免生命周期初始化阻断任务创建。
- 新增生命周期回归：确认 Runtime Mode/Profile 初始化、Profile 更新、订阅和 dispose 均通过端口完成；定向回归 5 个测试文件、33 个测试通过。
- Node `20.20.2` 最终验证：343 个测试文件通过、3 个跳过；5184 个测试通过、34 个跳过；类型检查、bundle、VSIX 和 Extension Host smoke 全部通过，VSIX 为 `bin/vertex-3.56.0.vsix`（41.42 MB）。
- 当前剩余范围收敛为 Orchestrator 专属能力、必要的 legacy fallback 清理，以及最终移除 `LegacyTaskHostAdapter` 前的兼容风险评估。
### 本轮追加更新（2026-07-28，Orchestrator 专属能力迁移与 LegacyTaskHostAdapter 清理完成）

- Orchestrator 的模式切换、Profile 切换、自动回切和 handoff 路由统一先通过 Task Runtime 端口；Provider 仅作为异常时的兼容回退。
- Task 默认不再隐式实例化 legacy adapter，生产路径统一使用 `ProductionTaskRuntimeAdapter`。
- 已删除 `src/core/task/runtime/LegacyTaskHostAdapter.ts` 及其专属测试，并移除 Runtime index 导出；源码检索已确认无剩余 `LegacyTaskHostAdapter` 引用。
- 真实 Extension Host smoke 已通过：文件写入、命令执行、MCP stdio 工具调用、Checkpoint 初始化/保存、父子任务委派均成功，Extension Host exit code 为 `0`。
- Node `20.20.2` 最终复验已通过：全量 Vitest `342` 个测试文件通过、`3` 个跳过；`5179` 个测试通过、`34` 个跳过；类型检查、bundle、VSIX 均通过，VSIX 为 `bin/vertex-3.56.0.vsix`（约 `41.42 MB`）。
- `Task.getProvider()` 暂保留为外部 OrchestratorEngine 兼容 API；仓库内无调用，但外部调用方未知。当前仍存在少量 Provider 直接回退调用，仅在 Runtime 异常时触发。
- 因此，`LegacyTaskHostAdapter` 已完成移除；重构是否达到“零 Provider 兼容边界”，还取决于确认 `Task.getProvider()` 和异常回退的外部兼容性后再做最后删除。
### 本轮追加更新（2026-07-28，移除 Task.getProvider 与 Runtime 异常 Provider fallback）

- 全仓库源码与构建输入检索确认没有 `Task.getProvider()` 调用；该公开兼容方法已从 `Task` 移除，Orchestrator 相关逻辑改为使用 Runtime 端口和 `getCurrentProviderSettings()`。
- Runtime 异常不再回退并重复调用 Provider：模式/Profile handoff、状态初始化/读取、Webview 投影、Skills、MCP Hub、History、API handler、Tools、Checkpoint 均改为记录诊断后直接失败或使用安全默认值。
- 有副作用的 Runtime 操作不会在异常后重试另一条 Provider/legacy 路径，避免重复写入、重复命令、重复 MCP 调用和重复 Checkpoint。
- 新增回归测试，验证模式/Profile 操作、History、Skills、Checkpoint、Tools 和 Webview 投影失败时不会调用 Provider 重试；定向回归 4 个测试文件、29 个测试通过。
- Node `20.20.2` 全量复验：342 个测试文件通过、3 个跳过；5180 个测试通过、34 个跳过；类型检查、bundle、VSIX 均通过，VSIX 为 `bin/vertex-3.56.0.vsix`（约 `41.42 MB`）。
- 真实 Extension Host smoke 再次通过：文件写入、命令执行、MCP stdio、Checkpoint、父子任务委派均成功，Extension Host exit code 为 `0`。
- `TaskRuntimeFeatureFlags` 中显式选择的 `legacy` 分支仍作为受控兼容/回滚路径保留；它们不会因 Runtime 异常自动触发。当前已清理的是异常 fallback 和 `Task.getProvider()` 兼容暴露。
### 本轮追加更新（2026-07-28，测试临时文件清理）

- 已删除 Extension Host 测试生成的 `.vscode-test/` 目录，释放约 `898 MB` 的 VS Code 归档与测试缓存。
- 已删除空的 `.tmp-smoke/` 目录和旧的 `cline-provider-test.log` 测试日志。
- `temp/debug.md` 未确认属于临时测试产物，已保留；后续执行 Extension Host smoke 时，VS Code 测试归档会按需重新下载。
