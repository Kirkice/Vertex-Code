# Vertex Code 工程化重构进度记录

> 最后更新：2026-07-17
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

- 项目声明 Node `20.20.2`。
- 当前执行环境是 Node `24.11.1`，pnpm 输出 engine warning，但本轮类型检查和构建均成功。
- 当前没有把“全量测试通过”作为验收结论；此前全量测试存在既有 `vscode` 解析问题及 Graphics 相关失败，后续如果需要发布级验收，仍应单独处理。

## 四、当前未完成事项

### 1. 阶段 5：Task Runtime 解耦

阶段 5目前只完成了依赖审计和安全边界评估，没有完成 `Task.ts` 的核心解耦。

`Task.ts` 仍直接或间接依赖：

- `ClineProvider` 的完整类型和大量 facade 方法。
- MCP Hub 和 MCP Server Manager。
- Skills Manager。
- Checkpoint、Diff、Workspace 和 VS Code Extension Context。
- Tool 实现、工具状态、系统提示构建和 Mode handoff。
- Provider Profile、Task History 和 Webview 状态推送。

之前尝试直接建立宽泛 `TaskHostPort` 并替换 `Task` 类型依赖时，类型检查暴露出大量跨模块耦合。该尝试已撤销，没有保留不完整接口，也没有为了通过编译而使用大面积 `any` 或强制类型断言。

### 2. Webview 端口仍需要继续收窄

目前仍存在以下过渡技术债：

- `WebviewHostPort` 接口偏大。
- Worktree Handler 使用 `as ClineProvider` 过渡适配。
- Task History Handler 使用 `as ClineProvider` 过渡适配。
- Checkpoint 调用仍存在 `as any` 过渡调用。
- Router Models 返回处仍存在 `Partial<RouterModels>` 到 `RouterModels` 的强制断言。
- `Record<string, any>` 等宽泛类型仍需逐步替换。

### 3. 全量测试与发布级验证

尚未完成：

- 全量 `src` 测试的稳定通过。
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

## 五、推荐的下一次执行顺序

### 下一步 A：先补强测试，不要直接重写 Task 主循环

1. 为当前 Handler 测试增加边界分支：
    - Settings 的 terminal profile 变更和 idle terminal 清理。
    - Profile 保存、重命名、错误处理和空 Profile 删除。
    - Checkpoint payload 校验、取消任务、超时和 restore。
    - Task History 删除失败、批量删除失败、当前任务导出和分享提示。
2. 运行新增测试和现有相关 Webview 测试。
3. 保持类型检查和 bundle 验证通过。

### 下一步 B：拆分 Task Runtime 的依赖簇

建议按以下低风险顺序推进：

1. 先新增类型明确的 `TaskHostPort`，只描述一个依赖簇，不要一次覆盖整个 Provider。
2. 优先抽离只读状态和日志能力：
    - `getState`
    - `log`
    - `postMessageToWebview`
    - `postStateToWebviewWithoutTaskHistory`
3. 再抽离 `TaskHistoryPort`。
4. 再抽离 `ModeProfilePort`。
5. 再抽离 `McpPort` 和 `SkillsPort`。
6. 最后才考虑 Tool、Checkpoint 和 API stream 主循环。
7. 每完成一个依赖簇，都必须增加独立测试并运行类型检查、定向测试和 bundle。

### 下一步 C：最后评估 Provider 解耦和 Rust

- 将 `ClineProvider` 拆成 Task Session、Task History、Provider Profile、Workspace、Capability 和 State Projection 服务。
- 对 Code Index 做 benchmark。
- 只有当 Rust 版本在真实负载下显著改善耗时或内存，并且构建发布成本可接受时，才引入 napi-rs。

## 六、重要工程约束

- 不要在测试未通过时继续做高风险 `Task.ts` 大范围重构。
- 不要把类型检查通过等同于功能完整通过。
- 不要把未执行的全量测试描述为通过。
- 不要通过删除功能分支、放宽类型为 `any` 或吞掉异常来让测试变绿。
- 保持中文和英文双语注释，尤其是公共端口、Handler 边界和关键生命周期逻辑。
- 每次任务结束都记录：已完成、当前进行中、剩余事项、测试结果和已知风险。

## 七、快速恢复提示

下次开始时，可以直接使用以下上下文：

> 继续 `plans/refactor-progress.md` 中记录的 Vertex Code 工程化重构。阶段 1-4 Webview Handler 已完成并通过定向测试、类型检查和 bundle；先检查当前工作区和测试状态，再从阶段 5 的依赖簇式 TaskHostPort 解耦开始。不要直接重写 Task 主循环，不要牺牲原功能，所有修改都要补测试并记录验证结果。
