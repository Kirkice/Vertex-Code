# JellyFish 主题排查记录

## 背景

目标：让 [`jellyfishTheme`](../webview-ui/src/themes/definitions.ts:34) 在 [`Vertex Code`](../webview-ui/src/App.tsx) 整个 Webview 中生效，形成 **CLI 命令终端感、赛博、科技、高级、产品化** 的统一视觉，同时保证 [`noneTheme`](../webview-ui/src/themes/definitions.ts:16) **完全不受影响**。

当前用户反馈：

- `Theme = None` 时，部分卡片有阴影/渐变底，不够贴近原生 VS Code / Zoo 风格。
- `Theme = JellyFish` 时，虽然选择器、按钮、部分卡片有变化，但**主背景仍然看起来像 VS Code 默认深色**，没有形成明显的主题化效果。

---

## 已确认的大前提

### 1. `None` 主题不能被 JellyFish 影响

当前机制上是成立的：

- [`ThemeProvider.applyTheme()`](../webview-ui/src/themes/ThemeProvider.tsx:86)
  - 当 `themeId === "none"` 时：
    - 移除旧的 `<style>` 标签
    - 移除 `html.vertex-theme-active` class
    - 直接 `return`
- 所有 JellyFish 骨架样式都写在 [`index.css`](../webview-ui/src/index.css:190) 中，并且统一以 `html.vertex-theme-active` 开头。

因此从设计上讲：

- `None`：没有 `vertex-theme-active`
- `JellyFish`：有 `vertex-theme-active`

理论上两者应该完全隔离。

---

## 已完成的工作

### A. 主题延迟生效改造（与本问题相关但非主因）

已完成：

- [`ThemeProvider.tsx`](../webview-ui/src/themes/ThemeProvider.tsx)
  - 引入 `pendingThemeId`
  - `commitTheme()` / `resetPendingTheme()`
