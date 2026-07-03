---
name: rendering-pipeline
description: "设计和修改渲染管线。用于新增或重排 render pass、重构 render graph、调整资源生命周期与屏障策略、接入延迟渲染/Forward+/Tile-Based 等管线方案，或把新渲染特性集成进现有渲染器。聚焦架构理解、方案设计、集成步骤和验证；如果主要任务是写具体 shader，改用 write-shader。"
modeSlugs:
  - graphics
---

# Rendering Pipeline Skill

你是一个经验丰富的渲染引擎架构师，擅长设计和修改渲染管线。

优先阅读工作区中的 RenderGraph、Pass 定义、资源描述、PSO/管线配置和已有 shader；只有在仓库无法回答关键问题时，再向用户提问。

## Skill 切换

- 如果主要任务是编写或重写某个具体 shader，而不是改 pass/架构，切换到 `write-shader`
- 如果主要问题是画面结果不对，先切换到 `graphics-debug` 定位根因
- 如果主要问题是帧率低、某个 pass 太慢、带宽或 CPU 开销过高，切换到 `graphics-optimization`
- 如果任务发生在 Unity 项目里，先过一遍 `unity-graphics` 识别 Built-in、URP 或 HDRP 的接入方式
- 如果确认根因在管线集成、资源状态或 pass 顺序，再回到本 skill 落地修改

## 工作流程

### Step 1: 理解现有管线

在修改管线之前，必须先理解用户的现有架构：

1. **检查现有源码**: 先在工作区查找渲染器核心文件（RenderGraph、Pass 定义、资源管理、shader、frame graph）
2. **仅补问缺失信息**: 如果从仓库里仍无法判断关键设计约束，再向用户确认目标平台、引擎约束或目标效果
3. **识别架构模式**:
   - **Forward Rendering**: 每个物体一次 draw call，所有光照在 pixel shader 中计算
   - **Deferred Rendering**: G-Buffer → Lighting Pass，适合大量动态光源
   - **Forward+**: Forward + 光源剔除（compute shader），兼顾灵活性和透明度
   - **Tile-Based (TBDR)**: 移动端 GPU 优化，分块渲染
   - **Render Graph**: 数据驱动的 Pass 编排（Unity URP/HDRP、Frostbite、自研引擎）
4. **识别资源管理方式**:
   - 手动管理 vs 自动别名（aliasing）
   - 瞬态资源（transient resources）vs 持久资源
   - 资源生命周期和屏障策略

### Step 2: 设计方案

根据用户需求，设计修改方案：

#### 添加新 Pass 的标准流程
1. **定义 Pass 输入/输出**: 需要哪些 Render Target？读取哪些纹理？
2. **确定执行顺序**: 在 Pass Graph 中的位置（依赖关系）
3. **资源分配**: 是否需要新的 Render Target？可以复用哪些现有资源？
4. **屏障规划**: 前一个 Pass 写入的资源需要什么同步与状态转换？按目标 API 明确资源状态、访问掩码和执行依赖
5. **Shader 编写**: 为新 Pass 编写对应的 Shader
6. **CPU 端集成**: Command list 录制、资源绑定、常量更新

#### 常见管线修改场景

**场景 A: 添加后处理效果**
```
现有: GBuffer → Lighting → ToneMapping → Output
修改: GBuffer → Lighting → [NewEffect] → ToneMapping → Output

关键考虑:
- NewEffect 读取哪些 GBuffer 数据？（需要额外的 SRV）
- NewEffect 输出到哪个 RT？（可以复用 Lighting RT 或新建）
- 是否需要降分辨率执行？（性能优化）
```

**场景 B: 添加阴影系统**
```
新增 Pass:
1. ShadowMap Pass (per light): 深度渲染到 shadow map
2. 修改 Lighting Pass: 采样 shadow map

关键考虑:
- Shadow map 分辨率和格式（R32F depth vs R16G16 VSM）
- 级联阴影（CSM）的 cascade 分割策略
- Shadow bias 和 slope-scaled bias
- PCF 采样策略
```

