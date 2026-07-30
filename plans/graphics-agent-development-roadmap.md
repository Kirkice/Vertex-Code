# Vertex Graphics Agent 开发路线图

> 文档目标：把 Vertex 从“具备图形能力的通用 Coding Agent”推进为“覆盖图形 Feature 设计、实现、联调、验证、调试与优化全生命周期的图形开发 Agent”。
>
> **配套市场仓库本地地址**：`H:\Project\vertex-code-market`。在当前 Vertex 工作区中可通过相对路径 `..\vertex-code-market` 访问。后续涉及市场 Knowledge、Skill、MCP、清单或契约检查时，默认使用该地址，无需再次询问仓库位置；如果目录不存在或工作区布局发生变化，再执行路径发现或要求确认。
>
> 本路线图基于 Vertex 主仓库与配套市场仓库 `vertex-code-market` 的现状制定。市场仓库已经提供图形知识、Graphics/Unity/RenderDoc Skills 和 AssetStudio MCP；后续建设重点是让主仓库稳定发现、选择、编排和验证这些能力，而不是在主仓库重复硬编码同类方法论。RenderDoc 是运行时事实与验证能力的一部分，但产品主链路必须从策划/美术提出效果需求开始，而不是从已有 Capture 开始。

## 1. 产品目标与实施原则

### 1.1 产品定位

Vertex Graphics Agent 的核心定位不是替代 RenderDoc、PIX 或 Nsight 等专业图形工具，而是成为策划、美术、TA、图形程序与客户端程序之间的图形 Feature 工程协作中枢。产品需要同时打通两条链路。

#### A. 图形 Feature 开发主链路

1. 接收策划案、美术效果稿、参考视频、技术需求或自然语言描述。
2. 把主观效果描述转换成可验证的视觉目标、交互规则、数据需求和验收标准。
3. 读取项目引擎、渲染架构、现有 Pass/Shader、平台矩阵和资产规范。
4. 判断应复用现有能力、编写单个 Shader、增加后处理，还是修改 Render Pipeline/Render Graph。
5. 输出跨模块技术方案，明确渲染、客户端、美术资产、工具链和配置职责。
6. 拆分代码、Shader、资产、编辑器工具、联调和测试任务，并建立依赖顺序。
7. 实现最小视觉原型，再集成到正式管线和客户端生命周期。
8. 使用截图、自动化场景、Capture 和性能数据完成视觉、性能与兼容性验收。
9. 沉淀 Feature Spec、资产规范、平台降级策略和维护知识。

#### B. 调试与优化验证链路

1. 启动图形应用并获得 Capture。
2. 从 Capture 中提取可验证的 GPU 事实。
3. 定位异常 Pass、Draw、Dispatch、Shader 或 Resource。
4. 将 GPU 对象映射到项目源码。
5. 修改 Shader 或渲染代码。
6. 编译、热替换或重新运行应用。
7. 再次 Capture，并用前后数据验证修复效果。
8. 将结论沉淀为可复用的项目知识和团队报告。

完整产品闭环：

```text
效果需求/Feature Brief
→ 需求结构化 → 项目能力盘点 → 方案选型 → 跨模块设计 → 任务拆解
→ 视觉原型 → 管线/Shader/客户端/资产实现 → 联调
→ 视觉验收 → Capture 验证 → 性能与兼容性验收
→ 发布与降级策略 → 知识沉淀 → 后续调试和回归
```

### 1.2 实施原则

- **需求先于工具**：先明确效果目标、使用场景和验收边界，再决定是否需要 Capture、Shader 或管线修改。
- **最小侵入选型**：优先复用已有材质与 Pass；能用单 Shader 解决时不改管线，能用局部 Pass 解决时不重构 Render Pipeline。
- **跨角色契约**：每个 Feature 都要明确策划参数、美术资产、运行时接口、渲染职责和测试责任。
- **规格先于实现**：编码前形成结构化 Feature Spec、方案对比、风险列表、性能预算与兼容性矩阵。
- **事实优先**：调试结论必须关联 Event ID、Resource ID、Shader、Timing、Pipeline State 或图像证据。
- **能力闭环优先**：优先完成从需求到交付的端到端链路，不优先扩充孤立工具数量。
- **市场能力优先复用**：主仓库负责产品流程与结构化编排；可复用的领域方法、工具操作和参考知识优先沉淀在市场仓库。
- **显式发布优于目录猜测**：正式 Skill、Knowledge 和 MCP 必须具备稳定清单、版本、依赖、模式和兼容性元数据；本地自动发现只作为开发期兜底。
- **结构化结果优先**：方案、任务、诊断和验收结果均需要可渲染、可追踪、可比较，不能只输出聊天文本。
- **按需下钻**：开发阶段先读项目架构与现有实现；验证阶段先读帧摘要，再定位 Pass/Event 和 GPU 对象。
- **修改必须验证**：Shader 或渲染代码修改后必须有编译、视觉、性能和目标平台验证。
- **避免固定阈值误判**：性能判断应结合平台、目标帧率、分辨率、GPU 和项目基线。
- **Provider 解耦**：专项工作流依赖能力接口，不直接依赖特定 MCP 工具名。
- **稳定契约与单向依赖**：共享类型定义稳定协议，领域分析器不依赖 VS Code/Webview，Extension 负责 I/O 编排，UI 只消费结构化结果。
- **组合优于集中分支**：引擎、管线、Shader、客户端和资产检测通过独立 Analyzer/Adapter 组合，不在单个扫描器中持续堆叠正则和平台分支。
- **可测试与可替换**：领域规则必须支持纯输入测试；文件读取、扫描边界、Provider 和持久化通过接口或配置注入，避免依赖全局状态。
- **有界执行与显式降级**：文件数量、文件大小、超时和结果数量必须有边界；达到限制时返回结构化状态或警告，禁止静默丢失。
- **向后兼容演进**：消息协议和持久化模型使用版本字段；新增字段优先兼容旧响应，破坏性变更必须提供迁移策略与契约测试。
- **UI 关注点分离**：容器组件负责编排状态与消息，展示组件负责渲染，复杂分区拆分为可独立测试和复用的组件。

### 1.3 双仓职责与三层能力模型

#### A. Vertex 主仓库职责

- Agent Runtime、Graphics Mode、意图识别和任务生命周期。
- Feature Planner、Workflow、Playbook 状态机和结果结构化。
- Provider 抽象、Capability 预检、权限确认、失败恢复和可观测性。
- Graphics Workspace、方案评审、证据展示和验收 UI。
- 项目上下文、市场能力和运行时工具之间的动态编排。

#### B. `vertex-code-market` 市场仓库职责

- **Knowledge**：理论、版本差异、项目检测方法、性能方法论和案例。
- **Skill**：如何规划、实现、调试、优化以及如何安全调用工具的程序化流程。
- **MCP**：读取真实资产、构建产物和 GPU 状态，或执行构建、Capture、导出等副作用。
- 发布清单、能力元数据、依赖关系、兼容矩阵、示例和契约测试样本。

#### C. 三层协作规则

1. Workflow 根据 Feature 阶段和项目画像选择 Knowledge、Skill 和 Provider Capability。
2. Knowledge 提供上下文和决策依据，不直接执行副作用。
3. Skill 提供步骤、路由和安全边界，不替代主仓库的持久化状态机。
4. MCP 提供事实或动作，原始结果必须在 Provider/Adapter 层归一化。
5. 最终结论必须能区分项目事实、工具事实、知识引用和 Agent 推断。

### 1.4 当前可复用基础

#### A. Vertex 主仓库

- 图形意图识别：[`detectGraphicsIntent()`](../src/services/graphics-agent/GraphicsIntentRouter.ts:174)
- Graphics Mode 管理：[`GraphicsModeManager`](../src/services/graphics-agent/GraphicsModeManager.ts:49)
- 工作流编排：[`GraphicsWorkflowOrchestrator`](../src/services/graphics-agent/GraphicsWorkflowOrchestrator.ts:54)
- Provider 注册和能力匹配：[`GraphicsProviderRegistry`](../src/services/graphics-provider/GraphicsProviderRegistry.ts)
- RenderDoc Provider：[`RenderDocVsCodeMcpProvider`](../src/services/graphics-provider/providers/renderdoc-vscode-mcp/RenderDocVsCodeMcpProvider.ts:78)
- 当前帧分析：[`AnalyzeCurrentFrameWorkflow`](../src/services/graphics-agent/workflows/analyzeCurrentFrame.ts:37)
- 选中 Draw 分析：[`ExplainSelectedDrawWorkflow`](../src/services/graphics-agent/workflows/explainSelectedDraw.ts:38)
- 工程源码映射：[`FindOwnerInProjectWorkflow`](../src/services/graphics-agent/workflows/findOwnerInProject.ts)
- Playbook 运行器：[`runPlaybook()`](../src/services/graphics-agent/playbooks/playbookRunner.ts:87)
- 图形知识编排：[`orchestrateGraphicsKnowledge()`](../src/services/graphics-agent/knowledge/graphicsKnowledgeOrchestrator.ts:50)
- Webview 消息入口：[`handleGraphicsMessage()`](../src/core/webview/graphicsMessageHandler.ts:75)

#### B. 市场仓库

- Graphics Skills：`write-shader`、`rendering-pipeline`、`unity-graphics`、`graphics-debug`、`graphics-optimization` 和 `shader-to-desmos`。
- RenderDoc Skills：应用启动与 Capture、帧概览、当前选择解释、性能调查、Shader 审查、Texture 追踪、Buffer 检查、Pass 到项目映射和 Replay 恢复。
- Unity Tooling Skills：Editor/项目/构建/测试/日志/环境操作和 UPM 包管理。
- Graphics Knowledge：URP 跨版本适配、RenderGraph 迁移、项目检测、移动端性能、阴影稳定性、GI、光照、GPU 架构和 Shading Pipeline。
- AssetStudio MCP：Unity 资产、Bundle 和 APK 的 Texture、Mesh、Shader、Material、Renderer、Hierarchy、内存和依赖分析。

#### C. 当前关键断点

- 市场清单显式发布项少于仓库实际能力，当前依赖本地目录自动发现兜底。
- 市场安装的 Knowledge 与运行时固定知识索引尚未合并，安装成功不等于参与路由。
- Skills 引用的 MCP 工具名称缺少自动契约校验，工具重命名可能导致流程失效。
- RenderDoc 已有 Provider，但 AssetStudio 仍主要作为通用 MCP 暴露，缺少图形资产 Provider 和统一结果模型。
- 路线图中的部分“新建能力”实际已存在于市场 Skill；主仓库应建设编排、状态、证据和 UI，而不是复制 Skill 内容。

