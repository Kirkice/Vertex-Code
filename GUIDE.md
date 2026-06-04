# Mini Modes 学习指南

> 本指南帮助你理解和阅读 Mini Modes 项目的代码，快速掌握 Roo-Code 自定义模式系统的核心概念。

---

## 📚 项目概述

Mini Modes 是一个**极简的 VS Code 扩展**，用于演示 Roo-Code 的自定义模式（Custom Modes）系统。它展示了：

- **模式（Mode）**：定义 AI 助手的角色、权限和行为
- **工具组（Tool Groups）**：控制 AI 可以使用的工具集合
- **提示词组装（Prompt Assembly）**：根据模式动态生成系统提示词

**目标**：通过阅读这些代码，理解如何在 AI 助手中实现灵活的角色和权限控制。

---

## 🗂️ 文件结构

```
AgentProject/
├── src/                          # TypeScript 源码
│   ├── extension.ts              # 扩展入口（⭐ 起点）
│   ├── types/
│   │   └── modes.ts              # 类型定义 + 内置模式（⭐ 先读）
│   ├── core/
│   │   ├── modes.ts              # 模式管理逻辑（查找、合并、判断）
│   │   ├── tools.ts              # 工具组定义和映射
│   │   └── prompt.ts             # 提示词组装逻辑
│   └── webview/
│       └── ChatPanel.ts          # WebView 面板管理（消息通信）
│
├── webview-ui/                   # WebView 前端（纯 JS/HTML/CSS）
│   ├── index.html                # 界面结构
│   ├── main.js                   # 前端交互逻辑
│   └── style.css                 # 样式
│
├── out/                          # 编译输出（自动生成，不用看）
├── package.json                  # 扩展清单和配置
└── tsconfig.json                 # TypeScript 配置
```

---

## 📖 推荐阅读顺序

### 第一步：理解类型定义（5 分钟）

**文件**：`src/types/modes.ts`

这是整个项目的**数据模型**，定义了核心概念：

```typescript
// 1. 工具组（ToolGroup）— 5 种能力分类
type ToolGroup = "read" | "edit" | "terminal" | "search" | "browser"

// 2. 模式配置（ModeConfig）— 定义一个 AI 角色
interface ModeConfig {
  slug: string              // 唯一标识（如 "code"）
  name: string              // 显示名称（如 "Code"）
  roleDefinition: string    // 角色定义（系统提示词的核心）
  customInstructions?: string // 自定义指令（附加说明）
  toolGroups: ToolGroup[]   // 可用的工具组列表
}
```

**关键发现**：
- 内置了 3 个默认模式：`Code`、`Architect`、`Ask`
- `Code` 模式拥有所有 5 个工具组
- `Architect` 只有 `read` + `search`（不能编辑）
- `Ask` 只有 `read`（只能读文件）

**思考**：这种设计如何影响 AI 的行为？

---

### 第二步：理解工具组映射（3 分钟）

**文件**：`src/core/tools.ts`

这个文件将抽象的"工具组"映射到具体的"工具名"：

```typescript
const TOOL_GROUPS = {
  read:     { tools: ["read_file", "list_files"] },
  edit:     { tools: ["write_to_file", "replace_in_file", "create_file"] },
  terminal: { tools: ["execute_command"] },
  search:   { tools: ["search_files", "search_regex"] },
  browser:  { tools: ["browse_url", "fetch_content"] },
}

const ALWAYS_AVAILABLE_TOOLS = ["ask_followup_question"]
```

**关键发现**：
- 每个工具组包含 1-3 个具体工具
- `ask_followup_question` 是所有模式都有的"常驻工具"
- 工具名是字符串，实际执行逻辑不在这里（这里是模拟）

**思考**：如果要添加一个新的工具组（如 "database"），需要改哪些地方？

---

### 第三步：理解模式管理逻辑（5 分钟）

**文件**：`src/core/modes.ts`

这个文件实现了模式的**查找和合并**规则：

```typescript
// 查找模式（自定义优先）
function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig

// 合并模式（自定义覆盖内置）
function getAllModes(customModes?: ModeConfig[]): ModeConfig[]
```

**关键规则**：
1. **自定义优先**：如果用户定义了同名模式，优先使用自定义的
2. **覆盖 vs 追加**：
   - slug 相同 → 覆盖内置模式
   - slug 不同 → 追加新模式
3. **默认模式**：第一个内置模式（`code`）是默认值

**示例**：
```typescript
// 内置模式
DEFAULT_MODES = [code, architect, ask]

// 用户定义
customModes = [
  { slug: "code", name: "My Code", ... },  // 覆盖内置 code
  { slug: "debug", name: "Debug", ... }     // 追加新模式
]

// 合并结果
getAllModes(customModes) → [My Code, architect, ask, debug]
```

**思考**：这种设计有什么好处？（提示：灵活性、可扩展性）

---

### 第四步：理解提示词组装（10 分钟）

