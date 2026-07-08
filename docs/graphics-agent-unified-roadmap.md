# Vertex Graphics Agent 统一路线图与可执行 TODO List

> **创建日期**: 2026-07-08  
> **合并来源**: [`graphics-mode-knowledge-enrichment-todo.md`](graphics-mode-knowledge-enrichment-todo.md) + [`graphics-agent-strategic-roadmap.md`](graphics-agent-strategic-roadmap.md)  
> **目标**: 将战略蓝图与近期执行项合并为一份可追踪、可落地的统一计划

---

## 1. 文档定位

本文档是 Vertex Graphics Agent 的**唯一执行计划**，取代原有两份独立文档。它同时回答三个问题：

1. **近期做什么**：当前仓库内可直接落地的 Skill、Playbook、Knowledge 文件与 Prompt 改造
2. **中期做什么**：Engine Mapping、Asset Context、Profiling、Validation 闭环
3. **长期做什么**：多 Provider 生态化与团队知识沉淀

---

## 2. 战略闭环

所有 TODO 都服务于同一条完整闭环：

```
Capture → Engine Mapping → Asset Context → Skill-guided Generation → Validation → Knowledge Capture
```

这意味着 Agent 需要同时具备：

- 图形分析能力（看见发生了什么）
- 引擎语义理解能力（知道问题落在哪）
- 资源链路追踪能力（知道资源从哪来）
- Shader / Effect 生成能力（知道该怎么写）
- 工程验证能力（知道修复对不对）
- 知识沉淀能力（知道下次怎么改）

---

## 3. 能力分层

| 层 | 职责 | 对应体系 |
|---|---|---|
| Capture Layer | 读取 capture 数据，提供帧/Draw/Shader/Pipeline 事实层 | Graphics Provider、Playbook |
| Engine Layer | 将图形现象映射回工程代码 | Engine MCP、Engine Adaptation Skill |
| Asset Layer | 追踪材质、纹理、Mesh、Prefab 等资源链路 | Asset MCP、Knowledge |
| Profiling Layer | CPU/GPU/Runtime 性能归因 | Profiling MCP、Playbook |
| Validation Layer | 截图回归、CI 检查、版本对比 | Validation MCP、Skill Output Contract |
| Knowledge + Skill Layer | Shader 生成、Effect 生成、Pipeline 定制、调试 Playbook | Skill、Knowledge、Prompt |

---

## 4. 可执行 TODO List

### Phase 0：统一抽象与边界收敛

**目标**：确认当前 Graphics Mode 的能力边界，为后续扩展建立稳定基座。

- [ ] 盘点 [`src/services/graphics-agent/GraphicsModeDefinition.ts`](../src/services/graphics-agent/GraphicsModeDefinition.ts) 中已有 Role Definition 与 Custom Instructions
- [ ] 校验 [`src/core/prompts/sections/graphics-agent.ts`](../src/core/prompts/sections/graphics-agent.ts) 中内嵌知识是否覆盖 Capture 基础能力（frame summary、selected draw、event details、pipeline state、shader info）
- [ ] 整理图形意图分类为稳定入口：分析类、排障类、生成类、管线设计类、优化类
- [ ] 明确哪些能力属于 prompt 常驻知识，哪些属于 Skill 工作流，哪些属于 Playbook 自动排查，哪些属于未来 MCP 扩展

**对应能力层**：Capture Layer、Knowledge + Skill Layer  
**完成标志**：后续所有图形能力都能围绕统一抽象演进

---

### Phase 1：补齐近期最缺的 Knowledge + Skill 基座

**目标**：让 Agent 不只"看懂"，还能"写得对"。

#### 1.1 新增 4 个 Graphics Skills

| Skill | 落点 | 核心内容 |
|---|---|---|
| `write-shader` | [`.roo/skills-graphics/write-shader/SKILL.md`](../.roo/skills-graphics/write-shader/SKILL.md) | Shader 语言速查（HLSL/GLSL/WGSL/MSL）、数学近似、精度选择、模板库（PBR/Unlit/Toon/Outline/Skybox/Particle/Post-Process/Compute） |
| `rendering-pipeline` | [`.roo/skills-graphics/rendering-pipeline/SKILL.md`](../.roo/skills-graphics/rendering-pipeline/SKILL.md) | 渲染架构对比（Forward/Deferred/Forward+/Clustered）、典型 Pass 结构、GPU-Driven Rendering、帧同步策略 |
| `graphics-debug` | [`.roo/skills-graphics/graphics-debug/SKILL.md`](../.roo/skills-graphics/graphics-debug/SKILL.md) | 通用调试方法论（二分法/隔离法/对照法/替换法）、按症状分类排查流程、RenderDoc 调试技巧 |
| `graphics-optimization` | [`.roo/skills-graphics/graphics-optimization/SKILL.md`](../.roo/skills-graphics/graphics-optimization/SKILL.md) | 性能分析方法论（Top-Down/Bottom-Up）、瓶颈分类与对策、平台特定优化（移动端/PC/主机） |