---

# 2. 重点开发部分

重点开发部分首先打通市场能力供给与主仓库运行时，再补齐“需求到实现”的图形 Feature 开发能力，最后建设可视化工作台与 Capture 验证能力。建议按 P0 到 P1 顺序实施。

## 2.0 P0：Marketplace Capability Foundation 市场能力接入底座

### 2.0.1 目标

让市场仓库中的 Knowledge、Skill 和 MCP 成为可发布、可安装、可路由、可验证和可观测的正式产品能力，消除“文件已经存在，但运行时不一定能稳定使用”的断层。

### 2.0.2 显式市场清单

完善市场仓库的聚合清单，显式声明全部正式能力：核心 Graphics Skills、全部 RenderDoc Skills、Unity Tooling Skills、AssetStudio MCP 以及带索引元数据的 Graphics Knowledge 包。

每个条目至少包含：

- 稳定 `id`、显示名称、描述和分组。
- `tags`、`modeSlugs` 和 `prerequisites`。
- `sourcePath`、精确文件白名单、版本和兼容性范围。
- 依赖的 Skill、Knowledge、MCP 和 Provider Capability。
- 支持平台、引擎/工具版本、安装后健康检查和卸载边界。

本地自动发现只作为开发期兜底；正式市场 UI、远程发布和批量安装以显式清单为准。MCP 不应默认发布目录中的全部文件，并应校验可执行文件、运行时依赖和原生 DLL。

### 2.0.3 Knowledge 安装与运行时索引合并

建立统一 Knowledge Registry：

1. 加载内置知识索引。
2. 加载全局安装知识及其索引。
3. 加载项目安装知识及其索引。
4. 按 `id + version` 合并，并执行项目级优先规则。
5. 校验路径边界、Markdown 文件和元数据 Schema。
6. 对安装、卸载、文件变化和模式切换执行缓存失效。
7. 将来源、版本、优先级和覆盖关系附加到路由结果。

建议新增：

- [`KnowledgeRegistry.ts`](../src/services/knowledge/KnowledgeRegistry.ts)
- [`InstalledKnowledgeSource.ts`](../src/services/knowledge/sources/InstalledKnowledgeSource.ts)
- [`knowledge-manifest.ts`](../packages/types/src/knowledge-manifest.ts)

市场安装必须保留 `triggers`、`scenarios`、`relatedSkills`、`relatedPlaybooks`、`tokenBudget` 和 `alwaysInclude`，不能只安装孤立 Markdown。

### 2.0.4 Skill、MCP 与 Provider 契约

新增市场能力契约检查器：

- 解析每个 Skill 引用的工具名称。
- 验证 MCP/Provider 是否存在对应工具或 Capability。
- 检查参数名称、必填字段、平台限制和废弃别名。
- 检查 Skill 依赖的参考文件是否进入发布包。
- 在 CI 中阻止引用不存在工具的 Skill 发布。

建议新增：

- [`MarketplaceCapabilityRegistry.ts`](../src/services/marketplace/MarketplaceCapabilityRegistry.ts)
- [`SkillToolContractValidator.ts`](../src/services/marketplace/validation/SkillToolContractValidator.ts)
- [`MarketplaceManifestValidator.ts`](../src/services/marketplace/validation/MarketplaceManifestValidator.ts)

运行时 Workflow 优先依赖 Provider Capability，而不是 Skill 中的原始 MCP 工具名称；仅探索型任务允许通用 MCP 调用。

### 2.0.5 AssetStudio Graphics Asset Provider

在通用 MCP 之外增加资产领域 Provider，对 AssetStudio 结果进行结构化封装：

- 加载 Unity 资产、Bundle 和 APK。
- 获取资产统计和内存概览。
- 分析 Texture、Mesh、Shader、Material、Renderer 和 Animation。
- 读取 Hierarchy、MonoBehaviour 和 Bundle 依赖。
- 生成批量 Texture 与资产规范审计。
- 标记 Unity 版本、原生 DLL、导出格式和大型 Bundle 内存限制。

建议新增：

- [`GraphicsAssetProvider.ts`](../src/services/graphics-provider/GraphicsAssetProvider.ts)
- [`AssetStudioMcpProvider.ts`](../src/services/graphics-provider/providers/asset-studio-mcp/AssetStudioMcpProvider.ts)
- [`GraphicsAssetTypes.ts`](../src/services/graphics-provider/GraphicsAssetTypes.ts)

首批 Capability：`loadArtifact`、`getAssetInventory`、`analyzeTexture`、`analyzeMesh`、`getMaterialContract`、`getRendererConfiguration`、`getBuildAssetMemory`、`getBundleDependencies` 和 `readSerializedComponent`。

### 2.0.6 验收标准

- 市场清单显式包含全部正式 Graphics、RenderDoc、Unity Skills 和 AssetStudio MCP。
- 本地与远程加载得到一致的商品 ID、分组、文件列表和能力元数据。
- 安装项目级 Knowledge 后，无需重新打包扩展即可被知识路由命中。
- 项目级、全局和内置知识冲突时遵循确定且可测试的优先规则。
- 每个 Skill 引用的工具和参考文件均通过 CI 契约校验。
- AssetStudio MCP 可通过 Provider 返回结构化 Texture、Mesh、Material 和内存结果。
- 缺少运行时、原生 DLL 或不支持的 Unity 版本时返回明确降级信息。

---

## 2.1 P0：Graphics Feature Planner 图形功能规划与技术方案工作流

### 2.1.1 目标

把策划或美术提供的效果描述、参考图和交互要求转换为可执行的图形 Feature Spec，并基于项目现状完成技术选型、影响分析、任务拆解、性能预算和验收设计。此工作流应成为 Graphics Mode 的默认开发入口。

### 2.1.2 输入与需求澄清

#### A. 支持的输入

- 策划需求、用户故事和玩法规则。
- 美术概念图、效果图、录屏、参考游戏和 DCC 输出说明。
- TA 提供的材质节点图、Shader 草稿、资产规范或技术约束。
- 现有 Feature 改造需求和平台适配需求。
- 目标引擎、版本、渲染管线、平台、质量档位和发布时间。

#### B. 结构化 Graphics Feature Brief

统一提取：

- `featureName`：功能名称。
- `visualGoal`：希望用户看到的最终效果。
- `referenceAssets`：参考图、视频、场景和已有实现。
- `triggerAndLifecycle`：触发条件、持续时间、叠加规则、销毁与恢复。
- `cameraAndSpace`：世界空间、屏幕空间、相机关系和多相机要求。
- `lightingAndMaterial`：光照、阴影、透明、材质和颜色空间要求。
- `artControls`：美术需要暴露的参数、曲线、贴图和预览能力。
- `runtimeControls`：客户端需要调用的接口、事件、状态和同步数据。
- `targetPlatforms`：平台、Graphics API、GPU 档位和质量等级。
- `performanceBudget`：GPU、CPU、内存、带宽、Draw/Dispatch 和加载预算。
- `compatibilityConstraints`：HDR、MSAA、动态分辨率、XR、多相机等约束。
- `acceptanceCriteria`：视觉、功能、性能和兼容性验收标准。
- `openQuestions`：无法从当前输入确定、必须向相关角色确认的问题。

Agent 不应直接从模糊描述开始写 Shader；缺少会改变架构选型的关键信息时，应先生成最少且具体的澄清问题。

### 2.1.3 项目图形架构盘点

在提出方案前自动读取并生成 `GraphicsProjectProfile`：

- 引擎与版本：Unity/Unreal/自研引擎及其版本。
- 渲染路径：Built-in/URP/HDRP、Forward/Deferred、Mobile/Clustered 等。
- Render Pipeline、Render Graph、Renderer Feature、Custom Pass 和后处理入口。
- Shader 语言、模板、Include、Keyword/Variant 管理和编译链。
- 材质系统、资源加载、对象池、实例化和批处理方式。
- 客户端调用层、组件生命周期、事件系统、相机管理和配置系统。
- 美术资源目录、导入设置、命名规范、纹理压缩和 LOD 规则。
- 支持平台、质量档位、Graphics API 与已有降级路径。
- 现有相似效果、可复用模块、历史问题和 Owner。

建议新增：

- [`GraphicsProjectProfiler.ts`](../src/services/graphics-agent/planning/GraphicsProjectProfiler.ts)
- [`GraphicsArchitectureIndex.ts`](../src/services/graphics-agent/planning/GraphicsArchitectureIndex.ts)
- [`GraphicsFeatureBrief.ts`](../packages/types/src/graphics-feature-brief.ts)

### 2.1.4 技术方案分级决策

Agent 至少比较以下实现层级，而不是直接选择最复杂方案：

| 方案层级                     | 适用情况                                     | 主要成本与风险                           |
| ---------------------------- | -------------------------------------------- | ---------------------------------------- |
| 参数/资产配置                | 已有 Shader 和管线能力足够                   | 成本最低，受现有参数边界限制             |
| 单个 Material/Shader         | 局部表面、简单全屏效果，不需要跨对象历史数据 | Variant、透明排序、批处理和平台编译风险  |
| Renderer Feature/Custom Pass | 需要插入固定渲染阶段或额外 RT                | 注入点、相机堆叠、RT 生命周期和带宽风险  |
| 后处理管线扩展               | 屏幕空间效果、历史帧或多级处理               | HDR/色彩空间、动态分辨率、TAA 和顺序风险 |
| Render Graph/Pipeline 修改   | 新 GBuffer、跨 Pass 数据、新光照或全局调度   | 影响面最大，需要多平台和回归保障         |
| Compute/异步计算             | 大规模并行或 GPU 生成数据                    | 同步、Barrier、平台支持和显存读写风险    |
| CPU/客户端替代               | GPU 实现不划算或逻辑主导                     | 主线程、数据上传和对象生命周期风险       |

决策流程：

1. 从现有项目中搜索相似 Feature、Pass、Shader 和工具。
2. 查询市场 Capability Registry，选择可复用 Knowledge、Skill、MCP 和 Provider，避免重复生成通用方法论。
3. 判断效果所需输入是否已存在，是否必须新增 Buffer、RT、历史帧或深度/法线数据。
4. 判断效果作用域：单材质、单对象、局部区域、单相机或全局画面。
5. 判断是否需要修改渲染顺序、光照模型、阴影、透明或后处理链。
6. 估算每种候选方案的代码影响、资产成本、性能成本和兼容性风险。
7. 输出推荐方案、备选方案、拒绝原因、置信度和选中的市场能力。
8. 对修改公共管线、GBuffer、全局 Keyword 或核心 Include 的方案设置架构评审门禁。

