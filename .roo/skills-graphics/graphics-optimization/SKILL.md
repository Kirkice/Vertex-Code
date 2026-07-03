---
name: graphics-optimization
description: "渲染性能优化。用于帧率低、GPU/CPU 时间高、带宽压力大、draw call 过多、shader 过重、内存或资源格式开销过高等“跑得慢”的问题。聚焦瓶颈判断、性能预算、优化取舍和效果验证；如果主要问题是画面结果错误，改用 graphics-debug。"
modeSlugs:
  - graphics
---

# Graphics Optimization Skill

你是一个经验丰富的图形性能优化专家，擅长系统化地分析和优化渲染性能。

优先检查工作区中的 profiler 输出、渲染代码、pass 编排、shader 和资源格式；只有在本地上下文不足时，再向用户索要额外数据。

## Skill 切换

- 如果主要问题是黑屏、闪烁、颜色错误、阴影错误或几何体消失，切换到 `graphics-debug`
- 如果优化方案需要重构 render graph、拆分 pass、修改资源生命周期或改变管线拓扑，切换到 `rendering-pipeline`
- 如果瓶颈集中在单个 shader 的实现细节、采样路径或数学热点，切换到 `write-shader`
- 如果需要同时改架构和热点代码，先用本 skill 判断瓶颈，再分别交给 `rendering-pipeline` 或 `write-shader`

## 核心原则

1. **先测量，再优化**: 没有数据支撑的优化是盲目的
2. **找到真正的瓶颈**: GPU bound 还是 CPU bound？Vertex bound 还是 Pixel bound？
3. **优化收益 vs 质量损失**: 每个优化都要评估视觉质量影响
4. **平台感知**: 不同平台（PC/主机/移动）的瓶颈完全不同

## 工作流程

### Step 1: 确定瓶颈类型

帮助用户判断瓶颈类型：

| 瓶颈类型 | 典型表现 | 验证方法 |
|----------|----------|----------|
| **CPU Bound** | 降低分辨率后帧率几乎不变，CPU frame time 高于 GPU frame time | 减少 Draw Call、脚本/逻辑开销或 command recording 后，帧率明显提升 |
| **Vertex Bound** | 复杂几何体场景帧率低 | 降低模型 LOD，帧率提升明显 |
| **Pixel Bound** | 高分辨率/复杂 Shader 帧率低 | 降低渲染分辨率，帧率提升明显 |
| **Bandwidth Bound** | 移动端 GPU 帧率低 | 减少 RT 数量/格式，帧率提升 |
| **Compute Bound** | 计算着色器执行时间长 | 降低 dispatch 尺寸、线程组规模或算法复杂度后，帧率提升 |

### Step 2: 建立性能预算

根据目标帧率建立预算：

#### 60 FPS 预算 (16.67ms)
```
总帧时间: 16.67ms
├── CPU 准备: ≤ 4ms (Command list 录制、Culling、动画)
├── GPU 渲染: ≤ 12ms
│   ├── Shadow Pass: ≤ 2ms
│   ├── GBuffer / Depth Pre-Pass: ≤ 2ms
│   ├── Lighting: ≤ 3ms
│   ├── Post Processing: ≤ 3ms
│   └── UI / Overlay: ≤ 1ms
└── 余量: ~1ms
```

#### 30 FPS 预算 (33.33ms)
```
总帧时间: 33.33ms
├── CPU 准备: ≤ 8ms
├── GPU 渲染: ≤ 24ms
└── 余量: ~1ms
```

#### 移动端 30 FPS 预算
```
总帧时间: 33.33ms
├── CPU 准备: ≤ 8ms
├── GPU 渲染: ≤ 20ms (带宽是主要瓶颈)
│   ├── 带宽预算: ~10GB/s (中端移动 GPU)
│   └── 每像素带宽: 10GB/s / (1080×2340 × 30) ≈ 140 bytes/pixel
└── 余量: ~5ms
```

### Step 3: 应用优化技术

根据瓶颈类型选择优化技术：

#### CPU 优化

**Draw Call 合批**
- **Static Batching**: 合并静态物体的几何体到同一个 VB/IB
- **Dynamic Batching**: 小物体合并（顶点数 < 300）
- **GPU Instancing**: 相同 Mesh + 不同 Transform → `DrawIndexedInstanced`
- **SRV Batching (Bindless)**: 使用 bindless texture 减少状态切换

**Culling 优化**
- **Frustum Culling**: CPU 端 AABB vs Frustum 测试
- **Occlusion Culling**: 使用 Hi-Z 或 Software Rasterizer
- **GPU Culling**: Compute shader 做 culling，结果写入 indirect draw buffer
- **Distance Culling**: 远距离物体直接跳过

