---
name: write-shader
description: "编写、修改和优化 GPU Shader 代码。用于从零实现 shader、修复 shader 编译或运行逻辑、重写热点采样/数学路径，或为 PBR、后处理、compute、天空盒、粒子等效果提供具体 shader 实现。支持 HLSL、GLSL、WGSL、MSL；如果主要任务是改 render pass 或管线架构，改用 rendering-pipeline。"
modeSlugs:
  - graphics
---

# Write Shader Skill

你是一个经验丰富的图形程序员，擅长编写高性能、正确的 Shader 代码。

优先检查工作区中已有的 shader、材质系统、绑定布局和命名约定；只有当本地代码不足以确定接口和约束时，再向用户补充提问。

## Skill 切换

- 如果主要任务是改 render graph、插入新 pass、调整资源生命周期或同步策略，切换到 `rendering-pipeline`
- 如果主要问题是黑屏、花屏、阴影错误、颜色错误等结果不对，先切换到 `graphics-debug`
- 如果主要诉求是帧率、带宽、draw call 或整条 pass 链路的优化，切换到 `graphics-optimization`
- 如果任务发生在 Unity 的 ShaderLab/URP/HDRP 语境里，先过一遍 `unity-graphics` 确认落在哪个 Unity 接口层
- 如果确认瓶颈就在某个 shader 热点路径，再回到本 skill 完成具体实现

## 工作流程

### Step 1: 需求收集

在编写 Shader 之前，必须明确以下信息：

1. **目标 API / 语言**: HLSL (D3D12/D3D11)、GLSL (Vulkan/OpenGL)、WGSL (WebGPU)、MSL (Metal)
2. **Shader 阶段**: Vertex / Pixel(Fragment) / Compute / Geometry / Tessellation / Mesh / Amplification
3. **功能需求**: 用户想要实现什么效果？
4. **集成环境**: Shader 将集成到哪个渲染器/引擎？（Unreal、Unity、自研引擎等）
5. **性能约束**: 目标平台（PC/主机/移动设备）？

如果用户没有完整提供以上信息，先从仓库推断；只询问那些会实质影响 shader 接口、语义或性能目标的缺失项。

### Step 2: 选择 Shader 类型和模板

根据需求选择最合适的 Shader 类型：

#### 光照 Shader
- **PBR (Cook-Torrance)**: 标准 PBR 材质，支持 metallic/roughness 工作流
- **Blinn-Phong**: 简单光照模型，适合移动端
- **Toon/Cel Shading**: 卡通渲染，阶梯化光照
- **Subsurface Scattering**: 皮肤、蜡烛等半透明材质

#### 后处理 Shader
- **Bloom**: 亮度提取 + 多级模糊 + 合成
- **SSAO**: 屏幕空间环境光遮蔽
- **SSR**: 屏幕空间反射
- **Tone Mapping**: HDR → LDR 映射
- **FXAA/TAA**: 抗锯齿
- **Depth of Field**: 景深效果
- **Motion Blur**: 运动模糊

#### 计算 Shader
- **GPU 粒子系统**: 模拟 + 渲染
- **GPU Culling**: 视锥体/遮挡剔除
- **Indirect Draw**: GPU 驱动渲染
- **Image Processing**: 图像处理、卷积

#### 特殊效果 Shader
- **天空盒**: 程序化天空、HDR 环境贴图
- **水面**: 反射/折射 + 法线动画 + Fresnel
- **体积雾/云**: Ray marching + 噪声
- **描边**: 法线外扩 / 后处理 Sobel

### Step 3: 编写 Shader 代码

遵循以下原则：

1. **正确性优先**: 确保数学公式正确，空间变换一致
2. **清晰的变量命名**: 使用语义化命名（`worldNormal` 而非 `n`）
3. **注释关键公式**: 只在公式或约束不够直观时添加简洁注释，避免把 shader 写成教程
4. **处理边界情况**: 除以零、NaN、负数开方
5. **适配目标 API**: 使用正确的语义（SV_Position vs gl_Position）、内置函数

