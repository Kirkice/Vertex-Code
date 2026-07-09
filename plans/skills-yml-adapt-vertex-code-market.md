# 适配 skills.yml 到 vertex-code-market 仓库

## 背景

原仓库 `https://github.com/Kirkice/vertex-skills` 已迁移到新仓库 `https://github.com/Kirkice/vertex-code-market`，目录结构发生变更。

## 路径映射规则

| 类型 | 旧 sourcePath | 新 sourcePath |
|------|---------------|---------------|
| graphics 类 | `graphics/write-shader` | `skills/graphics-base/write-shader` |
| renderdoc 类 | `renderdoc-for-vscode/renderdoc-frame-overview` | `skills/renderdoc-for-vscode/renderdoc-frame-overview` |

## 文件清单变更

- graphics 类：文件清单不变（SKILL.md，graphics-debug 额外有 references/debug-playbook.md）
- renderdoc 类：每个 skill 新增 `agents/openai.yaml` 文件

## 改动清单

### 1. 全局替换 source

```
旧: source: "https://github.com/Kirkice/vertex-skills"
新: source: "https://github.com/Kirkice/vertex-code-market"
```

### 2. graphics 类 sourcePath 替换（5项）

| id | 旧 sourcePath | 新 sourcePath |
|----|---------------|---------------|
| write-shader | `graphics/write-shader` | `skills/graphics-base/write-shader` |
| rendering-pipeline | `graphics/rendering-pipeline` | `skills/graphics-base/rendering-pipeline` |
| graphics-debug | `graphics/graphics-debug` | `skills/graphics-base/graphics-debug` |
| graphics-optimization | `graphics/graphics-optimization` | `skills/graphics-base/graphics-optimization` |
| unity-graphics | `graphics/unity-graphics` | `skills/graphics-base/unity-graphics` |

### 3. renderdoc 类 sourcePath 替换（8项）

所有 renderdoc 类的 sourcePath 前缀从 `renderdoc-for-vscode/` 改为 `skills/renderdoc-for-vscode/`

### 4. renderdoc 类 files 补充 agents/openai.yaml（8项）

每个 renderdoc skill 的 files 列表新增：
```yaml
files:
  - path: "SKILL.md"
  - path: "agents/openai.yaml"
```

## 验证

适配后，SkillInstaller.buildRawUrl() 构建的 URL 示例：
```
https://raw.githubusercontent.com/Kirkice/vertex-code-market/main/skills/graphics-base/write-shader/SKILL.md
https://raw.githubusercontent.com/Kirkice/vertex-code-market/main/skills/renderdoc-for-vscode/renderdoc-frame-overview/agents/openai.yaml
```