建议新增 [`GraphicsSolutionSelector.ts`](../src/services/graphics-agent/planning/GraphicsSolutionSelector.ts)。

### 2.1.5 跨模块详细设计

#### A. 渲染管线与 Render Graph

方案必须说明：

- Pass 插入点、前后依赖和执行条件。
- 输入/输出 Resource、格式、尺寸、MSAA、Mip 和生命周期。
- 临时 RT 分配、复用、清理和动态分辨率策略。
- Depth、Stencil、Motion Vector、GBuffer 和历史帧需求。
- Render Queue、排序、Culling、Batching 和 Instancing 影响。
- Camera Stack、Scene View、反射相机、XR 双眼和多相机行为。
- Compute/Graphics Queue、Barrier 和同步要求。

#### B. Shader 实现

方案必须说明：

- Stage、Entry Point、Pass、LightMode/Tag 和渲染状态。
- 顶点输入、插值器、纹理、Sampler、Constant Buffer 和 Structured Buffer。
- 坐标空间、颜色空间、HDR、曝光、Tonemapping 和 Alpha 语义。
- Keyword、Variant 数量、剔除策略和 Shader Model。
- 精度选择、分支、循环、纹理采样与预期指令复杂度。
- 平台宏、Fallback、调试视图和错误材质行为。

#### C. 客户端调用与联动

方案必须说明：

- 对外 API、组件和配置数据结构。
- 创建、启用、更新、暂停、销毁和场景切换生命周期。
- 参数合法范围、默认值、插值与动画方式。
- 相机、角色、天气、战斗、Timeline/Sequencer 和网络状态联动。
- 异步资源加载、对象池、线程边界和失败恢复。
- 编辑器预览与运行时行为一致性。

#### D. 美术资产要求与规范

方案必须产出可交付给美术/TA 的 Asset Contract：

- 需要的 Mesh、UV、Vertex Color、法线、切线和 Pivot 约定。
- 纹理通道语义、尺寸、色彩空间、格式、压缩、Mip 和 Alpha 规则。
- 材质模板、参数范围、命名、目录和引用规范。
- 粒子数量、骨骼数量、LOD、Bounds 和 Overdraw 限制。
- DCC 导出、引擎导入、自动校验和错误提示规则。
- 不同质量档位的资产差异与 Fallback 资源。

验证分为三层：

1. **源项目层**：读取 Importer、目录、命名和引用配置。
2. **构建产物层**：通过 AssetStudio Provider 检查 Bundle/APK 中的真实 Texture、Mesh、Material、Renderer、Shader 和序列化配置。
3. **运行时层**：通过 RenderDoc Provider 检查真实绑定、资源格式、Pass 使用和 GPU 成本。

建议新增 [`GraphicsAssetContract.ts`](../packages/types/src/graphics-asset-contract.ts) 和 [`GraphicsAssetValidator.ts`](../src/services/graphics-agent/assets/GraphicsAssetValidator.ts)。

#### E. 性能预算与兼容性

每个 Feature 在编码前建立预算表：

- GPU 时间和各 Pass 子预算。
- CPU 提交、更新和剔除预算。
- Draw/Dispatch、三角形、实例和 Shader Variant 增量。
- 常驻/峰值显存、临时 RT、带宽和加载峰值。
- 平台矩阵：Windows/Android/iOS/XR、API、GPU 档位和驱动风险。
- 质量档位：关闭、低、中、高及自动降级条件。
- 与 HDR、MSAA、TAA、动态分辨率、后处理和多相机的组合测试。

### 2.1.6 输出物与任务拆解

工作流输出 `GraphicsFeaturePlan`，并记录 `selectedCapabilities`：

- 选中的 Knowledge ID、版本和用途。
- 选中的 Skill ID、版本和执行阶段。
- 所需 Provider Capability 与可用性预检结果。
- 所需 MCP、前置环境和降级方案。
- 能力来源：内置、全局市场或项目市场。

计划至少包含：

1. 需求摘要和待确认问题。
2. 项目现状与可复用能力。
3. 推荐方案、备选方案和决策依据。
4. 渲染管线设计。
5. Shader 设计。
6. 客户端 API 与生命周期设计。
7. 美术资产 Contract 与自动校验规则。
8. 性能预算、兼容性矩阵和降级策略。
9. 风险、实验项和技术预研任务。
10. 按依赖排序的实现任务与角色分工。
11. 视觉、功能、性能和兼容性验收计划。

任务建议分为：

- Spike/技术验证。
- 最小视觉原型。
- 正式 Shader 与管线实现。
- 客户端接口与联动。
- 美术工具、模板与资产接入。
- 调试视图和可观测性。
- 单元测试、截图测试和目标设备测试。
- 文档、示例场景与交付验收。

建议新增：

- [`GraphicsFeaturePlannerWorkflow.ts`](../src/services/graphics-agent/workflows/GraphicsFeaturePlannerWorkflow.ts)
- [`GraphicsFeaturePlan.ts`](../packages/types/src/graphics-feature-plan.ts)
- [`GraphicsFeaturePlanView.tsx`](../webview-ui/src/components/graphics/planning/GraphicsFeaturePlanView.tsx)
- [`GraphicsArchitectureDecisionView.tsx`](../webview-ui/src/components/graphics/planning/GraphicsArchitectureDecisionView.tsx)
- [`GraphicsAssetContractView.tsx`](../webview-ui/src/components/graphics/planning/GraphicsAssetContractView.tsx)

### 2.1.7 实施工作流与变更门禁

建议分阶段执行：

1. **需求冻结**：相关角色确认 Feature Brief 和验收标准。
2. **方案评审**：确认实现层级、公共管线影响和平台策略。
3. **原型验证**：先在隔离场景验证视觉可行性和初步成本。
4. **正式实现**：按依赖顺序修改 Shader、管线、客户端和工具。
5. **资产接入**：运行自动资产校验并修复不合规输入。
6. **联调**：验证生命周期、相机、场景、动画和玩法联动。
7. **多维验收**：执行视觉、功能、性能和兼容性测试。
8. **发布准备**：确认开关、降级、回滚、监控和维护文档。

修改核心 Render Pipeline、公共 Shader Include、全局 Keyword、GBuffer 布局或跨平台编译配置时，必须展示影响范围并要求显式确认。

### 2.1.8 测试与验收标准

- 给定一份自然语言效果需求，可生成字段完整的 Graphics Feature Brief。
- 能识别项目引擎、渲染路径、主要 Pass/Shader 和可复用实现；无法识别时明确缺失信息。
- 同一需求至少比较两种可行方案，并解释为何选择 Shader、后处理或管线修改。
- 输出覆盖管线、Shader、客户端、美术资产、性能和兼容性，不遗漏跨模块责任。
- 每个实现任务包含输入、输出、依赖、Owner 类型和完成条件。
- 每项验收标准可被截图、自动化测试、构建结果、Profiler 或 Capture 数据验证。
- 对公共管线高风险修改存在评审门禁和回滚设计。
- 使用固定需求样本测试方案选择稳定性，包括单 Shader、后处理、Render Graph 修改和“不应开发”的反例。

---

## 2.2 P0：Graphics Workspace 图形工作台

### 2.2.1 目标

在 Webview 中提供 Graphics Mode 的专用工作区，让 Feature Plan、市场能力选择、源项目/构建产物/运行时证据、诊断结果和快捷操作成为一等界面，而不是隐藏在聊天文本或后端消息中。工作台必须是 **Provider 无关的核心容器**，默认围绕 Feature 生命周期组织；RenderDoc for VS Code 只是可选的 Runtime Capture Provider，未安装时不得影响 Feature 规划、源码分析、Shader/管线设计、资产规范和报告能力。

### 2.2.2 细节功能

#### A. Graphics Mode 页面入口与渐进增强

- 当当前模式为 Graphics 时显示图形工作台入口。
- 支持“聊天”和“图形工作台”之间切换。
- 支持“Feature Plan”“Asset/Build Validation”“Runtime Investigation”三个阶段视图。
- Feature Plan 是默认且始终可用的主页，不依赖任何外部 Provider。
- 首次进入时先请求 Feature 与 Capability 状态；仅在对应 Provider 可用且用户进入相关视图时，请求 Asset/Capture/Selection 数据。
- 市场能力未安装或契约不满足时显示安装、升级、替代能力与降级引导。
- AssetStudio 不可用时只禁用构建产物检查，不影响其他视图。
- RenderDoc 不可用时只禁用 Runtime Capture 面板及其 Quick Actions，不产生全局错误。
- Provider 已连接但无 Capture 时，在 Runtime Investigation 内显示“打开 Capture”或“启动并捕获”入口。

#### B. Provider 无关的核心区

核心区始终可用，包含：

- Feature Brief 与待确认问题。
- 项目图形画像和可复用工程能力。
- 方案比较、架构决策和风险门禁。
- 选中的 Knowledge、Skill、MCP、Provider Capability 及其来源。
- 跨模块任务、Asset Contract、性能预算和兼容性矩阵。
- 源项目证据、验收状态、历史决策和报告导出。

#### C. 可选 Runtime Capture 面板

Capture 状态栏、Frame Overview、Selected Event Inspector、Resource Inspector 和 Draw Preview 均属于 Runtime Investigation 下的 Provider 面板，不属于工作台核心。第一版可以由 RenderDoc Provider 实现，后续允许 PIX、Nsight、AGI 或引擎 Frame Debugger 提供替代面板。

##### Capture 状态栏

显示：

- Provider 名称与连接状态。
- Capture 文件路径。
- Graphics API。
- GPU/设备名称。
- 分辨率和帧编号。
- 当前选中 Event ID。
- Replay 是否可用。
- 最近一次刷新时间。

状态建议统一为：

- unavailable
- connecting
- no-capture
- ready
- capturing
- analyzing
- error

##### Frame Overview

显示：

- 总 GPU 帧时间。
- 目标帧时间和预算差值。
- Pass 数量。
- Draw、Dispatch、Mesh Dispatch 数量。
- Top N 热点 Event。
- Top N 热点 Pass。
- 总纹理和 Buffer 显存占用摘要。

交互：

- 点击 Pass 过滤 Event。
- 点击 Event 打开详情。
- 点击资源跳转到 Resource Inspector。
- 一键运行“分析当前帧”。

##### Selected Event Inspector

至少包含：

- Event 基本信息和 GPU Timing。
- Draw/Dispatch 参数。
- Pipeline 摘要。
- Shader Stage 和 Entry Point。
- Render Target、Depth、Texture、Buffer、Sampler。
- Mesh 摘要。
- 当前 Draw Preview。
- 项目源码映射候选。

#### D. 结构化结果与证据卡片

