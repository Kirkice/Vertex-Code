# Marketplace Skills 品类实施文档

## 概述

为 Vertex 插件的 Marketplace 新增 **"Skill"** 品类，与现有的 "Mode" 和 "MCP" 并列。用户可以在 Marketplace UI 中浏览、搜索、安装和卸载社区贡献的 Agent Skills。Skills 托管在 GitHub 上，通过集中式注册表索引，用户一键安装到本地项目或全局目录。

## 架构设计

采用 **集中式注册表 + 运行时拉取** 的混合方案：

```
1. Skill 作者在自己的 GitHub 仓库中创建 Skill 文件
2. 作者向中央注册表仓库提交 PR，在 skills.yml 中添加记录
3. PR 审核合并后，所有 Vertex 用户自动看到新 Skill
4. 用户点击 Install → 插件从作者仓库下载文件到本地
```

### 数据流

```
skills.yml (本地索引) → ConfigLoader → MarketplaceManager → Webview UI
                                                                    ↓
GitHub Raw URL (文件下载) → SkillInstaller → .roo/skills/ 目录 ← 用户点击 Install
```

### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                        GitHub                                 │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │ 注册表 Repo      │    │ 作者 Skill Repo                  │ │
│  │ skills.yml 索引  │    │ SKILL.md + references/ + ...    │ │
│  └────────┬────────┘    └──────────────┬───────────────────┘ │
└───────────┼────────────────────────────┼─────────────────────┘
            │ HTTP GET                   │ HTTP GET (raw URL)
            ▼                            ▼
┌───────────────────────┐    ┌────────────────────────────────┐
│ ConfigLoader           │    │ SkillInstaller                 │
│ fetchSkills()          │    │ installSkill() / removeSkill() │
│ 解析 skills.yml        │    │ 下载文件 → 写入本地目录         │
└───────────┬───────────┘    └──────────────┬─────────────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐    ┌────────────────────────────────┐
│ MarketplaceManager     │    │ .roo/skills/ 或                │
│ getMarketplaceItems()  │    │ .roo/skills-{mode}/            │
│ filterItems()          │    │ └── skill-name/                │
│ installMarketplaceItem │    │     ├── SKILL.md               │
└───────────┬───────────┘    │     └── references/            │
            │                └────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────────┐
│ Webview UI                                                    │
│ MarketplaceView → Skills Tab → MarketplaceListView            │
│ 搜索 / 标签过滤 / 安装状态过滤 / 安装 / 卸载                   │
└──────────────────────────────────────────────────────────────┘
```

## 变更文件详解

### 1. 类型定义 — `packages/types/src/marketplace.ts`

扩展 `MarketplaceItemType` 枚举，新增 `"skill"` 类型：

```typescript
export const marketplaceItemTypeSchema = z.enum(["mode", "mcp", "skill"] as const)
```

新增 Skill 相关 schema：

```typescript
// 单个文件描述
export const skillFileSchema = z.object({
  path: z.string().min(1),           // 相对路径，如 "SKILL.md"
  url: z.string().url().optional(),  // 可选直接下载 URL
})

// Skill Marketplace Item
export const skillMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
  source: z.string().url(),                      // GitHub 仓库 URL
  sourcePath: z.string().optional().default(""),  // 仓库内路径前缀
  branch: z.string().optional().default("main"),  // Git 分支
  files: z.array(skillFileSchema).min(1),         // 文件列表
  modeSlugs: z.array(z.string()).optional(),      // 适用 Mode
})
```

更新 discriminated union 添加 skill 变体。

### 2. 数据文件 — `src/assets/marketplace/skills.yml` (新建)

Skill 品类索引文件，YAML 格式，与 `modes.yml`/`mcps.yml` 并列。每个条目包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符，也用作本地目录名 |
| `name` | string | 显示名称 |
| `description` | string | 描述文本 |
| `author` | string | 作者标识 |
| `authorUrl` | string (URL) | 作者主页 |
| `tags` | string[] | 搜索标签 |
| `source` | string (URL) | GitHub 仓库 URL |
| `sourcePath` | string | 仓库内 Skill 目录路径 |
| `branch` | string | Git 分支名，默认 "main" |
| `files` | SkillFile[] | 需要下载的文件列表 |
| `modeSlugs` | string[] | 适用的 Mode 列表 |

### 3. Skill 安装器 — `src/services/marketplace/SkillInstaller.ts` (新建)

核心类 `SkillInstaller`，负责从 GitHub 下载 Skill 文件并写入本地：

- **`installSkill(item, target)`** — 确定安装目录 → 遍历 `item.files` → 构建 Raw URL → HTTP GET 下载 → 写入文件
- **`removeSkill(item, target)`** — 删除 Skill 目录（`fs.rm` recursive）
- **`isInstalled(item, target)`** — 检查 `SKILL.md` 是否存在
- **`buildRawUrl(source, branch, sourcePath, file)`** — URL 转换逻辑：
  - `https://github.com/user/repo` → `https://raw.githubusercontent.com/user/repo/branch/path/file`
  - 如果 `file.url` 存在则直接使用

安装目录选择逻辑：
- `target === "project"` → `{workspace}/.roo/skills/` 或 `{workspace}/.roo/skills-{mode}/`
- `target === "global"` → `~/.roo/skills/` 或 `~/.roo/skills-{mode}/`
- 如果 `item.modeSlugs` 存在，使用第一个 mode slug 作为目录后缀