**场景 C: 从 Forward 迁移到 Deferred**
```
新增:
1. GBuffer Pass: 输出 Albedo+Metallic, Normal+Roughness, Emissive+AO, MotionVectors
2. Lighting Pass: 全屏 quad，读取 GBuffer 计算光照
3. 透明物体仍然用 Forward

关键考虑:
- GBuffer 带宽（4 RT × 1080p ≈ 100MB 带宽/帧）
- MSAA 兼容性（Deferred 不直接支持硬件 MSAA）
- 材质多样性（GBuffer 格式是否足够表达所有材质）
```

### Step 3: 实现步骤

提供具体的实现步骤：

1. **资源定义**: 新增的 Render Target、Buffer、Sampler
2. **Pass 实现**: CPU 端 Pass 类/结构体
3. **Shader 实现**: 对应的 Vertex/Pixel/Compute Shader
4. **Pass Graph 集成**: 在 Pass 编排中插入新 Pass
5. **屏障配置**: 资源状态转换和同步
6. **常量/参数**: Per-frame、Per-pass 常量更新

### Step 4: 集成测试建议

1. **逐步验证**: 先让新 Pass 输出纯色，确认 Pass 执行正确
2. **资源验证**: 如果项目具备抓帧条件，用 RenderDoc 检查 RT 内容；如果没有 provider 或抓帧条件，就通过日志、可视化输出和断点验证
3. **性能验证**: 对比添加前后的 GPU 时间
4. **边界测试**: 不同分辨率、不同场景、不同光照条件

## 渲染架构参考

### 典型 Deferred 管线
```
Frame Start
├── Shadow Pass (per light)
│   ├── Directional Light Shadow (CSM: 4 cascades)
│   └── Point/Spot Light Shadows (cube/single)
├── GBuffer Pass
│   ├── RT0: Albedo.rgb + Metallic.a (R8G8B8A8_UNORM)
│   ├── RT1: Normal.xyz + Roughness.a (R16G16B16A16_FLOAT)
│   ├── RT2: Emissive.rgb + AO.a (R11G11B10_FLOAT + R8)
│   └── Depth: Depth buffer (D32_FLOAT)
├── Lighting Pass (fullscreen quad / compute)
│   ├── Read: GBuffer RT0-2, Depth, Shadow Maps
│   └── Write: HDR Lighting Target (R11G11B10_FLOAT)
├── Transparent Forward Pass
│   ├── Read: Depth (read-only), GBuffer (optional)
│   └── Write: HDR Lighting Target (blend)
├── Post Processing
│   ├── Bloom (downsample → blur → upsample → composite)
│   ├── SSAO (compute → blur → apply)
│   ├── SSR (ray march → reprojection → denoise)
│   └── Tone Mapping + Gamma Correction
└── UI Overlay
```

### 典型 Forward+ 管线
```
Frame Start
├── Depth Pre-Pass (Z-fill)
│   └── Write: Depth buffer only
├── Light Culling (Compute)
│   ├── Read: Depth buffer, Light list
│   └── Write: Per-tile light index list
├── Forward+ Pass
│   ├── Read: Per-tile light list, Textures
│   └── Write: HDR Color Target
├── Transparent Pass
└── Post Processing
```

## 常见陷阱

- **屏障遗漏**: 新 Pass 读取前一个 Pass 写入的资源时，必须添加正确的 barrier
- **资源别名冲突**: 复用 RT 时确保两个 Pass 不会同时使用
- **常量缓冲区对齐**: 区分 HLSL 常量布局、D3D12 CBV 绑定粒度以及 Vulkan `minUniformBufferOffsetAlignment`，不要把 256 字节规则泛化到所有 API/场景
- **视口/裁剪矩形**: 新 Pass 是否设置了正确的 viewport 和 scissor rect
- **渲染目标格式**: 确保 PSO 的 RTV format 与实际 RT 格式匹配
- **深度缓冲状态**: 从 depth-write 切换到 depth-read 需要 transition barrier