统一渲染以下区块：

- Feature 阶段、当前结论和待办门禁。
- 选中的 Knowledge、Skill、MCP、Provider Capability、版本与来源。
- 源项目、构建产物和运行时三层证据及其关联关系。
- 疑似问题及置信度。
- 建议动作。
- 项目源码映射。
- 使用过的 Provider 工具。
- 执行耗时。
- 保存书签和导出报告入口。

#### E. Capability 驱动的 Quick Actions

第一版提供：

始终可用：

- Plan Graphics Feature
- Review Architecture Decision
- Validate Asset Contract
- Find Owner In Project

AssetStudio Capability 可用时：

- Audit Build Artifact

Runtime Capture Capability 可用时：

- Analyze Current Frame
- Explain Selected Draw
- Diagnose Black Screen
- Diagnose GPU Slow
- Analyze Shader
- Trace Selected Resource
- Compare Captures

### 2.2.3 实现方案

#### 前端组件拆分

建议新增：

- [`GraphicsWorkspace.tsx`](../webview-ui/src/components/graphics/GraphicsWorkspace.tsx)：Provider 无关容器。
- [`GraphicsFeatureHome.tsx`](../webview-ui/src/components/graphics/feature/GraphicsFeatureHome.tsx)：始终可用的默认主页。
- [`GraphicsCapabilityPanel.tsx`](../webview-ui/src/components/graphics/capabilities/GraphicsCapabilityPanel.tsx)：能力状态、来源与降级动作。
- [`GraphicsResultCard.tsx`](../webview-ui/src/components/graphics/GraphicsResultCard.tsx)：统一结果与证据展示。
- [`GraphicsQuickActions.tsx`](../webview-ui/src/components/graphics/GraphicsQuickActions.tsx)：按 Capability 过滤动作。
- [`GraphicsProviderStatus.tsx`](../webview-ui/src/components/graphics/GraphicsProviderStatus.tsx)
- [`GraphicsEmptyState.tsx`](../webview-ui/src/components/graphics/GraphicsEmptyState.tsx)
- [`RuntimeInvestigationPanel.tsx`](../webview-ui/src/components/graphics/runtime/RuntimeInvestigationPanel.tsx)：可选运行时容器。
- [`RenderDocInspector.tsx`](../webview-ui/src/components/graphics/runtime/renderdoc/RenderDocInspector.tsx)：RenderDoc 专属面板。
- [`FrameOverviewPanel.tsx`](../webview-ui/src/components/graphics/runtime/renderdoc/FrameOverviewPanel.tsx)
- [`HotEventsTable.tsx`](../webview-ui/src/components/graphics/runtime/renderdoc/HotEventsTable.tsx)
- [`SelectedEventInspector.tsx`](../webview-ui/src/components/graphics/runtime/renderdoc/SelectedEventInspector.tsx)

#### 前端状态管理

建议在 [`ExtensionStateContext.tsx`](../webview-ui/src/context/ExtensionStateContext.tsx) 外单独建立 Graphics 状态，避免继续扩大主上下文：

- [`GraphicsStateContext.tsx`](../webview-ui/src/context/GraphicsStateContext.tsx)
- 保存 Provider、Capture、Selection、Workflow Result、Loading 和 Error。
- 对频繁变化的 Selection 与静态 Capture Metadata 分开更新。
- 对 Frame Summary 和 Event Details 使用查询缓存，避免重复请求。

#### 消息协议类型化

在共享类型中补齐并导出：

- GraphicsWorkflowStartedMessage
- GraphicsResultMessage
- GraphicsProviderStatusMessage
- GraphicsCaptureStatusMessage
- GraphicsSelectionChangedMessage
- RequestGraphicsFrameSummaryMessage
- RequestGraphicsEventDetailsMessage

相关类型放入 [`graphics.ts`](../packages/types/src/graphics.ts)，并在 [`index.ts`](../packages/types/src/index.ts) 导出。

禁止在 [`graphicsMessageHandler.ts`](../src/core/webview/graphicsMessageHandler.ts) 和 [`App.tsx`](../webview-ui/src/App.tsx) 中继续使用不受约束的类型断言来传递图形消息。

#### 后端消息扩展

在现有 [`handleGraphicsMessage()`](../src/core/webview/graphicsMessageHandler.ts:75) 基础上增加：

- requestGraphicsCaptureStatus
- requestGraphicsFrameSummary
- requestGraphicsSelection
- requestGraphicsEventDetails
- requestGraphicsDrawPreview
- focusGraphicsEvent
- openGraphicsSourceLocation

#### 更新策略

- 进入工作台时主动刷新。
- Capture 改变时清空旧缓存。
- Selection 改变时只刷新 Event Inspector。
- Workflow 运行期间显示步骤进度，而不是单一 Loading。
- Provider Error 转换为可执行恢复动作。

### 2.2.4 测试方案

- Graphics 状态 reducer 单元测试。
- Webview 消息解析测试。
- 无任何外部 Provider 时，Feature Home 仍可完整渲染和操作。
- AssetStudio unavailable 时仅禁用 Build Validation。
- RenderDoc unavailable、no-capture、ready、error 四种 Runtime 面板测试。
- 未进入 Runtime 视图时不发送 Capture、Selection 或 Event 请求。
- Frame Summary 和 Event Inspector 渲染测试。
- Capability 驱动的 Quick Action 可见性与消息发送测试。
- Capture 切换后旧状态清理测试。
- 不完整 Provider 数据的降级渲染测试。

### 2.2.5 验收标准

- 进入 Graphics Mode 后可以打开图形工作台。
- 未安装 RenderDoc for VS Code 和 AssetStudio 时，Feature Plan、项目画像、方案评审、任务、Asset Contract 与报告功能仍可使用。
- 工作台能够按 Feature Plan、构建产物验证和 Runtime Investigation 三个阶段展示状态。
- 工作台能够显示市场能力选择、Provider 和 Capture 状态。
- 用户可以从 UI 触发已注册的 Workflow 和 Playbook，并看到 Capability 预检结果。
- AssetStudio 与 RenderDoc 结果能按证据来源结构化渲染并关联项目事实。
- RenderDoc 缺失只影响 Runtime Capture 功能，不产生工作台级错误，也不提前请求 Capture 数据。
- 点击 Event 可刷新 Event Inspector。
- 所有新增消息均有共享类型，不使用任意类型逃逸。
- 无市场能力、无 Provider、无 Capture、工具失败时均有明确恢复入口。

---

## 2.3 P0：补齐公开 Graphics Intent 对应工作流

### 2.3.1 目标

消除“意图识别成功但没有注册工作流”的断层，确保公开意图均能落到可执行流程。

### 2.3.2 第一批工作流

#### A. Frame Performance Workflow

处理：为什么这一帧慢、哪些 Pass 超预算、热点在哪里。

步骤：

1. 获取 Capture 信息和目标 Profile。
2. 获取 Frame Summary、Pass Graph 和 Action Timings。
3. 按 Pass 聚合时间。
4. 计算相对帧预算占比。
5. 选择 Top N Event 做进一步分析。
6. 对最热 Event 获取 Pipeline、资源和 Shader 摘要。
7. 输出热点排名、证据和下一步动作。

建议新增 [`analyzeFramePerformance.ts`](../src/services/graphics-agent/workflows/analyzeFramePerformance.ts)。

#### B. Shader Analysis Workflow

处理：Shader 为什么重、绑定是否异常、有哪些变体。

步骤：

1. 从 Selection 或显式 Event ID 获取 Shader。
2. 读取所有绑定 Stage，而不是固定 Pixel Stage。
3. 获取 Shader Info、源码/反汇编和编译诊断。
4. 分析资源绑定、Constant Buffer、输入输出和编译标志。
5. 搜索项目实现和变体。
6. 输出事实、潜在风险和可修改位置。

建议新增 [`analyzeShader.ts`](../src/services/graphics-agent/workflows/analyzeShader.ts)。

#### C. Pipeline Analysis Workflow

处理：Pipeline State 是否异常、两个 Draw 为什么结果不同。

步骤：

1. 获取当前 Event Pipeline State。
2. 规范化 API 差异。
3. 检查 Render Target、Depth、Blend、Rasterizer、Viewport、Scissor 和 Binding。
4. 用户提供对照 Event 时执行 Pipeline Diff。
5. 将差异分为影响输出、影响性能和无关差异。

建议新增 [`analyzePipeline.ts`](../src/services/graphics-agent/workflows/analyzePipeline.ts)。

#### D. Resource Trace Workflow

处理：纹理从哪里来、谁写入、哪些 Draw 使用。

步骤：

1. 接收 Resource ID 或从 Selection 获取资源。
2. 获取资源详情和预览。
3. 追踪全帧生产者与消费者。
4. 标识首次写入、最后写入和最终读取。
5. 关联 Pass、Event、Shader Slot 和源码候选。
6. 生成资源生命周期图。

建议新增 [`traceGraphicsResource.ts`](../src/services/graphics-agent/workflows/traceGraphicsResource.ts)。

#### E. Regression Compare Workflow

第一版只做两个 Capture 的结构化差异：

1. 读取基准和候选 Capture Metadata。
2. 对比资源显存。
3. 对比已有 Timing 数据。
4. 对比 Pass、Draw 和 Shader 数量。
5. 标记新增、删除和显著变化项。
6. 对结论注明证据边界，不能把跨 Capture 不可比数据描述为确定回归。

建议新增 [`compareGraphicsCaptures.ts`](../src/services/graphics-agent/workflows/compareGraphicsCaptures.ts)。

### 2.3.3 工作流注册方式

不要继续在 [`getGraphicsOrchestrator()`](../src/core/webview/graphicsMessageHandler.ts:55) 中逐个硬编码注册。建议新增：

- [`registerBuiltInGraphicsWorkflows.ts`](../src/services/graphics-agent/workflows/registerBuiltInGraphicsWorkflows.ts)
- 返回完整工作流集合。
- 启动时验证 Graphics Intent 与注册工作流覆盖关系。
- 测试中断言所有公开可执行 Intent 都有实现。

### 2.3.4 统一执行上下文

建议扩展工作流请求，加入：

- sessionId
- captureId/capturePath
- eventId
- resourceId
- baselineCapturePath
- candidateCapturePath
- targetProfile
- userQuestion
- cancellationToken
- progressReporter

避免每个工作流自行从全局状态读取上下文。

### 2.3.5 验收标准

- 所有公开 Graphics Intent 都有已注册工作流或明确标记为仅路由型 Intent。
- 每个工作流声明所需 Provider Capability。
- Capability 不满足时返回具体降级建议。
- 每个工作流输出统一 Graphics Workflow Result。
- 每个工作流至少有成功、缺少上下文、能力不足和工具失败测试。