**文件**：`src/core/prompt.ts`

这是**最核心的逻辑**，将模式配置转换为 AI 能理解的提示词：

```typescript
function buildSystemPrompt(mode: ModeConfig): string {
  const sections: string[] = []

  // 1. 角色定义（你是谁）
  sections.push(`# Role\n\n${mode.roleDefinition}`)

  // 2. 自定义指令（额外要求）
  if (mode.customInstructions) {
    sections.push(`# Custom Instructions\n\n${mode.customInstructions}`)
  }

  // 3. 工具描述（你能做什么）
  const toolSection = buildToolSection(mode.toolGroups)
  sections.push(toolSection)

  // 4. 模式约束（你不能做什么）
  const constraintSection = buildConstraintSection(mode)
  sections.push(constraintSection)

  return sections.join("\n\n---\n\n")
}
```

**关键发现**：
- 提示词分为 4 个部分：角色、指令、工具、约束
- `buildToolSection` 会列出可用工具组和禁用工具组
- `buildConstraintSection` 会明确告诉 AI "不能编辑"、"不能执行命令"等

**示例输出**（Architect 模式的提示词）：
```markdown
# Role
You are an expert software architect...

# Custom Instructions
Focus on providing clear analysis...

# Available Tools
## read
- read_file
- list_files

## search
- search_files
- search_regex

## Disabled Tools (DO NOT USE)
- ❌ write_to_file
- ❌ execute_command
...

# Mode Constraints
You cannot edit, create, or modify files.
You cannot execute terminal commands.
```

**思考**：这种提示词结构如何确保 AI 遵守权限限制？

---

### 第五步：理解扩展入口（5 分钟）

**文件**：`src/extension.ts`

这是 VS Code 扩展的**启动入口**，职责很简单：

```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. 注册命令
  vscode.commands.registerCommand("miniModes.openChat", () => {
    ChatPanel.createOrShow(context.extensionUri, customModes)
  })

  // 2. 监听配置变更
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("miniModes.customModes")) {
      // 更新模式列表
    }
  })
}
```

**关键发现**：
- 扩展只注册了一个命令：`miniModes.openChat`
- 配置变更时会动态更新模式列表
- 实际 UI 逻辑在 `ChatPanel.ts` 中

**思考**：如果要添加更多命令（如 `miniModes.switchMode`），需要改哪些地方？

---

### 第六步：理解 WebView 通信（10 分钟）

**文件**：`src/webview/ChatPanel.ts` + `webview-ui/main.js`

这部分实现了**后端（扩展）和前端的消息通信**：

**后端（ChatPanel.ts）**：
```typescript
// 监听前端消息
this._panel.webview.onDidReceiveMessage((msg) => {
  if (msg.type === "switchMode") {
    this._sendModeSummary()  // 发送当前模式信息
  }
  if (msg.type === "previewPrompt") {
    this._sendPromptPreview()  // 发送组装的提示词
  }
})

// 发送消息给前端
this._panel.webview.postMessage({
  type: "modeSummary",
  summary: {...}
})
```

**前端（main.js）**：
```javascript
// 发送消息给后端
function sendToExtension(msg) {
  vscode.postMessage(msg)
}

