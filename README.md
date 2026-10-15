# Vertex CLI

Vertex 是一个可安装、可交互且可脚本化的 Node.js coding-agent CLI。项目的唯一发布入口为 `vertex`，运行时不包含图形界面宿主或浏览器界面。

## 安装与运行

开发环境要求 Node.js `20.20.2` 和 pnpm `10.8.1`。

```bash
pnpm install
pnpm build
pnpm --filter @vertex/cli exec vertex --help
```

常用命令：

```bash
# 交互式终端会话
vertex

# 单次任务
vertex "列出项目文件"

# 适用于自动化的结构化输出
vertex run "检查项目配置" --output stream-json

# 环境、认证、MCP 与会话管理
vertex doctor
vertex auth status
vertex config get
vertex mcp list
vertex resume <session-id>
```

`vertex run` 支持 `text`、`json` 与 `stream-json` 三种输出格式。机器格式只写入标准输出；诊断信息与进度信息不污染机器可读输出。

## 工作区架构

| 位置 | 职责 |
| --- | --- |
| [`apps/cli`](apps/cli) | 可发布命令、命令行参数、交互 TUI、非交互渲染 |
| [`packages/agent-runtime`](packages/agent-runtime) | AgentSession、运行时事件、审批状态机与工具调度 |
| [`packages/node-host`](packages/node-host) | Node 文件系统、Shell、Git、配置、密钥、MCP 与 Skills 适配器 |
| [`packages/core`](packages/core) | 平台无关的消息、历史、工作树及通用算法 |
| [`packages/types`](packages/types) | CLI 协议、配置、事件和跨包序列化契约 |

运行时通过 host ports 访问文件系统、子进程、Git 与持久化服务。CLI、运行时与 Node Host 均不依赖编辑器 API。

## 开发与验证

```bash
# 静态检查、测试与构建
pnpm lint
pnpm check-types
pnpm test
pnpm build

# CLI 定向验证
pnpm cli:test
pnpm cli:build
pnpm cli:pack-smoke
```

打包冒烟测试会从 npm tarball 安装 CLI，并验证 `vertex --version`、`vertex doctor` 与 mock `vertex run`。

## 安全模型

写文件、执行 Shell 命令和 MCP 写操作默认需要审批。仅在显式传入 `--yolo` 或命中持久化 allowlist 时才允许跳过审批。配置、profiles、MCP 定义与会话数据由 Node Host 存储在用户配置目录中；敏感凭证使用独立 SecretStore 管理。

## 贡献

提交前应至少执行 [`pnpm lint`](package.json)、[`pnpm check-types`](package.json) 与 [`pnpm test`](package.json)。新增能力必须通过 [`apps/cli`](apps/cli) 与 [`packages/agent-runtime`](packages/agent-runtime) 的公开协议接入，不能引入任何编辑器运行时依赖。

许可证见 [`LICENSE`](LICENSE)。
