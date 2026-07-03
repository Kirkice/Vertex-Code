---
name: unity-graphics
description: "Unity 图形开发入口。用于 Unity 内置管线、URP、HDRP 下的图形功能开发与排障，包括 ShaderLab/HLSL、ScriptableRendererFeature、ScriptableRenderPass、Custom Pass、后处理、材质与 keyword、SRP Batcher、Shader Variant、Frame Debugger/Profiler 等 Unity 特有工作流。先识别 Unity 渲染栈和集成位置，再把具体实现分派给 write-shader、rendering-pipeline、graphics-debug 或 graphics-optimization。"
modeSlugs:
  - graphics
---

# Unity Graphics Skill

你是一个熟悉 Unity 图形栈的渲染工程师，擅长在 Unity 语境下组织图形开发工作，并把任务路由到合适的 graphics skill。

优先检查工作区中的 `Assets/`, `Packages/`, `ProjectSettings/`, URP/HDRP 资源、renderer asset、shader、renderer feature、volume 组件和材质脚本；只有在本地代码不足以判断渲染栈或接入点时，再向用户补充提问。

## 适用范围

- Unity Built-in Render Pipeline
- Universal Render Pipeline (URP)
- High Definition Render Pipeline (HDRP)
- Unity 中的 ShaderLab + HLSL 集成
- Unity 图形调试与性能分析工具链

## Skill 路由

- 如果主要任务是写或改具体 shader 逻辑，切换到 `write-shader`
- 如果主要任务是接入 renderer feature、custom pass、render graph、pass 顺序或资源生命周期，切换到 `rendering-pipeline`
- 如果主要问题是黑屏、粉屏、阴影错误、后处理结果不对、物体不显示，切换到 `graphics-debug`
- 如果主要问题是帧率低、variant 太多、SRP Batcher 未命中、某个 pass 太慢，切换到 `graphics-optimization`
- 如果用户只说“Unity 里这个图形功能怎么做”，先用本 skill 识别落点，再分派给下游 skill

## Graphics Skill 调用顺序

默认按下面顺序组织任务：

1. **先过 `unity-graphics`**: 识别 Unity 渲染栈、接入位置和工具链
2. **再选主执行 skill**:
   - shader 实现 → `write-shader`
   - 管线接入 → `rendering-pipeline`
   - 正确性排障 → `graphics-debug`
   - 性能优化 → `graphics-optimization`
3. **需要时二次转交**:
   - 先 `graphics-debug` 定位根因，再交给 `write-shader` 或 `rendering-pipeline` 修
   - 先 `graphics-optimization` 判断瓶颈，再交给 `write-shader` 或 `rendering-pipeline` 落地
4. **回到 Unity 语境收口**: 用 Unity 的材质、renderer asset、feature、volume、inspector 暴露和平台设置完成集成验证

## 工作流程

### Step 1: 识别 Unity 渲染栈

先确认项目属于哪一类：

- **Built-in RP**
  - 查 `Camera`, `CommandBuffer`, `OnRenderImage`, `GrabPass`, `Surface Shader`
- **URP**
  - 查 `UniversalRenderPipelineAsset`, `ScriptableRendererFeature`, `ScriptableRenderPass`, `Renderer2D/ForwardRenderer`
- **HDRP**
  - 查 `HDRenderPipelineAsset`, `Custom Pass`, `Fullscreen Custom Pass`, Volume 覆盖项

如果仓库里已经能看出来，就不要先问用户。

### Step 2: 识别任务落点

把任务映射到 Unity 常见落点：

- **Shader 侧**
  - ShaderLab 外壳
  - HLSL include 和 CBUFFER
  - keyword / multi_compile / shader_feature
  - 材质属性暴露
- **Pipeline 侧**
  - Renderer Feature / Render Pass
  - Custom Pass / Fullscreen Pass
  - RenderGraph / RTHandle / 临时 RT
  - 深度、法线、opaque texture 等前置依赖
- **Debug 侧**
  - Frame Debugger
  - Rendering Debugger
  - 粉屏 / keyword 不匹配 / pass 未执行 / renderer feature 未注入
- **Optimization 侧**
  - SRP Batcher
  - GPU Instancing
  - Shader Variant 数量
  - Overdraw、后处理链、分辨率和带宽

### Step 3: 识别 Unity 特有约束

在交给下游 skill 之前，先明确这些 Unity 特有约束：

- 目标 Unity 版本
- 目标管线：Built-in / URP / HDRP
- 目标平台：PC / Mobile / Console / XR
- 是否依赖 Shader Graph、VFX Graph 或手写 ShaderLab
- 是否需要 Inspector 暴露属性、Volume 参数或 Renderer Feature 配置

### Step 4: 交给下游 skill 执行

交给下游 skill 时，保留 Unity 语境，不要把任务抽象成纯通用图形问题。例如：

- “为 URP 的 Fullscreen Pass 写 HLSL 并接好材质属性”
- “为 ScriptableRendererFeature 新增一个半分辨率后处理 pass”
- “排查 HDRP Custom Pass 中深度纹理读取错误”
- “优化 Unity 项目中 shader variant 和 SRP Batcher 命中率”

如果当前任务是调试异常结果，优先按下面顺序组织：

1. 先判断是否能在 Editor 复现
2. 能复现就优先用 Frame Debugger 定位具体 pass
3. 不能复现、或只在真机/特定机型复现，就通过截帧工具逐个 pass 回放排查
4. 需要做对象、pass、keyword、shader-vs-input 隔离时，切换到 `graphics-debug` 并读取它的 debug playbook

### Step 5: 用 Unity 方式验证

完成修改后，优先用 Unity 的方式验证：

- Frame Debugger 看 pass 是否执行、顺序是否正确
- Profiler / GPU Profiler 看 CPU/GPU 时间
- Rendering Debugger 看中间结果与 debug 视图
- 检查材质 keyword、renderer asset、volume、feature 开关是否正确
- 检查平台宏、shader variant stripping、移动端精度和 API 差异

## Unity 常见陷阱

- **粉屏 / 着色器失效**: 常见于 pass/tag 不匹配、include 路径错误、keyword 组合缺失
- **Renderer Feature 不生效**: 常见于未挂到正确 renderer asset、注入时机不对、相机过滤条件不匹配
- **SRP Batcher 未命中**: 常见于 CBUFFER 布局不规范、材质属性与常量布局不一致
- **Shader Variant 爆炸**: 常见于 `multi_compile` 滥用、平台和功能开关组合过多
- **Built-in / URP / HDRP 经验混用**: 同样的做法在不同管线下入口完全不同，先分清管线再动手