// 监听后端消息
window.addEventListener("message", (event) => {
  const msg = event.data
  if (msg.type === "modeSummary") {
    updateModeDisplay(msg.summary)  // 更新 UI
  }
  if (msg.type === "promptPreview") {
    showPromptPreview(msg.content)  // 显示提示词
  }
})
```

**关键发现**：
- 使用 `postMessage` 进行双向通信
- 消息类型包括：`switchMode`、`previewPrompt`、`sendMessage`、`modeSummary`、`promptPreview`、`assistantReply`
- 前端是纯 JS，不依赖框架

**思考**：这种通信模式有什么优缺点？（对比 React/Vue 的状态管理）

---

## 🎯 核心概念总结

| 概念 | 文件 | 作用 |
|------|------|------|
| **ModeConfig** | `types/modes.ts` | 定义一个 AI 角色的完整配置 |
| **ToolGroup** | `types/modes.ts` | 5 种工具能力的分类 |
| **工具映射** | `core/tools.ts` | 工具组 → 具体工具名的映射 |
| **模式合并** | `core/modes.ts` | 自定义模式覆盖/追加内置模式 |
| **提示词组装** | `core/prompt.ts` | 根据模式生成系统提示词 |
| **WebView 通信** | `webview/ChatPanel.ts` + `main.js` | 前后端消息传递 |

---

## 🧪 调试和测试

### 1. 查看组装的提示词

在 VS Code 中：
1. 按 `Ctrl+Shift+P` → 输入 `Mini Modes: Open Chat`
2. 点击顶部的 **👁 Preview Prompt** 按钮
3. 查看当前模式的完整提示词

**实验**：
- 切换不同模式（Code / Architect / Ask），对比提示词差异
- 在 `settings.json` 中添加自定义模式，观察提示词变化

### 2. 调试 TypeScript 代码

在 VS Code 中：
1. 按 `F5` 启动调试（Extension Development Host）
2. 在 `src/` 中的代码设置断点
3. 在新窗口中运行命令，观察断点触发

### 3. 调试前端代码

在 VS Code 中：
1. 打开 WebView 面板
2. 右键 → **检查**（或按 `Ctrl+Shift+I`）
3. 在 **Console** 中查看日志
4. 在 **Sources** 中调试 `main.js`

---

## 🔧 常见修改场景

### 场景 1：添加新的工具组

**需求**：添加 `database` 工具组，包含 `query_db` 和 `list_tables` 工具。

**修改步骤**：

1. **`src/types/modes.ts`**：
   ```typescript
   type ToolGroup = "read" | "edit" | "terminal" | "search" | "browser" | "database"
   ```

2. **`src/core/tools.ts`**：
   ```typescript
   const TOOL_GROUPS = {
     // ... 现有工具组
     database: { tools: ["query_db", "list_tables"], description: "Query databases" }
   }
   ```

3. **`src/core/prompt.ts`**（可选）：
   ```typescript
   if (!enabledGroupNames.includes("database")) {
     lines.push("**You cannot query databases.**")
   }
   ```

4. **重新编译**：`npm run compile`

---

### 场景 2：添加新的内置模式

**需求**：添加 `Reviewer` 模式，只能读文件和搜索。

**修改步骤**：

1. **`src/types/modes.ts`**：
   ```typescript
   export const DEFAULT_MODES: ModeConfig[] = [
     // ... 现有模式
     {
       slug: "reviewer",
       name: "Reviewer",
       description: "Code review mode - read and search only",
       roleDefinition: "You are an expert code reviewer...",
       customInstructions: "Focus on code quality, best practices, and potential bugs.",
       toolGroups: ["read", "search"]
     }
   ]
   ```

2. **重新编译**：`npm run compile`

---

### 场景 3：修改提示词格式

**需求**：在提示词中添加"示例对话"部分。

**修改步骤**：

1. **`src/core/prompt.ts`**：
   ```typescript
   function buildSystemPrompt(mode: ModeConfig): string {
     const sections: string[] = []
     
     // ... 现有部分
     
     // 5. 示例对话（新增）
     sections.push(`# Example Interaction\n\nUser: Hello\nAssistant: Hi! How can I help?`)
     
     return sections.join("\n\n---\n\n")
   }
   ```

2. **重新编译**：`npm run compile`

---

## 📝 配置文件说明

### `package.json`

```json
{
  "contributes": {
    "commands": [
      {
        "command": "miniModes.openChat",
        "title": "Mini Modes: Open Chat"
      }
    ],
    "configuration": {
      "properties": {
        "miniModes.customModes": {
          "type": "array",
          "description": "自定义模式列表"
        },
        "miniModes.apiKey": {
          "type": "string",
          "description": "OpenAI API Key（可选）"
        },
        "miniModes.apiBase": {
          "type": "string",
          "description": "API Base URL（自定义端点）"
        }
      }
    }
  }
}
```

### `settings.json` 配置示例

```json
{
  "miniModes.customModes": [
    {
      "slug": "debug",
      "name": "Debug",
      "roleDefinition": "You are an expert debugger...",
      "customInstructions": "Focus on identifying root causes.",
      "toolGroups": ["read", "search", "terminal"]
    }
  ],
  "miniModes.apiKey": "sk-...",
  "miniModes.apiBase": "https://api.openai.com/v1"
}
```

---

## 🚀 下一步

- **尝试添加自定义模式**：在 `settings.json` 中定义新模式，观察 UI 变化
- **修改提示词模板**：调整 `prompt.ts` 中的格式，测试 AI 行为
- **扩展工具组**：添加新的工具类型，理解权限控制机制
- **阅读 Roo-Code 源码**：对比本项目和 Roo-Code 的实现差异

---

## ❓ 常见问题

**Q: 为什么 Architect 模式不能编辑文件？**  
A: 因为它的 `toolGroups` 只有 `["read", "search"]`，不包含 `edit`。提示词中会明确告诉 AI "You cannot edit files"。

**Q: 自定义模式和内置模式冲突怎么办？**  
A: 自定义模式优先。如果 `slug` 相同，自定义模式会覆盖内置模式。

**Q: 如何添加新的工具？**  
A: 在 `tools.ts` 的 `TOOL_GROUPS` 中添加工具名，然后在 `prompt.ts` 中更新约束逻辑。

**Q: 提示词太长会影响 AI 性能吗？**  
A: 会。提示词越长，AI 的响应越慢、成本越高。保持提示词简洁清晰很重要。

---

## 📚 相关资源

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Roo-Code GitHub](https://github.com/RooVetGit/Roo-Code)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)

---

**Happy Coding! 🎉**