#### 1.2 校准 Mode 定义

- [ ] 更新 [`src/services/graphics-agent/GraphicsModeDefinition.ts`](../src/services/graphics-agent/GraphicsModeDefinition.ts) 中对上述 skills 的引用，确保模式描述与真实可发现 skill 一致
- [ ] 为每个 skill 制定输入输出规范，统一包含需求结构化、平台约束、实现骨架、风险提示、验证建议

**对应能力层**：Knowledge + Skill Layer  
**对应体系**：Skill  
**完成标志**：Agent 能根据用户目标生成结构化 shader / effect / pipeline 方案

---

### Phase 2：扩展专项 Playbook，形成系统化图形排障能力

**目标**：将常见图形问题固化为可自动执行的排查流程。

#### 2.1 新增 10 个 Playbook

| Playbook | 文件 | ID | 所需能力 |
|---|---|---|---|
| TAA Ghosting | [`taaGhosting.ts`](../src/services/graphics-agent/playbooks/taaGhosting.ts) | `taa_ghosting` | frameSummary, eventDetails, pipelineState, shaderInfo |
| Z-Fighting | [`zFighting.ts`](../src/services/graphics-agent/playbooks/zFighting.ts) | `z_fighting` | frameSummary, eventDetails, pipelineState |
| Overdraw | [`overdraw.ts`](../src/services/graphics-agent/playbooks/overdraw.ts) | `overdraw` | frameSummary, eventDetails, pipelineState |
| Bandwidth 瓶颈 | [`bandwidthBottleneck.ts`](../src/services/graphics-agent/playbooks/bandwidthBottleneck.ts) | `bandwidth_bottleneck` | frameSummary, eventDetails, pipelineState |
| Shader 编译卡顿 | [`shaderCompileStall.ts`](../src/services/graphics-agent/playbooks/shaderCompileStall.ts) | `shader_compile_stall` | frameSummary, eventDetails |
| Resource Leak | [`resourceLeak.ts`](../src/services/graphics-agent/playbooks/resourceLeak.ts) | `resource_leak` | frameSummary, eventDetails |
| Mipmap 问题 | [`mipmapIssue.ts`](../src/services/graphics-agent/playbooks/mipmapIssue.ts) | `mipmap_issue` | frameSummary, eventDetails, pipelineState |
| HDR 管线验证 | [`hdrPipeline.ts`](../src/services/graphics-agent/playbooks/hdrPipeline.ts) | `hdr_pipeline` | frameSummary, eventDetails, pipelineState, shaderInfo |
| 光照错误 | [`lightingError.ts`](../src/services/graphics-agent/playbooks/lightingError.ts) | `lighting_error` | frameSummary, eventDetails, pipelineState, shaderInfo |
| 粒子性能 | [`particlePerformance.ts`](../src/services/graphics-agent/playbooks/particlePerformance.ts) | `particle_performance` | frameSummary, eventDetails, pipelineState, shaderInfo |

#### 2.2 注册与类型扩展

- [ ] 扩展 [`packages/types/src/graphics.ts`](../packages/types/src/graphics.ts) 中的 `GraphicsPlaybookId` 联合类型，新增 10 个 ID
- [ ] 更新 [`src/services/graphics-agent/playbooks/playbookRunner.ts`](../src/services/graphics-agent/playbooks/playbookRunner.ts) 中的 `playbookRegistry`，注册 10 个新 playbook

#### 2.3 统一 Playbook 模板

- [ ] 提炼统一 playbook 模板，强制收敛为 `evidence[]`、`suspectedIssues[]`、`suggestions[]`、`confidence`、`category` 的标准输出

**对应能力层**：Capture Layer、Knowledge + Skill Layer、Profiling Layer  
**对应体系**：Playbook、Workflow  
**完成标志**：用户问专项排障问题时，可以直接命中具体 playbook

---

### Phase 3：外部知识文件化，避免 Prompt 膨胀

