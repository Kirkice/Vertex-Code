# Mini Modes - 学习项目

一个极简 VS Code 扩展，演示 Vertex 的自定义模式（Custom Modes）核心概念。

**对应 Vertex 的关键文件**：`packages/types/src/modes.ts`、`src/shared/tools.ts`、`src/shared/modes.ts`、`src/core/prompt.ts`、`src/extension.ts` — 每个部分都详细注释了对应关系和作用说明。

## 功能特性

- **自定义模式配置** — 在 `settings.json` 中添加 `miniModes.customModes` 定义自定义模式
- **模式切换** — 在 UI 中切换当前模式，查看不同模式的工具权限
- **系统提示组装** — 实时预览当前模式的系统提示（roleDefinition + customInstructions + 工具描述 + 模式约束）
- **演示模式** — 不需要真实 LLM 交互，UI 会展示组装的 prompt，方便理解模式如何影响对话

## 每个模式包含

- **角色定义（roleDefinition）** — 拼入 system prompt 的核心内容
- **自定义指令（customInstructions）** — 附加补充说明
- **工具权限（toolGroups）** — 决定该模式可以使用哪些工具组

## 内置模式

| 模式 | 工具组 | 说明 |
|------|--------|------|
| Code | read, edit, terminal, search, browser | 全功能编码模式 |
| Architect | read, search | 规划设计模式，不能编辑文件 |
| Ask | read | 快速问答模式 |

## 使用方式

1. 按 `Ctrl+Shift+P`，输入 `Mini Modes: Open Chat` 打开聊天面板
2. 在下拉菜单中选择模式（Code / Architect / Ask）
3. 点击 **👁 Preview Prompt** 查看当前模式的系统提示组装结果
4. 输入消息发送 — 无 API Key 时展示 demo prompt，有 API Key 时调用真实 LLM
5. Enter 发送消息，Ctrl+Enter 换行

## 配置自定义模式

在 VS Code 的 `settings.json` 中添加：

```json
{
  "miniModes.customModes": [
    {
      "slug": "debugger",
      "name": "Debugger",
      "roleDefinition": "You are an expert debugger. You can read files, search the codebase, and execute terminal commands to help diagnose and fix bugs.",
      "customInstructions": "Focus on identifying root causes rather than symptoms.",
      "toolGroups": ["read", "terminal", "search"]
    }
  ],
  "miniModes.apiKey": "",
  "miniModes.apiModel": "gpt-4o-mini"
}
```

**模式合并规则（与 Vertex 一致）：**
- 自定义模式 slug 与内置相同 → 覆盖（override）
- 自定义模式 slug 是全新的 → 追加（add）
- 查找时始终自定义优先

## 项目结构

```
src/
  extension.ts          # 扩展入口（注册命令、监听设置）
  types/modes.ts        # 类型定义 + 3 个内置模式
  core/
    modes.ts            # 模式引擎（查找、合并、摘要）
    tools.ts            # 5 个工具组定义
    prompt.ts           # 系统提示组装
  webview/
    ChatPanel.ts        # WebView 面板管理（消息通信、HTML 加载）
webview-ui/
  index.html            # 聊天 UI 结构
  main.js               # 前端交互逻辑
  style.css             # VS Code 主题风格样式
```

## 开发

```bash
# 编译
npm run compile

# 监听模式
npm run watch
```

按 F5 在 VS Code 中启动扩展开发调试。