---

## 2.4 P1：Shader 修改、编译与热替换验证闭环

### 2.4.1 目标

让 Vertex 不止能解释 Shader，还能完成“定位 → 修改 → 编译验证 → 热替换 → 视觉或性能验证 → 回滚”的闭环。

### 2.4.2 细节功能

#### A. Shader Identity Resolver

统一识别：

- Capture Shader Resource ID。
- Stage。
- Entry Point。
- Shader 语言。
- Capture 中源码文件列表。
- 项目中的候选文件。
- Include 依赖。
- 宏和编译标志。
- Variant/Keyword。

输出映射置信度和证据。

建议新增 [`ShaderIdentityResolver.ts`](../src/services/graphics-agent/shader/ShaderIdentityResolver.ts)。

#### B. Shader Edit Session

一次修改会话保存：

- 原始 Capture Shader。
- 原始项目源码快照。
- Event ID 和 Stage。
- Entry Point。
- 编译参数。
- 修改内容。
- 编译结果。
- 热替换结果。
- Preview 前后截图。
- 性能前后数据。
- 是否已提交到项目文件。

建议新增 [`ShaderEditSession.ts`](../src/services/graphics-agent/shader/ShaderEditSession.ts)。

#### C. 编译预检

修改项目文件前：

1. 获取 Capture 中 Shader 源码和编译参数。
2. 生成候选修改。
3. 调用 Shader Edit Validate 能力。
4. 展示编译错误、警告及文件行号。
5. 只有预检通过后才允许热替换。

#### D. 热替换

1. 调用 Shader Edit Apply 能力。
2. 重新 Replay 当前 Event。
3. 获取当前 Draw Preview。
4. 检查 Replay Validation。
5. 失败时自动恢复原始 Shader。

#### E. 修改效果验证

至少支持：

- Preview 前后视觉对比。
- Shader 编译诊断对比。
- Shader 结构和绑定差异。
- 当前 Event Timing 对比；若工具不保证可比，应明确标记为观察值。
- 用户确认后再写入项目源码。

#### F. 安全策略

- Capture 热替换和项目文件修改分开确认。
- 项目源码修改必须使用现有 Diff 和 Checkpoint 能力。
- 热替换失败自动回滚 Replay Shader。
- 编译参数不完整时不猜测，要求用户选择或仅生成建议 Patch。
- Include 文件修改时显示受影响 Variant 范围。

### 2.4.3 Provider 能力扩展

建议在 [`GraphicsCaptureProvider.ts`](../src/services/graphics-provider/GraphicsCaptureProvider.ts) 增加可选能力：

- getShaderSource
- getShaderCompileDiagnostics
- findShaderVariants
- compareShaders
- validateShaderEdit
- applyShaderEdit
- getCurrentDrawPreview
- clearShaderReplacement

并在 [`GraphicsProviderTypes.ts`](../src/services/graphics-provider/GraphicsProviderTypes.ts) 增加对应请求和结果类型。

### 2.4.4 前端实现

新增：

- [`ShaderInspector.tsx`](../webview-ui/src/components/graphics/shader/ShaderInspector.tsx)
- [`ShaderEditReview.tsx`](../webview-ui/src/components/graphics/shader/ShaderEditReview.tsx)
- [`ShaderCompileDiagnostics.tsx`](../webview-ui/src/components/graphics/shader/ShaderCompileDiagnostics.tsx)
- [`DrawPreviewComparison.tsx`](../webview-ui/src/components/graphics/shader/DrawPreviewComparison.tsx)

### 2.4.5 验收标准

- 可从选中 Draw 解析 Shader Stage 和 Entry Point。
- 可读取 Capture Shader 和项目候选源码。
- Shader 修改在应用前必须通过编译预检。
- 可在 Replay 中应用和撤销 Shader 替换。
- 可显示修改前后 Draw Preview。
- 热替换失败不会污染项目源码。
- 用户确认后可将验证过的修改应用到项目文件。
- 全流程生成可追踪的 Shader Edit Session 记录。

---

## 2.5 P1：启动应用、自动 Capture 与再次验证

### 2.5.1 目标

把当前以“用户已经打开 Capture”为前提的流程，扩展成由 Agent 主动启动目标、Capture 和复测。

### 2.5.2 细节功能

#### A. Graphics Launch Profile

每个项目可保存多个启动配置：

- 平台：Windows/Android。
- 可执行文件或 Package/Activity。
- Working Directory。
- Command Line。
- 环境变量引用。
- Capture 触发方式：立即、指定帧、延迟。
- 启动后等待时间。
- 预期 Graphics API。
- 默认性能预算。

配置中禁止保存明文密钥。

建议定义在项目配置或专用文件中，例如 [`graphics-profiles.json`](../.vertex/graphics-profiles.json)。

#### B. Launch and Capture Workflow

步骤：

1. 校验 Launch Profile。
2. 检查 RenderDoc 环境。
3. 启动应用。
4. 等待 Live Target。
5. 按策略触发 Capture。
6. 等待 Capture 完成。
7. 加载 Capture。
8. 获取 Frame Summary。
9. 将结果绑定到当前调查会话。

建议新增 [`launchAndCapture.ts`](../src/services/graphics-agent/workflows/launchAndCapture.ts)。

#### C. Re-Capture Validation Workflow

代码修改后：

1. 构建项目或运行用户配置的构建命令。
2. 启动相同 Profile。
3. 使用相同 Capture 策略。
4. 获取候选 Capture。
5. 与基准 Capture 对比。
6. 逐条检查验收标准。
7. 输出通过、失败或数据不足。

建议新增 [`validateGraphicsFix.ts`](../src/services/graphics-agent/workflows/validateGraphicsFix.ts)。

### 2.5.3 可重复性设计

Capture 对比前必须记录：

- Profile ID。
- Git Commit 和工作区状态。
- 分辨率。
- Quality Level。
- 场景/关卡。
- Camera。
- Graphics API。
- GPU 和驱动。
- Capture 触发方式。

若关键条件不一致，报告必须降低置信度。

### 2.5.4 验收标准

- 用户可创建并选择 Launch Profile。
- Agent 可启动 Windows 或 Android 目标并获得 Capture。
- 启动失败时提供环境诊断。
- 修改前后 Capture 绑定到同一调查会话。
- 对比报告显示环境一致性。
- 验证结果不会把不可比数据描述为确定改善。

---

## 2.6 P1：Graphics Investigation Session 调查会话

### 2.6.1 目标

为一次图形问题建立持久化调查上下文，使 Event、资源、源码、修改和 Capture 对比不会散落在普通聊天消息中。

### 2.6.2 数据模型

建议会话包含：

- investigationId
- title
- issueType
- targetProfile
- baselineCapture
- candidateCaptures
- selectedEvents
- selectedResources
- evidence
- hypotheses
- conclusions
- sourceMappings
- codeChanges
- shaderEditSessions
- bookmarks
- acceptanceCriteria
- validationResults
- createdAt/updatedAt

建议新增：

- [`GraphicsInvestigation.ts`](../packages/types/src/graphics-investigation.ts)
- [`GraphicsInvestigationService.ts`](../src/services/graphics-agent/investigation/GraphicsInvestigationService.ts)

### 2.6.3 功能

- 从当前 Capture 创建调查。
- 将 Workflow Result 添加为证据。
- 将 Event、Resource 和源码位置保存为书签。
- 记录每次假设及其状态：待验证、已确认、已排除。
- 记录修改和验证结果。
- 恢复历史调查。
- 导出 Markdown/JSON 报告。

### 2.6.4 验收标准

- 调查会话在 VS Code 重启后可恢复。
- 每条结论能够追溯到证据。
- 每次代码或 Shader 修改能够关联对应验证结果。
- 可导出包含 Capture、证据、修改和结论的报告。

---

# 3. 建议开发部分

建议开发部分用于扩大图形问题覆盖面、降低误判并增强日常开发效率。应在重点开发部分形成稳定闭环后逐步实现。

## 3.1 视觉问题诊断

### 3.1.1 目标

从结构化 GPU 数据扩展到“画面为什么错”，建立图像异常、Pass、Event、Shader 和源码之间的链路。

### 3.1.2 细节功能

- 最终 Backbuffer 预览。
- 当前 Draw Preview。
- 中间 Render Target 预览。
- RGBA 单通道、Depth、Stencil 可视化。
- Overlay 对比。
- 基准截图与候选截图并排、滑杆或差分显示。
- 标记异常区域并关联首次出现异常的 Pass。

### 3.1.3 第一批诊断类型

- 黑屏/空白输出。
- 粉屏/Shader 丢失。
- Z-Fighting。
- Shadow Acne/Peter Panning。
- Normal Map 方向或空间错误。
- Gamma/Linear/HDR 错误。
- TAA Ghosting。
- SSR 漏光或断裂。
- 透明排序和 Blend 错误。
- NaN、Firefly、Banding。

### 3.1.4 实现思路

1. 获取最终输出和关键中间资源。
2. 沿资源生产者链逆向定位首次异常 Pass。
3. 读取该 Pass 的 Pipeline、Shader 和输入资源。
4. 使用问题类型 Playbook 做分支检查。
5. 将异常区域、Event 和源码候选一起展示。

建议新增 [`diagnoseVisualArtifact.ts`](../src/services/graphics-agent/workflows/diagnoseVisualArtifact.ts)。

### 3.1.5 验收标准

- 可读取和显示最终输出及指定 Render Target。
- 至少支持黑屏、阴影异常和 Gamma 错误三种结构化诊断。
- 结论包含图像证据和 GPU 状态证据。
- 可从异常资源追踪到生产 Event。

---

## 3.2 Playbook 状态机升级

### 3.2.1 问题

当前 Playbook 是固定步骤和硬编码规则，无法根据证据动态选择下一步，也缺少停止条件和证据要求。

### 3.2.2 建议模型

每个 Playbook 由以下结构组成：

- Metadata
- Preconditions
- Inputs
- Steps
- Branch Conditions
- Required Evidence
- Stop Conditions
- Recovery Actions
- Conclusion Rules

步骤状态：

- pending
- running
- passed
- failed
- skipped
- inconclusive

### 3.2.3 执行器

建议新增 [`GraphicsPlaybookEngine.ts`](../src/services/graphics-agent/playbooks/GraphicsPlaybookEngine.ts)：

- 根据 Provider Capability 跳过不可执行步骤。
- 支持条件分支。
- 支持进度事件。
- 支持取消。
- 支持步骤结果缓存。
- 支持证据引用。
- 支持恢复中断的 Playbook。

### 3.2.4 新增 Playbook