**目标**：将专题知识从 prompt 中迁出，实现按需加载。

#### 3.1 创建知识目录与文件

| 文件 | 内容 | 预估 tokens |
|---|---|---|
| [`pbr-reference.md`](../src/core/prompts/sections/graphics-knowledge/pbr-reference.md) | Cook-Torrance BRDF、IBL、Energy Conservation、常见变体 | ~2000 |
| [`gpu-architecture.md`](../src/core/prompts/sections/graphics-knowledge/gpu-architecture.md) | IMR vs TBR/TBDR、Wave/Warp 执行模型、内存层次 | ~1500 |
| [`mobile-optimization.md`](../src/core/prompts/sections/graphics-knowledge/mobile-optimization.md) | Bandwidth 预算、Precision 选择、Thermal Throttling、Tile Memory | ~1500 |
| [`advanced-techniques.md`](../src/core/prompts/sections/graphics-knowledge/advanced-techniques.md) | Ray Tracing、Mesh Shaders、VRS、Work Graphs、Sampler Feedback | ~2000 |
| [`engine-patterns.md`](../src/core/prompts/sections/graphics-knowledge/engine-patterns.md) | UE、Unity SRP、自研引擎典型架构 | ~1500 |
| [`api-deep-dive.md`](../src/core/prompts/sections/graphics-knowledge/api-deep-dive.md) | D3D12/Vulkan 资源管理、同步模型、多线程渲染、Descriptor 管理 | ~2000 |
| [`math-reference.md`](../src/core/prompts/sections/graphics-knowledge/math-reference.md) | 变换矩阵、四元数、球谐函数、Noise、曲线曲面 | ~1500 |
| [`color-science.md`](../src/core/prompts/sections/graphics-knowledge/color-science.md) | 色域、Tone Mapping、HDR 标准、Gamma/sRGB 转换 | ~1500 |

#### 3.2 按需加载机制

- [ ] 在 [`src/core/prompts/sections/graphics-agent.ts`](../src/core/prompts/sections/graphics-agent.ts) 中实现按意图加载知识文件的策略
- [ ] 建立知识文件与技能调用的映射规则：

| 意图/关键词 | 加载的知识文件 |
|---|---|
| 所有 Graphics Mode | `pbr-reference.md` |
| 帧分析/性能 | + `gpu-architecture.md` |
| 移动端相关 | + `mobile-optimization.md` |
| Shader 相关 | + `math-reference.md` |
| 高级技术 | + `advanced-techniques.md` |
| 引擎架构 | + `engine-patterns.md` |
| API 差异 | + `api-deep-dive.md` |
| 颜色/HDR | + `color-science.md` |

- [ ] 将当前 prompt 中稳定常驻的内容压缩为最小核心集，把专题知识迁出到外部知识文件

**对应能力层**：Knowledge + Skill Layer  
**对应体系**：Knowledge  
**完成标志**：用户问平台优化或 PBR/HDR 专题时，可以按需加载知识文件

---

### Phase 4：精简并强化 Graphics Mode Prompt 核心指令

**目标**：保持 prompt 强指令密度，避免被大段图形知识稀释。

- [ ] 在 [`src/core/prompts/sections/graphics-agent.ts`](../src/core/prompts/sections/graphics-agent.ts) 中仅补充高频常驻知识：
  - GPU 架构速记（IMR vs TBR/TBDR，~200 tokens）
  - 移动端与桌面端差异（~150 tokens）
  - Reversed-Z 原则（~100 tokens）
- [ ] 将 prompt 中对 Skill、Playbook、Knowledge 文件的调用时机写清楚
- [ ] 为常见任务建立路由规则：
  - 写 shader → `write-shader` skill
  - 专项排障 → 对应 playbook
  - 概念解释 → prompt + knowledge
  - 架构设计 → `rendering-pipeline` skill + 外部知识
- [ ] 控制 prompt 总行数在 350 行以内（当前约 265 行）

**对应能力层**：Knowledge + Skill Layer  
**对应体系**：Prompt Orchestration  
**完成标志**：prompt 保持精简，专项知识走外部文件或 Skills

---

### Phase 5：打通 Capture 到 Engine Mapping 的第二条主线

**目标**：让 capture 结果走到项目代码 owner。