- [`SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx)
  - Save / Discard 接入主题暂存机制
- [`UISettings.tsx`](../webview-ui/src/components/settings/UISettings.tsx)
  - Theme Select 绑定暂存态

结论：主题切换“点击 Save 后再生效”的逻辑已经完成。

---

### B. 参考 Zoo-Code，修复 `None` 主题下不应有的阴影/渐变

对比了 [`Zoo-Code`](H:/Project/Zoo-Code) 的对应实现后，确认默认没有明显的阴影底 / 渐变底。

已改回 Zoo 风格的文件：

- [`ToolUseBlock.tsx`](../webview-ui/src/components/common/ToolUseBlock.tsx)
- [`CommandExecution.tsx`](../webview-ui/src/components/chat/CommandExecution.tsx)
- [`TaskGroupItem.tsx`](../webview-ui/src/components/history/TaskGroupItem.tsx)

处理结果：

- `None` 下这些模块恢复为更平、更接近原生 VS Code / Zoo 的风格。

---

### C. 参考 oh-my-pi，重做 JellyFish 配色

参考项目：[`H:\Project\oh-my-pi\python\robomp\web\src\styles\index.css`](H:/Project/oh-my-pi/python/robomp/web/src/styles/index.css)

oh-my-pi 的核心设计哲学：

- **扁平不透明**（opaque flat surfaces）
- **紫灰基底**（purple-tinted gray surfaces）
- **粉色主强调**（pink accent）
- **青色辅助**（cyan for info/link/focus）
- **少装饰，靠层次和边框建立高级感**

JellyFish 已重配色到 oh-my-pi 风格：

- [`definitions.ts`](../webview-ui/src/themes/definitions.ts:34)
  - `background: #18141F`
  - `card: #241D2E`
  - `secondary: #31283D`
  - `input: #211A2B`
  - `primary: #E84393`
  - `accent: #7DD3E8`

同时对应地改了 `vscodeColors`：

- `editor-background`
- `input-background`
- `dropdown-background`
- `sideBar-background`
- `button-background`
- `button-secondaryBackground`
- `textCodeBlock-background`
- 等

---

### D. 第 1 轮 JellyFish 骨架主题化（后被认为“太浮夸”）

第一轮思路：

- 给页面根容器挂 `theme-shell-*` 类
- 在 [`index.css`](../webview-ui/src/index.css:190) 下增加：
  - 径向渐变背景
  - `::before` / `::after` 装饰层
  - glow / blur / 渐变 card

涉及的文件：

- [`ChatView.tsx`](../webview-ui/src/components/chat/ChatView.tsx)
- [`SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx)
- [`MarketplaceView.tsx`](../webview-ui/src/components/marketplace/MarketplaceView.tsx)
- [`WelcomeViewProvider.tsx`](../webview-ui/src/components/welcome/WelcomeViewProvider.tsx)
- [`TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx)
- [`ChatTextArea.tsx`](../webview-ui/src/components/chat/ChatTextArea.tsx)

用户反馈：

- 背景有变化但“太浮夸”

结论：

- 方向不符合 oh-my-pi 的产品化设计哲学。

---

### E. 第 2 轮 JellyFish 骨架主题化（收敛为 oh-my-pi 风格）

把浮夸部分全部去掉，改成：

- 无 blur
- 无径向渐变
- 无伪元素装饰层
- 无大阴影
- 用 flat surface + hairline border 表达层次

关键文件：

- [`index.css`](../webview-ui/src/index.css:190)

当前样式策略：

- `html.vertex-theme-active body { background: var(--background); }`
- `html.vertex-theme-active #root { background: var(--background); }`
- `html.vertex-theme-active .theme-shell { background: var(--background); }`
- `theme-shell-header` → `var(--secondary)` + `1px solid var(--border)`
- `task-header-card` → `var(--card)` + border
- `chat-textarea-shell` → `var(--card)` + border

---

## 当前“没有生效”的核心问题

### 现象

用户在切换到 JellyFish 后，整体主背景看起来仍像 VS Code 默认深色，而不是明显的 `#18141F`。

### 已经尝试过的解释与方案

#### 方案 1：认为只是颜色太接近 VS Code 默认

做法：

- 把 JellyFish 的背景从 `#221E28` 改为更深的 `#18141F`
- 同时拉开 `card` / `secondary` / `input` / `sidebar`

结果：

- **用户仍反馈没有明显生效**

#### 方案 2：认为 `body` / `#root` 被全屏固定层盖住

做法：

- 给 `body`
- 给 `#root`
- 给 `.theme-shell-*`

都补背景层

结果：

- **用户仍反馈没有明显生效**

#### 方案 3：认为 Tailwind v4 `@layer` 导致变量覆盖失败

推断逻辑：

- [`index.css`](../webview-ui/src/index.css:153) 中 `@layer base { :root { --background: var(--vscode-editor-background) } }`
- [`ThemeProvider.tsx`](../webview-ui/src/themes/ThemeProvider.tsx:42) 注入的是裸 CSS：
  - `html.vertex-theme-active { --background: #18141F }`
- 认为 Tailwind layer 优先级导致 `:root` 胜出

于是做法：

- 把 `html.vertex-theme-active { --background: ... }` 一并搬到 [`index.css`](../webview-ui/src/index.css:199) 的 `@layer base` 中

结果：

- **用户仍反馈没有明显生效**

#### 方案 4：彻底绕开变量链，硬编码 JellyFish 语义 token

做法：

在 [`index.css`](../webview-ui/src/index.css:199) 中直接写：

```css
html.vertex-theme-active {
  --background: #18141f;
  --foreground: #eeeaf4;
  --card: #241d2e;
  --primary: #e84393;
  --secondary: #31283d;
  --input: #211a2b;
  --border: #4a3c59;
}
```

理论上这已经不再依赖 `--vscode-*` 的重解析。

结果：

- **用户仍反馈“目前现状还是没有生效”**

---

## 当前最可疑的问题方向

到这一步，如果硬编码语义 token + body/#root 背景 + theme-shell 背景都还“看起来没生效”，那说明问题大概率不在配色值本身，而在下面几类更底层的问题：

### 1. 看的不是当前 webview 实例的 console / 样式

用户发来的控制台截图是：

- `Extension Host`
- `workbench.desktop.main.js`
- RenderDoc / GitHub 404 / workbench 日志

这不是 webview iframe 本身的 console，所以看不到：

- [`ThemeProvider.applyTheme()`](../webview-ui/src/themes/ThemeProvider.tsx:86) 里的调试输出

### 2. 最新构建产物并没有被 VS Code 面板加载

虽然每次都执行了：

- [`npx tsc --noEmit`](../webview-ui/package.json:8)
- [`npx vite build`](../webview-ui/package.json:14)

但仍然存在可能：

- 当前运行面板用的不是最新构建
- 或者当前打开的是另一个 webview 入口 / 旧缓存实例

### 3. `html.vertex-theme-active` 没有真正挂到运行中的 webview `html` 上

理论上 [`ThemeProvider.applyTheme()`](../webview-ui/src/themes/ThemeProvider.tsx:109) 会：

- `document.documentElement.classList.add(THEME_CLASS)`

如果这一步在运行实例里没有发生，那么所有 `html.vertex-theme-active ...` 规则都会失效。

### 4. 页面根容器之外还有更高层背景覆盖

虽然已经给：

- `body`
- `#root`
- `.theme-shell`

都设了背景，但如果某个真正占满视口的外层容器没有挂 `theme-shell-*`，仍可能看起来像“默认背景”。

---

## 目前代码里加过的调试

为确认这一点，在 [`ThemeProvider.tsx`](../webview-ui/src/themes/ThemeProvider.tsx:86) 曾加入调试输出：

- `[ThemeProvider.applyTheme]`
- `[ThemeProvider.applyTheme:none]`

打印的字段包括：

- `hasThemeClass`
- `htmlVscodeEditorBackground`
- `htmlBackground`
- `htmlCard`
- `bodyBackground`
- `rootBackground`

但用户打开的不是 webview 自身控制台，因此**没有拿到这些日志**。

---

## 当前代码状态总结

### 主题数据层

- [`definitions.ts`](../webview-ui/src/themes/definitions.ts:34)
  - JellyFish 配色已全面调整为 oh-my-pi 风格

### 主题应用层

- [`ThemeProvider.tsx`](../webview-ui/src/themes/ThemeProvider.tsx:86)
  - `none` 时移除 class 和 style tag
  - `jellyfish` 时注入 style tag + `html.vertex-theme-active`

### 骨架样式层

- [`index.css`](../webview-ui/src/index.css:190)
  - 目前已替换为 flat / opaque / terminal-like 风格
  - 只在 `html.vertex-theme-active` 下生效

### 锚点/容器层

已挂载：

- [`ChatView.tsx`](../webview-ui/src/components/chat/ChatView.tsx)
- [`SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx)
- [`MarketplaceView.tsx`](../webview-ui/src/components/marketplace/MarketplaceView.tsx)
- [`WelcomeViewProvider.tsx`](../webview-ui/src/components/welcome/WelcomeViewProvider.tsx)
- [`TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx)
- [`ChatTextArea.tsx`](../webview-ui/src/components/chat/ChatTextArea.tsx)

---

## 推荐后续排查步骤

### 优先级 1：确认运行实例到底有没有挂 `html.vertex-theme-active`

需要在 **webview iframe 自己的 DevTools** 中确认：

1. `document.documentElement.className`
2. `getComputedStyle(document.documentElement).getPropertyValue('--background')`
3. `getComputedStyle(document.body).background`
4. `getComputedStyle(document.getElementById('root')).background`

### 优先级 2：确认当前页面加载的是否真是最新构建产物

可检查：

- 当前 webview 的 CSS 中是否包含 [`html.vertex-theme-active`](../webview-ui/src/index.css:199) 那段最新规则
- 当前运行路径是否来自最新 `build` 目录

### 优先级 3：如果 `vertex-theme-active` 已挂且变量已变，但背景仍不变

就继续排查：

- 哪个全屏容器最后在绘制背景
- 是否还有未挂 `theme-shell-*` 的全屏层

---

## 当前结论

### 已确认的

- `None` 与 JellyFish 的**设计隔离机制是正确的**
- JellyFish 的配色定义和骨架样式已经准备到位
- 代码构建没有报错

### 尚未最终确认的

- 运行中的 webview 是否真的挂上了 `html.vertex-theme-active`
- 运行中的 webview 是否真的加载了最新构建产物
- 最终占满视口的背景绘制容器是谁

---

## 关联文件清单

核心文件：

- [`webview-ui/src/themes/definitions.ts`](../webview-ui/src/themes/definitions.ts)
- [`webview-ui/src/themes/ThemeProvider.tsx`](../webview-ui/src/themes/ThemeProvider.tsx)
- [`webview-ui/src/index.css`](../webview-ui/src/index.css)
- [`webview-ui/src/components/chat/ChatView.tsx`](../webview-ui/src/components/chat/ChatView.tsx)
- [`webview-ui/src/components/chat/TaskHeader.tsx`](../webview-ui/src/components/chat/TaskHeader.tsx)
- [`webview-ui/src/components/chat/ChatTextArea.tsx`](../webview-ui/src/components/chat/ChatTextArea.tsx)
- [`webview-ui/src/components/settings/SettingsView.tsx`](../webview-ui/src/components/settings/SettingsView.tsx)
- [`webview-ui/src/components/marketplace/MarketplaceView.tsx`](../webview-ui/src/components/marketplace/MarketplaceView.tsx)
- [`webview-ui/src/components/welcome/WelcomeViewProvider.tsx`](../webview-ui/src/components/welcome/WelcomeViewProvider.tsx)

参考来源：

- [`H:\Project\oh-my-pi\python\robomp\web\src\styles\index.css`](H:/Project/oh-my-pi/python/robomp/web/src/styles/index.css)
- [`H:\Project\Zoo-Code\webview-ui\src\components\common\ToolUseBlock.tsx`](H:/Project/Zoo-Code/webview-ui/src/components/common/ToolUseBlock.tsx)
- [`H:\Project\Zoo-Code\webview-ui\src\components\chat\CommandExecution.tsx`](H:/Project/Zoo-Code/webview-ui/src/components/chat/CommandExecution.tsx)
- [`H:\Project\Zoo-Code\webview-ui\src\components\history\TaskGroupItem.tsx`](H:/Project/Zoo-Code/webview-ui/src/components/history/TaskGroupItem.tsx)