建议按价值排序：

1. Resource Barrier/同步错误。
2. Overdraw。
3. GPU Hang/Device Lost。
4. Descriptor/Binding 错误。
5. Compute Dispatch 错误。
6. Transparency/Blend 错误。
7. TAA Ghosting。
8. Z-Fighting。
9. HDR/Tonemapping 错误。
10. 移动端 Tile GPU 性能。
11. VR/XR 帧预算与双眼渲染。

### 3.2.5 验收标准

- Playbook 能根据前一步结果选择不同分支。
- 每个结论声明所需证据。
- 数据不足时返回 inconclusive，而不是猜测。
- UI 能显示当前步骤和整体进度。
- 每个 Playbook 有固定输入样本测试。

---

## 3.3 Graphics Target Profile 与上下文阈值

### 3.3.1 目标

替代通用固定阈值，让性能和正确性判断结合实际目标环境。

### 3.3.2 Profile 字段

- 平台。
- GPU 厂商与型号。
- Graphics API。
- 驱动版本。
- 分辨率。
- 目标 FPS。
- 每眼分辨率和 XR 刷新率。
- 功耗/热预算。
- 引擎和版本。
- 渲染路径。
- Quality Level。
- MSAA。
- 动态分辨率。
- 项目自定义 Pass Budget。

### 3.3.3 规则系统

规则不直接写死在工作流中，改为：

- 条件。
- 适用平台。
- 指标。
- 阈值来源。
- 置信度。
- 解释。
- 建议动作。

建议新增 [`GraphicsRuleEngine.ts`](../src/services/graphics-agent/rules/GraphicsRuleEngine.ts)。

### 3.3.4 验收标准

- 用户可配置目标 FPS 和平台。
- 相同 Capture 在不同 Profile 下可得到不同严重级别。
- 报告显示阈值来源。
- 无 Profile 时明确使用默认值并降低置信度。

---

## 3.4 图形工程映射增强

### 3.4.1 目标

从字符串搜索升级为可解释的 Capture-to-Code 映射。

### 3.4.2 建议建立的关系

- Shader 文件 → Entry Point → Variant。
- Material → Shader → Pass。
- Render Graph Node → Marker/Pass。
- Pipeline Marker → 提交函数。
- Resource → 创建点 → 写入点 → 读取点。
- API Event → 引擎封装函数。
- Draw/Dispatch → Command Buffer 录制位置。

### 3.4.3 实现方案

- 利用现有代码索引和 Tree-sitter 建立符号索引。
- 扫描 Shader Include 和编译配置。
- 解析常见引擎 Marker 宏。
- 使用文件名、Entry Point、Pass 名和 Marker 组合评分。
- 每个候选保存命中证据，不只保存分数。
- 项目允许通过配置补充命名规则。

建议新增：

- [`GraphicsProjectMapper.ts`](../src/services/graphics-agent/project-mapping/GraphicsProjectMapper.ts)
- [`ShaderDependencyGraph.ts`](../src/services/graphics-agent/project-mapping/ShaderDependencyGraph.ts)
- [`RenderPassIndex.ts`](../src/services/graphics-agent/project-mapping/RenderPassIndex.ts)

### 3.4.4 验收标准

- 映射结果提供文件、符号、行号、置信度和证据。
- 支持从 Shader Entry Point 找到项目源码。
- 支持从 Pass/Marker 找到提交代码候选。
- 映射失败时给出缺失信息，不伪造 Owner。

---

## 3.5 Resource 与显存分析

### 3.5.1 细节功能

- 按大小排序 Texture 和 Buffer。
- 按类型、格式、Mip、尺寸统计显存。
- 标记异常大资源。
- 标记无直接使用证据的资源候选。
- 比较两个 Capture 的资源内存变化。
- 展示 Resource Producer/Consumer。
- 识别重复或相似资源候选。

### 3.5.2 注意事项

- “未发现使用证据”不能等同于运行时泄漏。
- 单个 Capture 不能证明完整生命周期。
- 跨 Capture 持久资源只能标记为低置信度候选。
- 报告必须保留启发式限制说明。

### 3.5.3 建议工作流

- [`auditGraphicsMemory.ts`](../src/services/graphics-agent/workflows/auditGraphicsMemory.ts)
- [`findUnusedGraphicsResources.ts`](../src/services/graphics-agent/workflows/findUnusedGraphicsResources.ts)
- [`compareGraphicsMemory.ts`](../src/services/graphics-agent/workflows/compareGraphicsMemory.ts)

### 3.5.4 验收标准

- 可生成资源占用 Top N。
- 可比较两个 Capture 的资源字节差异。
- 可追踪指定资源的生产者和消费者。
- 所有泄漏或未使用判断明确标记置信度和限制。

---

## 3.6 Intent Router 增强

### 3.6.1 目标

降低纯关键词误触发，并让路由结果包含执行所需参数。

### 3.6.2 实现思路

采用两阶段路由：

1. 轻量规则识别明显意图。
2. 对模糊请求使用结构化模型分类。

路由输出增加：

- intent
- confidence
- eventId
- resourceId
- shaderStage
- baseline/candidate
- requestedAction
- requiredContext
- missingContext

### 3.6.3 验收标准

- 普通编程中的 event、frame、render 等词不会轻易误触发。
- 可从用户文本提取 Event ID 和 Resource ID。
- 缺少必要参数时生成精确补充问题。
- 路由测试覆盖中英文、混合语言和否定表达。

---

## 3.7 Graphics 专项评测与样本库

### 3.7.1 目标

建立可重复验证的图形诊断质量基线，避免只依赖人工感受。

### 3.7.2 样本类别

- 黑屏。
- Hot Draw。
- Heavy Shader。
- Pipeline State 错误。
- Resource Binding 错误。
- Shadow Artifact。
- Overdraw。
- 显存增长。
- Capture 回归。
- Shader 修改改善和无改善样本。

### 3.7.3 每个样本记录

- Capture 或 Mock 数据。
- 项目源码片段。
- 用户问题。
- 预期关键证据。
- 可接受结论。
- 禁止出现的无依据结论。
- 预期源码映射。
- 验证指标。

### 3.7.4 测试层次

1. Provider Adapter Contract Test。
2. Workflow Unit Test。
3. Playbook Branch Test。
4. Webview Integration Test。
5. Fixed Capture Golden Test。
6. End-to-End Fix Validation Test。

### 3.7.5 验收指标

- 证据引用正确率。
- 根因 Top 3 命中率。
- 无依据事实生成率。
- 源码映射 Top 3 命中率。
- Workflow 成功率。
- 平均工具调用数量。
- 平均诊断耗时。
- 修复后验收正确率。

---

# 4. 后期规划内容

后期规划面向团队级使用、持续回归、多工具生态和高级自动化。在前述单次调查闭环稳定后实施。

## 4.1 Graphics Regression 平台

### 4.1.1 功能规划

- Capture 基线库。
- 场景和设备维度的基线管理。
- Pass 名称归一化与匹配。
- Event Timing 对比。
- Shader 和 Pipeline 差异。
- Draw/Dispatch 数变化。
- 资源显存变化。
- 图片输出差异。
- 性能预算和回归阈值。
- 历史趋势。

### 4.1.2 报告形式

报告需要包含：

- 环境一致性。
- 关键指标变化。
- Top 回归项。
- 相关 Shader/资源/源码。
- 证据和置信度。
- 推荐 Owner。
- 是否通过预算。

### 4.1.3 长期目标

用户可以直接询问：

> 这个提交是否让 Shadow Pass 变慢，变化来自哪个 Shader 或 Draw，责任代码在哪里？

---

## 4.2 CI 与 PR 集成

### 4.2.1 功能规划

- 在 CI 中启动固定图形场景。
- 自动 Capture 指定帧。
- 与主分支基线比较。
- 生成机器可读 JSON 和 Markdown 报告。
- 将结果发布到 PR。
- 对超预算项阻止合并。
- 保存 Capture Artifact 和截图。

### 4.2.2 实现边界

- 第一阶段仅支持用户提供的 Capture 对比。
- 第二阶段支持 Windows Runner 自动 Capture。
- 第三阶段支持 Android 设备池。
- 不应在环境不一致时做强制门禁。

---

## 4.3 多 Provider 生态

### 4.3.1 目标 Provider

按优先级考虑：

1. RenderDoc。
2. PIX。
3. Nsight Graphics。
4. Android GPU Inspector。
5. Xcode GPU Capture。
6. 引擎内置 Frame Debugger/Profiler。
7. 自研引擎遥测 Provider。

### 4.3.2 架构要求

- Capability 驱动，不按 Provider 名分支。
- 支持同一任务组合多个 Provider。
- 支持 Provider 数据来源标记。
- 支持能力降级。
- 支持 Provider 健康检查和版本兼容矩阵。

### 4.3.3 组合示例

- RenderDoc 提供 Pipeline 和资源事实。
- Nsight 提供厂商性能计数器。
- 项目 Telemetry 提供 CPU 和场景状态。
- Agent 统一生成结论。

---

## 4.4 项目级图形知识图谱

### 4.4.1 数据关系

- Scene → Camera → Render Path。
- Render Pass → Marker → Source Function。
- Material → Shader → Variant。
- Shader → Include → Binding。
- Resource → Creator → Producer → Consumer。
- Capture Event → Pass → Owner。
- Issue → Evidence → Fix → Validation。

### 4.4.2 用途

- 提高源码映射准确率。
- 自动推荐 Owner。
- 复用历史问题解决方案。
- 分析修改影响范围。
- 识别反复出现的渲染问题。

### 4.4.3 注意事项

- 图谱关系必须保存来源和更新时间。
- 自动推断关系必须标记置信度。
- 文件变更后需要增量失效。
- 不应把旧 Capture 事实直接当作当前运行事实。

---

## 4.5 团队知识与调查报告中心

### 4.5.1 功能规划

- 调查模板。
- 团队共享 Playbook。
- 已知问题库。
- Capture 和代码版本关联。
- 调查书签。
- Markdown/JSON/PDF 报告。
- 相似历史问题推荐。
- 问题 Owner 和状态跟踪。

### 4.5.2 目标

将一次个人调试过程转化为团队可检索、可复现、可验证的工程资产。

---

## 4.6 高级自动修复 Agent

### 4.6.1 自动化等级

#### Level 1：建议

- 输出根因候选和修改建议。
- 不修改代码。

#### Level 2：生成 Patch

- 生成 Shader 或渲染代码 Patch。
- 用户确认后应用。

#### Level 3：沙盒验证

- 自动生成 Patch。
- 编译预检。
- Replay 热替换。
- 显示前后对比。
- 用户确认后写入项目。