- [ ] 定义 capture 到代码 owner 的映射目标模型（shader 文件、材质系统、render feature、pass owner、模块 owner）
- [ ] 设计 Unity、Unreal、自研引擎三类 Engine Mapping 适配边界
- [ ] 规划 project mapping MCP 或源码索引 provider，支持从 draw、pass、shader 反查工程实现
- [ ] 梳理渲染模块语义标签体系（Base Pass、Shadow Pass、Post Process、UI Pass 等工程角色）
- [ ] 设计 Engine Adaptation Skill 的结构，作为后续实现入口

**对应能力层**：Engine Layer  
**对应体系**：Engine MCP、Engine Adaptation Skill  
**完成标志**：用户能从热点 draw 快速定位工程实现

---

### Phase 6：补 Asset Context，让 Agent 理解资源来源链路

**目标**：追踪材质、纹理、Mesh、Prefab、Scene 的依赖链路。

- [ ] 定义材质、纹理、Mesh、Prefab、Scene 的依赖追踪需求
- [ ] 规划 Addressables、AssetBundle、Cook、Import 等资源链路的查询模型
- [ ] 设计 Asset MCP 或构建产物索引层，支持从 capture 中的资源回溯到源资产与打包产物
- [ ] 补充资源生命周期规范到知识库中，形成资源问题排查入口

**对应能力层**：Asset Layer  
**对应体系**：Asset MCP、Knowledge  
**完成标志**：Agent 能回答"这个纹理是从哪个 DCC 导出的"

---

### Phase 7：扩 Profiling 与性能归因闭环

**目标**：从"看到慢"走到"知道为什么慢"。

- [ ] 规划 CPU profiling、GPU profiling、runtime telemetry 的接入抽象
- [ ] 设计与 capture 数据联动的性能归因工作流（从帧慢定位到 pass、draw、shader、资源、同步点）
- [ ] 评估 Tracy 等外部方案作为 Profiling MCP 的参考接入
- [ ] 在当前 playbook 基础上继续扩展性能分类能力，使其可衔接未来 profiling 数据源

**对应能力层**：Profiling Layer  
**对应体系**：Profiling MCP、Playbook  
**完成标志**：Agent 能回答"这个帧为什么慢，瓶颈在哪个 pass"

---

### Phase 8：建立 Validation 闭环，验证修复是否生效

**目标**：让修改结果可验证、可回归、可比较。

- [ ] 规划截图回归、golden image diff、版本对比、commit blame 的统一验证接口
- [ ] 设计 Validation MCP 的接入边界（CI、截图 diff、Git diff）
- [ ] 为 shader、effect、pipeline 变更定义最小验证清单
- [ ] 让未来 Skill 输出默认附带验证步骤，而不仅是生成代码

**对应能力层**：Validation Layer  
**对应体系**：Validation MCP、Skill Output Contract  
**完成标志**：Agent 不只是分析，还能帮助确认修复是否生效

---

### Phase 9：沉淀团队知识与历史问题库

**目标**：将图形经验沉淀为团队资产。

- [ ] 将图形规范、历史问题、shader 模板、playbook 经验沉淀为可检索知识源
- [ ] 规划 Wiki、Issue、文档系统与 Graphics Knowledge 的同步方式
- [ ] 将未来高价值问题闭环回写到知识库，形成 Knowledge Capture 机制

**对应能力层**：Knowledge + Skill Layer  
**对应体系**：Knowledge MCP  
**完成标志**：团队经验不再停留在单次对话

---

### Phase 10：多 Provider 生态化

**目标**：支持多个同级 graphics MCP 共存。

- [ ] 设计 provider selection、capability match、fallback、degradation 策略
- [ ] 保证 workflow 不与单一 capture 工具强绑定
- [ ] 为多个 graphics MCP 并存准备统一编排入口

**对应能力层**：Capture Layer、Orchestration  
**对应体系**：Multi-Provider Registry  
**完成标志**：不需要为每个新工具重写整套 workflow

---

## 5. 推荐达成路径

### 路径 A：先把当前仓库做成能打的 Graphics Mode（Phase 0–4）

这是最优先主线，直接对应当前项目可实施内容。

**执行顺序**：
1. Phase 0：统一抽象与边界收敛
2. Phase 1：补齐 4 个缺失 skill
3. Phase 2：扩展 10 个专项 playbook
4. Phase 3：把知识从 `graphics-agent.ts` 外置为知识文件
5. Phase 4：收敛 prompt 结构与调用路由

**达成后效果**：
- 用户问 shader 编写类问题时，不再只靠 prompt 临场回答，而是走 `write-shader` skill
- 用户问专项排障问题时，可以直接命中具体 playbook
- 用户问平台优化或 PBR/HDR 专题时，可以按需加载知识文件