### 4. 配置加载器 — `src/services/marketplace/ConfigLoader.ts`

- 新增 `skillMarketplaceResponse` zod schema
- 新增 `fetchSkills()` 方法，读取 `skills.yml` 并验证
- `loadAllItems()` 改为并行加载三种类型：`Promise.all([fetchModes(), fetchMcps(), fetchSkills()])`
- `fetchSkills()` 失败时返回空数组（`skills.yml` 是可选的，不影响现有功能）

### 5. 统一安装器 — `src/services/marketplace/SimpleInstaller.ts`

- 构造函数中初始化 `SkillInstaller` 实例
- `installItem()` switch 添加 `"skill"` case
- `removeItem()` switch 添加 `"skill"` case
- `installMode()`/`installMcp()`/`removeMode()`/`removeMcp()` 参数类型从 `MarketplaceItem` 改为 `Extract<MarketplaceItem, { type: "mode" | "mcp" }>` 以修复 discriminated union 类型收窄问题

### 6. 导出 — `src/services/marketplace/index.ts`

新增 `export * from "./SkillInstaller"`

### 7. 前端 UI 变更

| 文件 | 变更内容 |
|------|----------|
| `MarketplaceViewStateManager.ts` | `activeTab` 类型从 `"mcp" \| "mode"` 扩展为 `"mcp" \| "mode" \| "skill"` |
| `MarketplaceView.tsx` | 添加 Skills Tab 按钮；Tab 指示器从 2 列改为 3 列（`w-1/2` → `w-1/3`，`left-0/left-1/2` → `left-0/left-1/3/left-2/3`）；添加 Skill `MarketplaceListView` |
| `MarketplaceListView.tsx` | `filterByType` prop 类型扩展；搜索 placeholder 添加 `"skill"` 分支 |
| `MarketplaceItemCard.tsx` | `typeLabel` 映射添加 `skill: "Skill"` |
| `App.tsx` | `targetTab` 类型扩展为 `"mcp" \| "mode" \| "skill" \| undefined` |

## GitHub 仓库结构规范

Skill 作者需要遵循以下仓库结构：

```
my-vertex-skills/
├── graphics/
│   ├── write-shader/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── pbr-reference.md
│   ├── rendering-pipeline/
│   │   └── SKILL.md
│   ├── graphics-debug/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── debug-playbook.md
│   └── graphics-optimization/
│       └── SKILL.md
├── web-dev/
│   ├── react-component/
│   │   └── SKILL.md
│   └── api-design/
│       └── SKILL.md
└── README.md
```

每个 Skill 目录必须包含 `SKILL.md`（带 YAML frontmatter），可选包含 `references/`、`scripts/`、`assets/` 子目录。

## skills.yml 条目格式

```yaml
items:
  - id: write-shader                    # 唯一标识符
    name: Write Shader                  # 显示名称
    description: "编写、修改和优化 GPU Shader 代码"
    author: "@username"                 # 作者
    authorUrl: "https://github.com/username"
    tags: [shader, graphics, hlsl]      # 标签
    source: "https://github.com/username/my-skills"  # 源仓库
    sourcePath: "graphics/write-shader" # 仓库内路径
    branch: "main"                      # 分支
    files:                              # 文件列表
      - path: "SKILL.md"
      - path: "references/pbr-reference.md"
    modeSlugs: [graphics, code]         # 适用 Mode
```

## 完整文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/types/src/marketplace.ts` | 修改 | 添加 `"skill"` 类型、`skillFileSchema`、`skillMarketplaceItemSchema`，更新 discriminated union |
| `src/assets/marketplace/skills.yml` | 新建 | Skill 品类索引文件 |
| `src/services/marketplace/SkillInstaller.ts` | 新建 | Skill 安装/卸载/检测逻辑 |
| `src/services/marketplace/ConfigLoader.ts` | 修改 | 添加 `fetchSkills()`，`loadAllItems()` 并行加载三种类型 |
| `src/services/marketplace/SimpleInstaller.ts` | 修改 | 添加 `"skill"` case，类型收窄修复 |
| `src/services/marketplace/index.ts` | 修改 | 导出 `SkillInstaller` |
| `webview-ui/.../MarketplaceViewStateManager.ts` | 修改 | `activeTab` 类型扩展 |
| `webview-ui/.../MarketplaceView.tsx` | 修改 | 添加 Skills Tab + 3 列指示器 |
| `webview-ui/.../MarketplaceListView.tsx` | 修改 | `filterByType` 类型扩展 + placeholder |
| `webview-ui/.../MarketplaceItemCard.tsx` | 修改 | skill typeLabel |
| `webview-ui/src/App.tsx` | 修改 | `targetTab` 类型扩展 |

## 待手动完成

### 上传 Graphics Skills 到 GitHub

创建 GitHub 仓库（如 `vertex-skills`），将 `.roo/skills-graphics/` 下的 4 个 Skill 上传，然后更新 `skills.yml` 中的 `source` URL 指向实际仓库地址。

### 注册表仓库（可选）

如需社区贡献，可创建独立的注册表仓库（如 `vertex-skills-registry`），包含：

```
vertex-skills-registry/
├── registry/
│   ├── skills.yml          # 所有 Skill 的索引
│   └── schema.json         # skills.yml 的 JSON Schema（用于 PR 验证）
├── .github/
│   └── workflows/
│       └── validate-pr.yml # CI: 自动验证 PR 格式
└── README.md               # 贡献指南
```