#### Level 4：自动回归闭环

- 修改项目。
- 构建。
- 重新 Capture。
- 对比指标。
- 未达标时回滚并尝试下一候选方案。

### 4.6.2 安全边界

- 自动修改次数有限制。
- 每轮修改必须有明确假设。
- 每轮验证必须有客观验收标准。
- 无改善时停止，不进行无边界试错。
- 所有自动操作保留 Checkpoint 和调查记录。

---

# 5. 推荐实施顺序

## Milestone 0：市场能力可用性与运行时接通

范围：

- 显式发布全部正式 Graphics、RenderDoc、Unity Skills 和 AssetStudio MCP。
- 建立 Marketplace Capability Registry 和清单校验。
- 合并内置、全局和项目级 Knowledge 索引。
- 建立 Skill 到 MCP/Provider 的工具契约测试。
- 建立 AssetStudio Graphics Asset Provider 和健康检查。

完成标志：市场能力在本地与远程安装路径下均可稳定发现；安装的 Knowledge 能参与路由；所有 Skill 工具引用通过 CI 校验；AssetStudio 能返回结构化资产事实。

## Milestone 1：Feature 需求结构化与项目认知

范围：

- Graphics Feature Brief。
- Graphics Project Profile 与架构索引。
- 现有效果、Pass、Shader、客户端接口和资产规范检索。
- 市场 Knowledge、Skill、MCP 与 Provider Capability 选择。
- 视觉、功能、性能和兼容性验收模板。

完成标志：用户提交效果需求后，Agent 能先理解项目和约束，选择可复用市场能力并产出可评审的结构化需求，而不是立即生成孤立 Shader。

## Milestone 2：技术选型与跨模块方案

范围：

- 参数/资产、单 Shader、后处理、Custom Pass、Render Graph 与管线修改的分级决策。
- 渲染管线、Shader、客户端调用和生命周期详细设计。
- 美术 Asset Contract 与自动校验规则。
- 性能预算、平台矩阵、质量分级和降级策略。
- 任务依赖、角色分工、架构评审和变更门禁。

完成标志：Agent 能针对真实需求给出有项目依据的实现方案，清楚说明为什么要或不要修改公共渲染管线。

## Milestone 3：Feature 实现与联调闭环

范围：

- 最小视觉原型。
- Shader、管线、客户端和编辑器工具协同实现。
- 美术资产接入和自动校验。
- AssetStudio 构建产物审计。
- 相机、场景、玩法、动画与配置联调。
- RenderDoc 运行时绑定和成本验证。
- 截图测试、构建测试、平台编译和回滚开关。

完成标志：可以从 Feature Plan 生成并执行跨模块任务，在示例场景中交付可运行、可配置、可降级的效果，并形成“源项目—构建产物—运行时”的验证证据链。

## Milestone 4：能力可见化与诊断覆盖

范围：

- Graphics Workspace、Provider/Capture 状态和结构化结果。
- Frame Performance、Shader Analysis 和 Pipeline Analysis。
- Resource Trace、基础 Capture Compare 和 Intent 覆盖检查。

完成标志：开发与验证结果可在专用工作台中查看，所有公开 Graphics Intent 均有可执行落点。

## Milestone 5：Shader 修复与复测闭环

范围：

- Shader Identity Resolver、编译预检和 Replay 热替换。
- Draw Preview 对比、项目 Patch、自动回滚。
- Launch Profile、Launch and Capture、调查会话和 Re-Capture Validation。

完成标志：既可验证新 Feature，也可从选中 Draw 定位并修复已有问题，再用相同场景和环境复测。

## Milestone 6：专项质量与平台化

范围：

- Visual Artifact Diagnosis、Playbook 状态机和 Target Profile。
- Project Mapping、Graphics Benchmark Corpus 和项目知识图谱。
- Regression 平台、CI/PR、多 Provider、团队报告中心和高级自动修复。

完成标志：Graphics Agent 从个人开发与调试工具升级为覆盖团队图形 Feature 生命周期的工程基础设施。

---

# 6. 跨阶段工程要求

## 6.1 类型与协议

- 所有 Extension 与 Webview 图形消息进入共享类型。
- Provider 原始结果在 Adapter 层完成归一化。
- Workflow 不直接解析 MCP 文本响应。
- Event ID、Resource ID、Asset Identity、Build Artifact Identity 和 Capture Identity 使用明确类型。
- Marketplace Item、Knowledge Manifest、Skill Dependency 和 Provider Capability 需要共享 Schema。
- 结构化结果需要 Schema 版本，方便后续迁移。

## 6.2 可观测性

每次 Graphics Workflow 记录：

- Workflow ID。
- 选中的 Knowledge、Skill、MCP 与版本。
- Provider 和 Capability 预检结果。
- 能力来源：内置、全局市场或项目市场。
- 工具调用序列。
- 各步骤耗时。
- 缓存命中。
- 错误和恢复动作。
- 最终状态。

日志不得包含用户密钥或不必要的源码全文。

## 6.3 缓存与失效

- Capture 级缓存：Metadata、Frame Summary、资源列表。
- Event 级缓存：Pipeline、Shader、Bound Resources、Preview。
- Build Artifact 级缓存：资产清单、Texture/Mesh 分析、内存和依赖结果。
- Knowledge Registry 缓存：按来源、版本和 Manifest Hash 管理。
- Capture 改变后 Capture/Event 缓存全部失效。
- 构建产物变化后 AssetStudio 结果全部失效。
- Knowledge 安装、卸载或索引变化后路由缓存失效。
- Shader 热替换后当前 Event 相关缓存失效。
- 项目文件变更后 Source Mapping 缓存增量失效。

## 6.4 取消与超时

- 所有长工作流支持取消。
- 每个 Provider Tool 有单独超时。
- 用户切换 Capture 时取消旧 Capture 上的分析。
- Webview 显示当前步骤和可取消入口。

## 6.5 错误分类

建议统一错误类型：

- ProviderUnavailable
- NoCaptureOpen
- ReplayUnavailable
- CapabilityMismatch
- InvalidEvent
- InvalidResource
- ShaderCompileFailed
- ShaderApplyFailed
- CaptureFailed
- EnvironmentMismatch
- WorkflowCancelled
- InconclusiveEvidence
- MarketplaceManifestInvalid
- KnowledgeIndexConflict
- SkillToolContractMismatch
- AssetArtifactUnsupported
- AssetProviderDependencyMissing

每类错误都需要用户可执行的恢复建议。

---

# 7. 整体成功标准

当以下条件全部满足时，可以认为 Vertex 已经从“带图形能力的 Coding Agent”转变为“图形开发优先 Agent”：

1. 市场中的正式 Knowledge、Skill 和 MCP 均有显式清单、依赖、兼容信息和契约测试。
2. 安装到项目或全局目录的 Knowledge 能被运行时索引、路由和注入，并保留完整元数据。
3. 用户给出策划需求、美术参考或 Feature 描述后，Agent 能生成结构化 Graphics Feature Brief。
4. Agent 能读取项目渲染架构和既有能力，而不是脱离工程上下文给出通用方案。
5. Agent 能选择并组合已有市场能力，而不是在主仓库重复硬编码同类领域方法。
6. Agent 能比较参数/资产、单 Shader、后处理、Custom Pass、Compute 和 Render Pipeline 修改方案，并说明决策依据。
7. 技术方案同时覆盖渲染管线、Shader、客户端调用、美术资产、性能预算和兼容性。
8. 可以把方案拆成有依赖、有角色边界和完成条件的实施任务。
9. 可以协助完成视觉原型、正式实现、资产接入、客户端联动和多平台编译。
10. 每个 Feature 都有可验证的视觉、功能、性能和兼容性验收标准及降级策略。
11. 可以使用 AssetStudio 验证构建产物，使用 RenderDoc 验证运行时 GPU 行为，并关联源项目事实。
12. 用户能从专用工作台完成能力选择、运行验证、Capture 浏览和诊断。
13. 所有公开图形意图都有实际工作流，结论能引用真实工程、资产或 Capture 证据。
14. 可以从 Event、Shader 和 Resource 映射到项目源码，并修改 Shader 或渲染代码进行验证。
15. 可以启动项目、再次 Capture 并比较实现或修复前后的结果。
16. 可以恢复 Feature 决策与调查历史，导出方案、资产规范、验收和调查报告。
17. 规则会考虑平台、帧预算、质量档位、引擎和项目上下文。
18. 有覆盖固定需求、项目源码、构建产物和 Capture 的评测样本，可持续衡量规划与诊断质量。
19. 可以将单次 Feature 开发与调查扩展为团队知识、回归和 CI 能力。

最终应形成两种核心体验：

> 用户描述一个希望实现的图形效果后，Vertex 能结合项目现状澄清需求，选择合适实现层级，产出跨管线、Shader、客户端和美术资产的方案，协助实现，并用视觉、性能与兼容性证据完成验收。

> 用户描述一个已有图形问题后，Vertex 能主动获得运行事实，定位 GPU 根因，找到责任源码，生成并验证修复，并用 Capture 前后证据说明修改是否有效。

---

# 8. 实施状态清单

> 最后更新：2026-07-30。该清单用于记录实际代码落地状态；完成项使用 `[x]`，未完成项使用 `[ ]`。路线图正文描述的是目标架构，本节描述当前仓库的真实进度。

## 8.1 Done：已完成

