# Vertex Graphics Agent 战略路线图

> 目标：把 Vertex 从一个通用 VS Code AI 扩展，演进为面向**游戏图形程序员、TA 技术美术、引擎开发工程师**的专业图形工程助手。

---

## 1. 文档目标

本路线图聚焦三个问题：

1. 图形 Agent 未来应具备哪些核心能力
2. 这些能力应如何通过 **MCP、Knowledge、Skill** 体系组合起来
3. 哪些能力可以通过开源项目快速起步，哪些需要自研

本文件是**战略路线图**，强调方向、阶段、交付物与优先级，不展开具体实现代码。

---

## 2. 目标用户与使用场景

### 2.1 目标用户

- 游戏图形程序员
- TA 技术美术
- 引擎开发工程师

### 2.2 典型场景

- 分析当前帧为什么慢
- 解释当前 draw / pass / shader 在做什么
- 将 capture 结果映射回项目代码
- 写出用户指定的 shader 或效果
- 对渲染管线、材质系统、后处理流程进行定制
- 对黑屏、阴影、性能、资源绑定等问题进行专项排障
- 对回归问题进行对比分析与复现验证

---

## 3. 战略定位

Vertex Graphics Agent 的核心定位不是“会看图”，而是形成一条完整闭环：

**Capture → Engine Mapping → Asset Context → Skill-guided Generation → Validation → Knowledge Capture**

这意味着它需要同时具备：

- 图形分析能力
- 引擎语义理解能力
- Shader / Effect 生成能力
- 管线定制能力
- 工程验证能力
- 知识沉淀能力

---

## 4. 能力分层

建议把整个图形 Agent 拆成六层能力栈。

### 4.1 Capture Layer

负责“看见发生了什么”。

典型能力：

- 打开当前 capture
- 获取 frame summary
- 获取 selected draw / selection context
- 获取 event details
- 获取 pipeline state
- 获取 shader info / source
- 获取 mesh / resource / texture / buffer 数据
- 获取 pass graph

### 4.2 Engine Layer

负责“知道问题落在哪”。

典型能力：

- Unity 项目结构与渲染语义理解
- Unreal 渲染与材质系统语义理解
- 自研引擎源码索引与模块语义理解
- capture 到代码 owner 的映射

### 4.3 Asset Layer

负责“知道资源从哪来”。

典型能力：

- 材质、纹理、Mesh、Prefab、Scene 依赖追踪
- 打包 / Cook / Import / Addressables / AssetBundle 追踪
- DCC 资产来源与导出链路追踪

### 4.4 Profiling Layer

负责“知道为什么慢”。

典型能力：

- CPU profiling
- GPU profiling
- Runtime telemetry
- 帧时间 / draw call / triangle / memory / GC 分析

### 4.5 Validation Layer

负责“知道修复对不对”。

典型能力：

- 截图回归
- Golden image diff
- CI / build 检查
- 版本对比 / commit blame / changelog 追踪

### 4.6 Knowledge + Skill Layer

负责“知道该怎么写、怎么改”。

典型能力：

- Shader 生成
- Effect 生成
- Pipeline 定制
- 引擎适配
- 图形调试 playbook
- 平台规范与最佳实践复用

---

## 5. 外部 MCP 生态规划

外部 MCP 的目标不是堆工具，而是把图形 Agent 的能力补齐。

### 5.1 Capture MCP

这是当前已明确的核心方向。

#### 目标

- 直接读取 capture 数据
- 提供 frame / draw / shader / pipeline 的事实层信息
- 支持图形专项 workflow

#### 推荐接入

- `renderdoc-for-vscode` 插件对应的 MCP 能力
- 独立 `RenderDoc MCP`

#### 开源参考

- RenderDoc: https://github.com/baldurk/renderdoc
- renderdoc-for-vscode: https://github.com/Kirkice/renderdoc-for-vscode

> 说明：RenderDoc 本体是图形调试事实源，renderdoc-for-vscode 更适合作为 VS Code 内的接入桥梁；独立 RenderDoc MCP 则适合作为更纯粹的 provider adapter。

### 5.2 Engine MCP

负责把图形现象映射回工程代码。

#### 目标

- 代码索引
- 渲染模块语义理解
- Shader / material / pass / render feature 定位
- capture 到工程实现的映射

#### 推荐接入

- Unity MCP
- Unreal MCP
- 自研引擎源码 MCP

#### 开源参考

- Unity C# Reference: https://github.com/Unity-Technologies/UnityCsReference
- Unreal Engine: https://github.com/EpicGames/UnrealEngine