### 路径 B：从图形分析助手升级为工程闭环助手（Phase 5–8）

在路径 A 完成后，继续推进：
- Phase 5：Engine Mapping
- Phase 6：Asset Context
- Phase 7：Profiling
- Phase 8：Validation

**达成后效果**：
- 从 capture 中看到的问题，可以映射回项目代码、资源链路、性能归因和验证结果
- Agent 能从会分析、会生成，升级到会定位、会验证

### 路径 C：平台化与生态化（Phase 9–10）

最后推进：
- Phase 9：Knowledge Capture
- Phase 10：Multi-Provider

**达成后效果**：
- 不再依赖单一图形工具
- 图形经验能够沉淀成团队资产，而不是停留在单次对话

---

## 6. 近期与中长期边界

### 近期直接落地项（Phase 0–4）

| 文件 | 变更类型 | 说明 |
|---|---|---|
| [`.roo/skills-graphics/write-shader/SKILL.md`](../.roo/skills-graphics/write-shader/SKILL.md) | 新增 | Shader 编写指导 |
| [`.roo/skills-graphics/rendering-pipeline/SKILL.md`](../.roo/skills-graphics/rendering-pipeline/SKILL.md) | 新增 | 渲染管线设计 |
| [`.roo/skills-graphics/graphics-debug/SKILL.md`](../.roo/skills-graphics/graphics-debug/SKILL.md) | 新增 | 图形调试方法论 |
| [`.roo/skills-graphics/graphics-optimization/SKILL.md`](../.roo/skills-graphics/graphics-optimization/SKILL.md) | 新增 | GPU 性能优化 |
| [`src/services/graphics-agent/playbooks/taaGhosting.ts`](../src/services/graphics-agent/playbooks/taaGhosting.ts) | 新增 | TAA Ghosting 排查 |
| [`src/services/graphics-agent/playbooks/zFighting.ts`](../src/services/graphics-agent/playbooks/zFighting.ts) | 新增 | Z-Fighting 排查 |
| [`src/services/graphics-agent/playbooks/overdraw.ts`](../src/services/graphics-agent/playbooks/overdraw.ts) | 新增 | Overdraw 分析 |
| [`src/services/graphics-agent/playbooks/bandwidthBottleneck.ts`](../src/services/graphics-agent/playbooks/bandwidthBottleneck.ts) | 新增 | Bandwidth 瓶颈 |
| [`src/services/graphics-agent/playbooks/shaderCompileStall.ts`](../src/services/graphics-agent/playbooks/shaderCompileStall.ts) | 新增 | Shader 编译卡顿 |
| [`src/services/graphics-agent/playbooks/resourceLeak.ts`](../src/services/graphics-agent/playbooks/resourceLeak.ts) | 新增 | Resource Leak 排查 |
| [`src/services/graphics-agent/playbooks/mipmapIssue.ts`](../src/services/graphics-agent/playbooks/mipmapIssue.ts) | 新增 | Mipmap 问题 |
| [`src/services/graphics-agent/playbooks/hdrPipeline.ts`](../src/services/graphics-agent/playbooks/hdrPipeline.ts) | 新增 | HDR 管线验证 |
| [`src/services/graphics-agent/playbooks/lightingError.ts`](../src/services/graphics-agent/playbooks/lightingError.ts) | 新增 | 光照错误排查 |
| [`src/services/graphics-agent/playbooks/particlePerformance.ts`](../src/services/graphics-agent/playbooks/particlePerformance.ts) | 新增 | 粒子性能排查 |
| [`src/core/prompts/sections/graphics-knowledge/pbr-reference.md`](../src/core/prompts/sections/graphics-knowledge/pbr-reference.md) | 新增 | PBR 光照模型参考 |
| [`src/core/prompts/sections/graphics-knowledge/gpu-architecture.md`](../src/core/prompts/sections/graphics-knowledge/gpu-architecture.md) | 新增 | GPU 架构知识 |
| [`src/core/prompts/sections/graphics-knowledge/mobile-optimization.md`](../src/core/prompts/sections/graphics-knowledge/mobile-optimization.md) | 新增 | 移动端优化 |
| [`src/core/prompts/sections/graphics-knowledge/advanced-techniques.md`](../src/core/prompts/sections/graphics-knowledge/advanced-techniques.md) | 新增 | 高级渲染技术 |
| [`src/core/prompts/sections/graphics-knowledge/engine-patterns.md`](../src/core/prompts/sections/graphics-knowledge/engine-patterns.md) | 新增 | 引擎渲染架构 |
| [`src/core/prompts/sections/graphics-knowledge/api-deep-dive.md`](../src/core/prompts/sections/graphics-knowledge/api-deep-dive.md) | 新增 | API 深度对比 |
| [`src/core/prompts/sections/graphics-knowledge/math-reference.md`](../src/core/prompts/sections/graphics-knowledge/math-reference.md) | 新增 | 数学参考 |
| [`src/core/prompts/sections/graphics-knowledge/color-science.md`](../src/core/prompts/sections/graphics-knowledge/color-science.md) | 新增 | 色彩科学 |
| [`packages/types/src/graphics.ts`](../packages/types/src/graphics.ts) | 修改 | 扩展 `GraphicsPlaybookId` 联合类型 |
| [`src/services/graphics-agent/playbooks/playbookRunner.ts`](../src/services/graphics-agent/playbooks/playbookRunner.ts) | 修改 | 注册 10 个新 playbook |
| [`src/core/prompts/sections/graphics-agent.ts`](../src/core/prompts/sections/graphics-agent.ts) | 修改 | 补充核心知识 + 实现按需加载逻辑 |
| [`src/services/graphics-agent/GraphicsModeDefinition.ts`](../src/services/graphics-agent/GraphicsModeDefinition.ts) | 修改 | 更新 customInstructions 引用新 skill |