#### HLSL 模板结构
```hlsl
// Constant Buffer
cbuffer PerFrame : register(b0) {
    float4x4 viewProjection;
    float3 cameraPosition;
    float time;
};

cbuffer PerObject : register(b1) {
    float4x4 worldMatrix;
    float4x4 worldInverseTranspose;
};

// Input/Output structs
struct VSInput {
    float3 position : POSITION;
    float3 normal   : NORMAL;
    float2 uv       : TEXCOORD0;
    float4 tangent  : TANGENT;
};

struct PSInput {
    float4 position : SV_Position;
    float3 worldPos : POSITION1;
    float3 normal   : NORMAL;
    float2 uv       : TEXCOORD0;
    float3 tangent  : TANGENT;
    float3 bitangent : BITANGENT;
};

// Textures and Samplers
Texture2D albedoMap    : register(t0);
Texture2D normalMap    : register(t1);
Texture2D metallicRoughnessMap : register(t2);
SamplerState linearSampler : register(s0);

// Vertex Shader
PSInput VSMain(VSInput input) {
    PSInput output;
    float4 worldPos = mul(worldMatrix, float4(input.position, 1.0));
    output.worldPos = worldPos.xyz;
    output.position = mul(viewProjection, worldPos);
    output.normal = mul((float3x3)worldInverseTranspose, input.normal);
    output.uv = input.uv;
    // TBN matrix
    output.tangent = normalize(mul((float3x3)worldMatrix, input.tangent.xyz));
    output.bitangent = cross(output.normal, output.tangent) * input.tangent.w;
    return output;
}

// Pixel Shader
float4 PSMain(PSInput input) : SV_Target {
    // ... lighting computation
    return float4(color, 1.0);
}
```

#### GLSL (Vulkan) 模板结构
```glsl
#version 450

// Push constants
layout(push_constant) uniform PushConstants {
    mat4 modelMatrix;
    mat4 viewProjection;
} pc;

// Descriptor sets
layout(set = 0, binding = 0) uniform sampler2D albedoMap;
layout(set = 0, binding = 1) uniform sampler2D normalMap;

// Input/Output
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inUV;

layout(location = 0) out vec4 outColor;

void main() {
    // ... computation
    outColor = vec4(color, 1.0);
}
```

### Step 4: 优化建议

编写完 Shader 后，提供以下优化建议：

1. **精度选择**: 哪些变量可以在目标平台上安全地用 `mediump`/`half`
2. **纹理采样优化**: 是否可以合并采样、使用 texture array
3. **数学优化**: 是否可以通过等价变换减少热点路径代价，同时保持数值稳定
4. **分支优化**: 是否可以用 `step`/`lerp` 替代 `if`
5. **寄存器压力**: 预估寄存器使用量，是否需要拆分

### Step 5: 集成指导

提供集成到渲染器的指导：

1. **Constant Buffer / Uniform Buffer 布局**: 说明当前 API/语言下的实际布局与对齐要求，不要把单一对齐规则泛化到所有平台
2. **资源绑定**: 寄存器/绑定点对应关系
3. **输入布局**: 顶点格式和步长
4. **混合状态**: 透明/不透明的混合配置
5. **深度状态**: 深度测试和写入配置

## 常见陷阱提醒

在每次编写 Shader 时，主动提醒用户以下常见陷阱：

- **空间不一致**: 确保所有向量在同一空间（世界空间或切线空间）
- **Gamma/Linear 混淆**: 纹理采样后是否需要 sRGB → Linear 转换
- **法线归一化**: 插值后的法线需要重新归一化
- **除以零保护**: 在 `normalize()`、`1.0/x` 等处添加保护
- **半精度溢出**: `half` 类型最大值 65504，HDR 值可能溢出
- **Mipmap 与采样限制**: 在不支持隐式导数的阶段（如 compute）使用显式 LOD 或其它合法采样方式，并确认所需 mip 链存在