> 说明：Unity / Unreal 本身并不等于 MCP，但它们提供了足够多的公开结构与工程语义参考，适合构建自己的项目索引 MCP 或 provider。

### 5.3 Asset MCP

负责资源链路与内容管线。

#### 目标

- 资源来源追踪
- 材质、纹理、Prefab、Scene 依赖分析
- 导入、打包、Cook、Addressables、AssetBundle 追踪

#### 推荐接入

- 资产数据库 MCP
- 构建产物 MCP
- DCC 导出链路 MCP

#### 开源参考

- Blender: https://github.com/blender/blender
- Substance 生态通常依赖商业工具，不建议作为开源 MCP 主轴

### 5.4 Profiling MCP

负责性能归因。

#### 目标

- CPU / GPU / runtime 数据接入
- 帧慢、卡顿、内存、带宽、overdraw 分析
- 和 capture 数据联动

#### 推荐接入

- PIX / Nsight / AGI 数据接入层
- 项目内 telemetry MCP

#### 开源参考

- Tracy: https://github.com/wolfpld/tracy
- PIX / Nsight / AGI 通常为官方工具链，适合做适配器而非依赖其源码

### 5.5 Validation MCP

负责修复闭环。

#### 目标

- 截图回归
- 自动化测试
- CI 构建状态
- 版本对比与回归定位

#### 推荐接入

- CI MCP
- Screenshot diff MCP
- Git / blame / diff MCP

#### 开源参考

- Playwright: https://github.com/microsoft/playwright
- GitHub Actions 生态可作为 CI 接入参考
- ImageMagick: https://github.com/ImageMagick/ImageMagick

### 5.6 Knowledge MCP

负责团队知识沉淀。

#### 目标

- 图形规范
- 历史问题库
- Shader / Effect 模板库
- 渲染管线规范库

#### 推荐接入

- Wiki / 文档 MCP
- Issue / Ticket MCP
- Knowledge base MCP

#### 开源参考

- Docusaurus: https://github.com/facebook/docusaurus
- MkDocs: https://github.com/mkdocs/mkdocs
- Wiki.js: https://github.com/Requarks/wiki

---

## 6. Knowledge / Skill 体系规划

这一层是图形 Agent 能否真正“写得出来、改得动”的核心。

### 6.1 为什么必须有 Knowledge + Skill

单纯接 MCP 只能让 Agent “看到更多数据”，但不能自动让它：

- 写出符合项目风格的 shader
- 按项目管线定制效果
- 避免常见图形坑
- 在不同平台做差异化处理

这类能力需要：

- **Knowledge**：长期知识、规范、案例、模板
- **Skill**：可执行工作流、任务模板、检查步骤

### 6.2 知识库应该包含什么

- 常见 shader 模板
- 常见 effect 实现模板
- 平台限制与兼容性规则
- 各引擎 render pipeline 规范
- 常见图形 bug 案例
- 调试 playbook
- 性能优化 checklist
- 资源生命周期规范
- 命名与目录约定

### 6.3 Skill 应该包含什么

#### Shader Skill

适合：

- HLSL / GLSL / WGSL / MSL
- PBR / NPR / 后处理 shader
- compute shader
- shader variant 管理

输出应该包含：

- 需求结构化
- 平台选择建议
- 常见坑提示
- 可直接落地的代码骨架

#### Effect Skill

适合：

- bloom / SSAO / SSR / TAA
- outline / dissolve / fog / glow
- UI 特效、粒子特效、屏幕空间效果

输出应该包含：

- 视觉目标拆解
- render path 选择
- pass 结构
- 资源依赖
- 性能预算提示

#### Pipeline Skill

适合：

- render pass 设计
- render graph / frame graph 调整
- barrier / binding / layout 处理
- forward / deferred / clustered / tiled 定制

输出应该包含：

- 依赖分析
- 生命周期约束
- API 差异提醒
- 验证步骤

#### Engine Adaptation Skill

适合：

- Unity URP / HDRP
- Unreal RDG / Material / Niagara
- 自研引擎模块

输出应该包含：

- 项目结构映射
- 命名与风格对齐
- feature flag / platform define 处理
- 修改建议与验证方案

---

## 7. 阶段性路线图

建议按 5 个阶段推进。

### Phase 0：能力抽象定边界

#### 目标

先定义统一抽象，不绑定某个工具。

#### 交付物

- Graphics provider 抽象
- provider registry
- capabilities 定义
- graphics intent 分类
- graphics mode 定义