### 中长期规划项（Phase 5–10）

| 方向 | 对应体系 | 说明 |
|---|---|---|
| Engine Mapping | Engine MCP、Engine Adaptation Skill | 从 capture 反查工程实现 |
| Asset Context | Asset MCP、Knowledge | 资源链路与依赖追踪 |
| Profiling | Profiling MCP、Playbook | CPU/GPU/Runtime 性能归因 |
| Validation | Validation MCP、Skill Output Contract | 截图回归、CI 检查、版本对比 |
| Knowledge Capture | Knowledge MCP | 团队经验沉淀 |
| Multi-Provider | Multi-Provider Registry | 多 graphics MCP 共存 |

---

## 7. 成功标准

实施完成后，Graphics Mode 应该能够：

| 场景 | 当前表现 | 期望表现 |
|---|---|---|
| 用户问"帮我写个 PBR shader" | 基于 prompt 内嵌知识回答 | 调用 `write-shader` skill，输出完整模板 + 最佳实践 |
| 用户问"TAA 有残影怎么办" | 无专项 playbook | 执行 `taa_ghosting` playbook，系统化排查 |
| 用户问"移动端怎么优化带宽" | 基于通用知识回答 | 加载 `mobile-optimization.md`，给出精确建议 |
| 用户问"这个引擎的渲染架构是什么" | 无引擎知识 | 加载 `engine-patterns.md`，对比分析 |
| 用户问"帮我排查 Z-Fighting" | 无专项 playbook | 执行 `z_fighting` playbook，检查 Reversed-Z 等 |
| 用户问"这个 draw 对应哪段代码" | 无法回答 | Engine Mapping 反查工程实现 |
| 用户问"这个纹理从哪来的" | 无法回答 | Asset Context 追踪资源链路 |
| 用户问"修复后效果对不对" | 无法验证 | Validation 闭环截图回归 |

---

## 8. 开源参考仓库

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

---

## 9. 结论

两篇文档并不冲突，而是上下游关系：[`graphics-mode-knowledge-enrichment-todo.md`](graphics-mode-knowledge-enrichment-todo.md) 适合作为近期执行面，[`graphics-agent-strategic-roadmap.md`](graphics-agent-strategic-roadmap.md) 适合作为中长期能力蓝图。

合并后的最佳策略不是二选一，而是以 **Phase 0–4 作为当前实施主线**，以 **Phase 5–10 作为后续扩展 backlog**。

当路线图落地后，用户应该明显感受到：

- 不需要先自己读一遍 capture 再问 AI
- 不需要在 RenderDoc、代码、终端、聊天窗口之间来回切换
- Vertex 能基于当前帧事实给出更可信的图形专项分析
- Vertex 能写出更符合项目风格的 shader / effect / pipeline 改动
- Vertex 能更快指出哪个 pass 慢、哪个 draw 热、哪个 shader 重
- Vertex 能更快把问题映射到项目中的责任代码
- Vertex 能接多个同级 graphics MCP，而不需要为每个工具重写 workflow