- [x] 完成现有 Graphics 消息协议、Provider Registry、Workflow、Webview 状态与市场能力集成点盘点。
- [x] 将 Graphics Workspace 修订为 Provider 无关的核心工作台，明确 RenderDoc 和 AssetStudio 均为可选能力。
- [x] 在路线图中记录配套市场仓库地址 `H:\Project\vertex-code-market` 及相对路径 `..\vertex-code-market`。
- [x] 增加 Workspace 分区、Capability 可用状态和 Runtime Provider 状态载荷等共享类型。
- [x] 实现 Graphics Workspace 第一阶段核心壳，包含 Feature Plan、Asset / Build 和 Runtime 三个分区。
- [x] 实现始终可用的 Feature Plan 首页，展示 Feature Planning、Project Source Analysis 和初始工作流。
- [x] 实现 Capability 降级界面；未安装 AssetStudio 或 Runtime Provider 时不会导致 Workspace 整体失败。
- [x] 实现 Runtime Provider 延迟查询；只有用户进入 Runtime 分区后才请求 Provider 状态。
- [x] 实现 Graphics Mode 默认导航：首次加载或从其他模式进入 Graphics Mode 时自动打开 Graphics Workspace；离开 Graphics Mode 时，如果仍停留在 Workspace，则返回 Chat。
- [x] 支持用户从 Workspace 主动返回 Chat，并在 Graphics Mode 的 Chat 页面保留重新打开 Workspace 的入口。
- [x] 保持 Chat View 在 Workspace 打开期间继续挂载，避免丢失输入和会话 UI 状态。
- [x] 补充 Workspace 组件测试和 App 集成测试，覆盖默认 Feature 首页、Runtime 延迟查询、无 Provider 降级、入口可见性和返回 Chat。
- [x] 完成第一阶段验证：Webview 与共享类型 TypeScript 检查通过，针对性测试共 16 项全部通过，Git 差异空白检查通过。
- [x] 定义共享的 Graphics Feature Brief 模型，覆盖视觉目标、生命周期、客户端联动、美术控制、目标平台、性能预算、兼容性和验收标准。
- [x] 将 Feature Plan 首页升级为可编辑表单，并通过 VS Code Webview State 保存草稿；保存时合并而非覆盖其他 Webview 状态。
- [x] 补充 Feature Brief 编辑、保存和重新挂载恢复测试；Graphics Workspace 与 App 针对性测试共 18 项通过。
- [x] 增加 Feature Brief Webview ↔ Extension 类型化请求、保存和响应协议，并通过 Extension `workspaceState` 实现工作区级持久化。
- [x] 实现工作区数据优先、本地 Webview State 快速恢复与旧版时间戳草稿自动迁移；保存时同步本地 fallback 和 Extension Host。
- [x] 补充 Extension Handler 读取、空响应、保存和无效消息测试，以及 Webview 工作区同步与本地迁移测试。
- [x] 实现第一阶段 Graphics Project Profile：自动识别 Unity/Unreal/自研图形项目、引擎版本、渲染管线、Shader 语言、目标平台、Graphics API 和 Renderer Feature/Custom Pass/Render Graph/后处理等架构信号。
- [x] 在 Feature Plan 中增加 Project Profile 加载、证据、警告和手动刷新界面，并通过类型化 Webview ↔ Extension 消息接入源码扫描。
- [x] 实现 Graphics Architecture Index 第一阶段深度索引，以结构化 `pipeline`、`pass`、`shader`、`client`、`asset` 和 `quality` Finding 记录源码路径、符号与具体事实。
- [x] 对 Unity 项目增加 Render Pipeline Asset GUID、Renderer Data、Renderer Feature、Scriptable Render Pass、Pass 注入点、Custom Pass、Render Graph、Shader Include/Keyword/LightMode、MonoBehaviour/ScriptableObject 生命周期、图形资产目录和质量配置识别。
- [x] 为深度索引增加 160 个相关文件、单文件 512 KiB 的扫描边界、优先目录排序、截断警告、Profile Evidence 合并及 Feature Plan 分类展示。
- [x] 将深度索引规则拆分为 Pipeline、Pass、Shader、Client 和 Project Configuration 五个纯领域 Analyzer，并通过稳定接口和默认 Composition Root 组合，避免单文件持续堆叠规则。
- [x] 将 Architecture Index 收敛为文件选择、读取、边界控制、Analyzer 编排和 Finding 去重的应用层编排器，并支持 Analyzer、最大文件数和单文件大小注入。
- [x] 将 Project Profile 展示从 Workspace 状态容器提取为独立展示组件，Refresh 行为和 Finding 展示上限通过 Props 注入。
- [x] 补充 Analyzer 注入/扫描边界契约测试和 Profile Card 独立组件测试；共享类型、Extension、Webview 三套类型检查通过，目标回归共 32 项测试通过。
- [x] 实现第一阶段 Graphics Solution Selector，以纯函数规则比较参数/资产配置、单 Shader、Renderer Pass、后处理、Render Graph、Compute 和 CPU/客户端七种实现层级。
- [x] Solution Selector 综合 Feature Brief 关键词与 Architecture Index 项目证据，输出稳定候选分数、置信度、推荐理由、风险、未选原因和缺失输入假设。
- [x] 增加类型化 Recommendation 请求/响应协议、Extension 编排和独立 Recommendation Card；编辑 Brief 后自动使旧建议失效，避免展示过期决策。
- [x] 补充 Selector 纯函数、消息契约和 Workspace 集成测试；共享类型、Extension、Webview 三套类型检查通过，本轮目标回归共 33 项测试通过。
- [x] 定义版本化 `GraphicsFeaturePlan` 契约，结构化覆盖项目现状、方案决策、管线、Shader、客户端生命周期、Asset Contract、性能预算、兼容性、风险、任务和多维验收。
- [x] 实现纯领域 `GraphicsFeaturePlanner`，组合 Feature Brief、Project Profile 和 Solution Recommendation，生成确定性的跨模块计划与 T1-T7 依赖有序任务。
- [x] 每个计划任务包含 ID、类型、Owner、输入、输出、依赖和可判定完成条件；高风险 Renderer Pass、Render Graph 和 Compute 方案带显式评审门禁与降级策略。
- [x] 增加类型化 Feature Plan 请求/响应、Extension 编排和独立 `GraphicsFeaturePlanView`；Workspace 可在 Recommendation 后按需生成计划，编辑 Brief 会使旧计划失效。
- [x] 修复 Solution Selector 中文关键词受 ASCII `\\b` 边界影响的问题，并增加纯中文 Compute 需求回归样本。
- [x] 补充 Planner、消息协议和 Workspace 集成测试；共享类型、Extension、Webview 三套类型检查通过，本轮目标回归共 39 项测试通过。
- [x] 为 Feature Plan 任务增加 `pending`、`in-progress`、`blocked`、`completed`、`skipped` 状态、状态备注和更新时间字段，并在 Webview 中提供任务状态选择器。
- [x] 通过 Extension `workspaceState` 持久化任务状态更新；成功更新时递增 `revision` 并标记来源为 `workspace`。
- [x] 增加基于 `revision` 的乐观并发控制；过期更新不会写入，并返回当前计划和冲突消息。
- [x] 补充 Planner、Handler 和 Webview 任务状态回归测试；Webview 目标测试最终 10 项全部通过。
- [x] 为 Feature Plan 任务提供状态备注编辑器；备注与状态使用同一份 Webview 草稿状态，并通过 `workspaceState` 持久化。
- [x] 支持 Feature Plan 任务标题和完成条件的人工编辑；编辑通过 revision 乐观并发控制写入 `workspaceState`，并将计划来源标记为 `manual`。
- [x] 增加独立 Feature Plan 恢复消息；Workspace 挂载时读取已持久化计划，不再通过恢复流程重新生成计划。
- [x] 增加恢复 Handler 和 Webview 回归覆盖，验证恢复只读取 `workspaceState` 并广播当前 revision。

## 8.2 TODO：未完成

### Graphics Workspace 与 Feature 开发主链路

- [ ] 将当前 `workspaceState` Feature Brief 进一步升级为项目文件持久化和团队共享，并设计多窗口冲突与版本合并策略。
- [ ] 继续扩展 Graphics Architecture Index：解析 GUID 到实际 Render Pipeline/Renderer Data 资产的引用图、完整 Pass/Shader 符号、Importer 与命名规范、质量档位具体参数、资源加载/对象池/相机入口，并实现可复用相似 Feature 排名。
- [ ] 将第一阶段规则式技术选型器升级为可配置规则包，引入市场 Knowledge/Skill/Provider 可用性、资源需求推导、成本预算、架构门禁和固定样本 Golden Test；支持人工覆盖并记录决策历史。
- [ ] 在现有跨模块任务拆解基础上增加计划正文其他区块的人工编辑/覆盖、增量重生成、角色指派和实际 Agent 执行编排；当前已支持任务标题、完成条件和状态人工更新。
- [ ] 实现 Feature Plan、架构决策、Asset Contract、性能预算、兼容矩阵和验证报告的持久化与恢复。
- [ ] 将 Workspace 文案接入项目国际化资源，替换当前硬编码英文文本。
- [ ] 增加 Workspace 的可访问性、键盘导航、响应式布局和真实 Webview 视觉回归测试。

### Marketplace、Knowledge 与 Capability

- [ ] 建立 Marketplace Capability Registry，统一描述 Knowledge、Skill、MCP 和 Provider 的能力、依赖、版本与健康状态。
- [ ] 显式发布并校验市场仓库中的正式 Graphics、Unity、RenderDoc Skills 和 AssetStudio MCP。
- [ ] 建立 Knowledge Registry，合并内置、全局和项目级 Knowledge 索引，使市场安装的 Knowledge 能参与运行时路由与上下文注入。
- [ ] 建立 Skill 到 MCP/Provider 的工具契约测试，防止 Skill 引用不存在或不兼容的工具。
- [ ] 实现 Capability 驱动的 Quick Actions，只展示当前环境中实际可执行的操作。

### Asset / Build 能力

- [ ] 实现 AssetStudio Graphics Asset Provider、健康检查和结构化状态协议。
- [ ] 将 Asset / Build 分区接入真实 Provider 状态，替换当前固定的 unavailable 占位状态。
- [ ] 实现 Texture、Mesh、Material、Renderer、Memory、Dependency 和重复资产审计。
- [ ] 建立源项目资产身份、构建产物身份和 AssetStudio 结果之间的映射。
- [ ] 实现 Asset Contract 自动校验和构建产物报告。

### Runtime Capture 与诊断

- [ ] 实现 Runtime 面板的 Provider 选择、Capture 状态、Frame Overview、Selected Event Inspector、Pipeline、Shader 和 Resource UI。
- [ ] 将现有 Graphics Workflow 和 Playbook 以结构化结果接入 Workspace。
- [ ] 实现 Frame Performance、Shader Analysis、Pipeline Analysis、Resource Trace 和 Capture Compare。
- [ ] 实现从 Capture Event、Shader 和 Resource 到项目源码的可靠映射。
- [ ] 实现 Launch Profile、Launch and Capture、Re-Capture Validation 和前后证据比较。
- [ ] 增加取消、超时、缓存失效、错误恢复和调查会话持久化。

### 工程质量与平台化

- [ ] 修复 Webview ESLint 9 配置，使完整 Webview Lint 可以在本地和 CI 中执行。
- [ ] 使用项目要求的 Node.js 20.20.2 运行完整构建、测试、Lint 和 VSIX 验证。
- [ ] 建立 Graphics Provider Contract Test、Workflow Unit Test、Webview Integration Test 和固定样本 Golden Test。
- [ ] 建立 Graphics Benchmark Corpus，持续衡量规划质量、证据正确率、源码映射和诊断命中率。
- [ ] 后续实现 Regression、CI/PR、多 Provider、团队报告中心、项目知识图谱和高级自动修复能力。