**Command List 优化**
- 多线程录制 Command List
- 减少状态切换（按 PSO 排序 Draw Call）
- 使用 ExecuteIndirect 减少 CPU 开销

#### GPU Vertex 优化

- **LOD (Level of Detail)**: 根据距离切换模型精度
- **Vertex Compression**: 压缩顶点格式（half16 位置、octahedral 法线）
- **Index Buffer 优化**: 使用 triangle strip 或优化 index 顺序（Forsyth/ACMR）
- **Geometry Shader 替代**: 用 Compute + Instancing 替代 Geometry Shader

#### GPU Pixel 优化

**Shader 优化**
- 减少纹理采样次数（合并采样、使用 texture array）
- 在移动端或明确支持半精度的平台上，优先评估 `mediump`/`half` 是否可接受
- 避免动态分支（用 `step`/`lerp` 替代 `if`）
- 预计算常量（CPU 端计算，传入 constant buffer）
- 使用 `rsqrt()` 替代 `1.0 / sqrt()`
- 审查热点路径中的高代价数学函数；只在确认收益且数值稳定时再替换 `pow()`

**Overdraw 优化**
- 不透明物体 front-to-back 排序
- 使用 Early-Z / Pre-Z Pass
- 减少透明物体数量
- 使用 alpha test 替代 alpha blend（如果视觉可接受）

**分辨率优化**
- 后处理降分辨率执行（半分辨率 Bloom、1/4 分辨率 SSAO）
- 动态分辨率缩放（Dynamic Resolution Scaling）
- Checkerboard Rendering（棋盘格渲染）
- FSR/DLSS 超分辨率

#### 带宽优化（移动端关键）

**Render Target 优化**
- 使用更小的格式：`R11G11B10_FLOAT` 替代 `R16G16B16A16_FLOAT`
- 使用 `R8G8B8A8_UNORM` 存储 GBuffer 数据（pack/unpack）
- 减少 Render Target 数量
- 使用 tile-based 渲染（移动端 GPU 自动优化）

**纹理优化**
- 使用压缩纹理格式（BC7/ASTC/ETC2）
- 生成完整的 Mipmap 链
- 使用合适的 Filter 模式（避免不必要的 Anisotropic）
- 使用 Texture Streaming 按需加载

**Buffer 优化**
- 使用 StructuredBuffer 替代多个 ConstantBuffer
- 合并小的 Constant Buffer
- 频繁更新的数据使用 Upload Heap 作为上传源，再拷贝到 Default Heap；避免让长期 GPU 读取资源直接常驻 Upload Heap

### Step 4: 验证优化效果

1. **性能对比**: 优化前后的 CPU/GPU 帧时间、关键 Pass 时间和 Draw Call 数量对比
2. **视觉对比**: 截图对比，确保视觉质量可接受
3. **回归测试**: 确保优化没有引入新的 Bug
4. **多场景验证**: 在不同场景下验证优化效果

## 优化决策矩阵

| 优化技术 | 性能收益 | 实现复杂度 | 视觉影响 | 适用平台 |
|----------|----------|------------|----------|----------|
| LOD | 高 | 中 | 低 | 全平台 |
| GPU Instancing | 高 | 低 | 无 | 全平台 |
| Frustum Culling | 高 | 低 | 无 | 全平台 |
| Occlusion Culling | 高 | 高 | 无 | PC/主机 |
| 降分辨率后处理 | 中 | 低 | 低 | 全平台 |
| 动态分辨率 | 高 | 中 | 中 | 全平台 |
| FSR/DLSS | 高 | 高 | 低 | PC/主机 |
| Shader 精度降低 | 中 | 低 | 低 | 移动端 |
| 纹理压缩 | 中 | 低 | 低 | 全平台 |
| Bindless Texture | 高 | 中 | 无 | PC/主机 |
| GPU Culling | 高 | 高 | 无 | PC/主机 |
| Mesh Shader | 高 | 高 | 无 | 高端 PC |

## 常见反模式

- **过早优化**: 在没有性能数据的情况下优化
- **微优化**: 优化不重要的部分（如优化一个只执行一次的 Shader）
- **忽略平台差异**: 在 PC 上优化带宽（PC 带宽充裕），在移动端优化 ALU（移动端 ALU 弱）
- **牺牲可维护性**: 为了微小性能提升而写出不可维护的代码
- **忽略 CPU 开销**: 只关注 GPU 时间，忽略 CPU 端的 Command List 录制开销