#### 完成标志

- 后续所有图形能力都能围绕统一抽象演进

### Phase 1：跑通最小图形闭环

#### 目标

让任意一个 graphics provider 跑通基础分析。

#### 交付物

- 一个可用 provider adapter
- availability 检测
- frame summary workflow
- selected draw workflow

#### 完成标志

- 用户能在 Vertex 中完成真实帧分析与 draw 分析

### Phase 2：接入 Knowledge / Skill

#### 目标

让 Agent 不只“看懂”，还能“写得对”。

#### 交付物

- 图形知识库结构
- shader skill
- effect skill
- pipeline skill
- engine adaptation skill

#### 完成标志

- Agent 能根据用户目标生成结构化 shader / effect / pipeline 方案

### Phase 3：打通 Engine Mapping

#### 目标

让 capture 结果走到项目代码 owner。

#### 交付物

- project mapping MCP
- 源码索引能力
- 资源依赖追踪能力

#### 完成标志

- 用户能从热点 draw 快速定位工程实现

### Phase 4：形成验证闭环

#### 目标

让修改结果可验证、可回归、可比较。

#### 交付物

- screenshot diff 接入
- 自动化测试 / CI 接入
- version diff / regression compare

#### 完成标志

- Agent 不只是分析，还能帮助确认修复是否生效

### Phase 5：多 Provider 生态化

#### 目标

支持多个同级 graphics MCP 共存。

#### 交付物

- provider selection UI
- capability match
- fallback / degradation 策略
- 多 provider 推荐逻辑

#### 完成标志

- 不需要为每个新工具重写整套 workflow

---

## 8. 建议的开源参考仓库

以下仓库可作为图形 Agent 的参考或外部能力基础：

| 方向 | 仓库 | 链接 |
|---|---|---|
| 图形调试 | RenderDoc | https://github.com/baldurk/renderdoc |
| VS Code 图形集成 | renderdoc-for-vscode | https://github.com/Kirkice/renderdoc-for-vscode |
| Unity 源码参考 | Unity C# Reference | https://github.com/Unity-Technologies/UnityCsReference |
| Unreal 引擎源码 | Unreal Engine | https://github.com/EpicGames/UnrealEngine |
| 性能分析 | Tracy | https://github.com/wolfpld/tracy |
| 文档站 | Docusaurus | https://github.com/facebook/docusaurus |
| 文档站 | MkDocs | https://github.com/mkdocs/mkdocs |
| Wiki 平台 | Wiki.js | https://github.com/Requarks/wiki |
| 截图对比 | ImageMagick | https://github.com/ImageMagick/ImageMagick |
| 自动化测试 | Playwright | https://github.com/microsoft/playwright |
| DCC 参考 | Blender | https://github.com/blender/blender |

> 注意：部分商业工具（如 PIX、Nsight、AGI、Substance）不适合作为直接开源依赖，但非常适合做适配层或数据导入层。

---

## 9. 推荐落地顺序

如果以“最快出效果 + 最少返工”为原则，建议按以下顺序推进：

1. Graphics provider 抽象
2. provider registry
3. 一个可用 provider adapter
4. Graphics intent router
5. Graphics workflow orchestrator
6. frame summary workflow
7. selected draw workflow
8. Graphics Mode
9. Shader / effect / pipeline skills
10. Project mapping MCP
11. Validation MCP
12. 多 provider 管理

---

## 10. 成功标准

当路线图落地后，用户应该明显感受到：

- 不需要先自己读一遍 capture 再问 AI
- 不需要在 RenderDoc、代码、终端、聊天窗口之间来回切换
- Vertex 能基于当前帧事实给出更可信的图形专项分析
- Vertex 能写出更符合项目风格的 shader / effect / pipeline 改动
- Vertex 能更快指出哪个 pass 慢、哪个 draw 热、哪个 shader 重
- Vertex 能更快把问题映射到项目中的责任代码
- Vertex 能接多个同级 graphics MCP，而不需要为每个工具重写 workflow

---

## 11. 结论

要把 Vertex 做成真正强大的图形 Agent，关键不是单点接入更多工具，而是形成一条完整闭环：

**Capture → Engine Mapping → Asset Context → Skill-guided Generation → Validation → Knowledge Capture**

RenderDoc 负责“看见事实”，Engine MCP 负责“定位责任”，Knowledge / Skill 负责“写出正确的改动”，Validation 负责“验证修复是否生效”。

当这四层一起打通时，Vertex 才能真正成为面向游戏图形开发的专业工作台。
