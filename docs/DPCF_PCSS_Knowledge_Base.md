# DPCF 与 PCSS 阴影方案知识库

## 1. 目标与背景

本文档整理项目内 [`DPCF`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:335) 与 [`PCSS`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:415) 的实现现状、参数链路、排查过程中遇到的问题、分析结论、已尝试方案与后续建议，用于团队内部沉淀和后续迭代参考。

核心入口在 [`MainLightRealtimeShadow()`](Shaders/ShaderLibrary/Pipeline/Shadow.hlsl:434)。

---

## 2. 当前阴影模式总览

在 [`MainLightRealtimeShadow()`](Shaders/ShaderLibrary/Pipeline/Shadow.hlsl:434) 中，主光阴影根据 keyword 分成三条路径：

1. [`_MAIN_LIGHT_SHADOWS_PCSS`](Shaders/ShaderLibrary/Pipeline/Shadow.hlsl:441)
   - 走旧版 [`SampleMainLightPCSS()`](Shaders/ShaderLibrary/Pipeline/PCSS.hlsl:134)
2. [`_PBRV2_SHADOWS_SOFT`](Shaders/ShaderLibrary/Pipeline/Shadow.hlsl:443)
   - 走新版 [`SampleShadow_PCSS()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:531)
   - 其中再由 [`_PBRV2_SHADOWS_PCSS`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:516) 区分 DPCF / PCSS
3. 默认 PCF
   - 走 [`SampleShadowmapFiltered()`](Shaders/ShaderLibrary/Pipeline/Shadow.hlsl:299)

### 2.1 当前项目重点路径

当前讨论的主要是新版 [`URPCSS.hlsl`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:1) 中的：

- 平行光 DPCF
- 平行光 PCSS
- 聚光灯 DPCF / PCSS

其中平行光入口是 [`SampleShadow_PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:467)，聚光灯入口是 [`SampleShadow_PCSS()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:531) 中的 perspective 分支。

---

## 3. CPU 参数链路

### 3.1 面板参数

运行时参数定义在 [`ShadowController`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:25) 中，关键字段包括：

- [`pcssSoftness`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:26)
- [`pcssBlockerSampleCount`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:27)
- [`dpcfBlockerSampleCount`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:28)
- [`pcssFilterSampleCount`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:29)
- [`dpcfPercentageOccludedBias`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:31)
- [`pcssMinFilterRadius`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:32)
- [`pcssMaxFilterRadius`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:33)
- directional 专用参数：
  - [`dirPcssRadial2DepthScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:36)
  - [`dirPcssMaxPenumbraSize`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:37)
  - [`dirPcssMaxSamplingDistance`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:38)
  - [`dirPcssMinFilterSizeTexels`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:39)
  - [`dirPcssMinFilterMaxAngularDeg`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:40)
  - [`dirPcssBlockerSearchAngularDeg`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:41)
  - [`dirPcssBlockerClumpExponent`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:42)

### 3.2 softness 的 CPU 缩放

softness 的 CPU 预处理在 [`GetAdaptiveSoftness()`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:454)。

当前关键逻辑：

- 透视光 DPCF：[`pcssSoftness * 0.01`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:460)
- 透视光 PCSS：[`pcssSoftness * 0.01 * 2.0`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:462)
- 平行光 DPCF：[`pcssSoftness * orthSoftnessScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:464)
- 平行光 PCSS：[`pcssSoftness`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:466)

其中 [`orthSoftnessScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:457) 是平行光 DPCF softness 的全局缩放锚点。

### 3.3 常量缓冲构建

所有 shader 参数都在 [`SetupShadowCasterConstantBuffer()`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:477) 中下发。

重点：

- [`_PcssPerspectiveParams0`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:534)
  - x = effectiveSoftness
  - y = blocker sample count
  - z = 语义复用槽位
  - w = min filter radius
- [`_PcssPerspectiveParams1`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:539)
  - x = max filter radius
  - y/z/w = perspective 深度线性化参数
- [`_PcssDirectionalParams0`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:566)
  - x = [`depth2RadialScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:552)
  - y = [`radial2DepthScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:553)
  - z = [`maxSampleZDistance`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:555)
  - w = [`maxPCSSOffset`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:556)
- [`_PcssDirectionalParams1`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:572)
  - x = directional 最小 filter 半径 texel 数
  - y = [`minFilterRadial2DepthScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:560)
  - z = [`blockerRadial2DepthScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:563)
  - w = [`blockerClumpExponent`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:564)

---

## 4. Shader 结构与职责划分

### 4.1 平行光 blocker search

平行光 blocker search 函数是 [`BlockerSearch_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:336)。

当前职责：

1. 根据 [`filterSize`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:341) 确定 blocker search 半径
2. 用 Fibonacci clumped 分布采样 [`_ShadowMapDepth`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:387)
3. 对每个 sample 计算 [`coordZ`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:385)
4. 判定是否为 blocker：[`COMPARE_DEVICE_DEPTH_CLOSER()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:401)
5. 输出 [`averageBlockerDepth`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:338) 与 [`numBlockers`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:339)

### 4.2 平行光 PCSS 过滤

平行光 PCSS 过滤函数是 [`PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:416)。

职责：

1. 用 uniform 分布采样圆盘
2. 用 [`GET_UNITY_SAMPLE_SHADOW()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:459) 做硬件比较采样
3. 计算最终 PCSS 阴影值

### 4.3 平行光总入口

[`SampleShadow_PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:467) 的职责：

1. 解包 directional 参数
2. 计算 [`blockSearchFilterSize`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:490)
3. 调用 [`BlockerSearch_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:498)
4. 计算 [`blockerDistance`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:509)
5. 计算最终 [`filterSize`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:510)
6. 分发到：
   - PCSS：[`PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:518)
   - DPCF：[`percentageOccluded`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:522) + [`hardenedKernel()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:302)

### 4.4 聚光灯路径

聚光灯仍走 [`BlockerSearch()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:224) 和 perspective 分支：

- 入口在 [`SampleShadow_PCSS()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:531)
- perspective DPCF/PCSS 不走 [`BlockerSearch_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:336)

因此本轮大部分改动都限定在**平行光 DPCF**。

---

## 5. DPCF 与 PCSS 的实现差异

### 5.1 PCSS

PCSS 路径特点：

1. blocker search
2. 根据 blocker 深度估算半影宽度
3. 使用 [`PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:416) 或 [`PCSSFilter()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:275) 做真正的 PCF 过滤

本质是：

> blocker search + variable radius PCF

### 5.2 DPCF

DPCF 路径特点：

1. blocker search
2. 不做第二阶段真正的 PCF 过滤
3. 直接使用 blocker 占比构建阴影值

核心逻辑在 [`SampleShadow_PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:521)：

```hlsl
float penumbraRatio = saturate(filterSize / max(minFilterRadius, 1e-4));
float percentageOccluded = numBlockers * (1.0 / float(blockerCount));
percentageOccluded = lerp(hardenedKernel(percentageOccluded), percentageOccluded, penumbraRatio);
return blockerFound ? (1.0 - percentageOccluded) : 1.0;
```

本质是：

> blocker search + percentage occluded approximation

这也是 DPCF 更容易在软阴影扩大时出现：

- 漏光
- 过黑
- 阴影杂点
- 参数耦合

---

## 6. 本轮排查中遇到的主要问题

### 6.1 DPCF 没有真正做 PCF

结论：DPCF 没有做 Phase 4 PCF，仅依赖 blocker 占比近似阴影。

影响：

- 阴影边缘更容易不稳定
- 参数更敏感
- 更依赖 blocker search 的质量

### 6.2 原始 blockerStep 半径缩放过于激进

原代码：[`blockerStep`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:364)

```hlsl
float shadowDepthCenter = _ShadowMapDepth.SampleLevel(...).r;
float blockerStep = saturate(saturate(shadowDepthCenter - coord.z) * 100);
filterSize = lerp(filterSize * 0.1, filterSize, saturate(pow(blockerStep,2.2)));
```

问题：

1. `*100` 让很多像素非常快饱和
2. `pow(2.2)` 使小值被进一步压扁
3. `0.1x -> 1.0x` 的切换幅度过大

导致：

- softness 略微变化时 blocker search 半径可能突变
- 阴影出现明显跳变

### 6.3 固定 bias 与 softness 耦合不良

最初为了防止 DPCF 漏光，尝试在 [`shadowDepth`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:387) 上加 bias：

```hlsl
shadowDepth = shadowDepth ± 0.002 * dpcfBlockerBias;
```

思路是对的：

> 用 bias 增强 blocker 判定的保守性，降低 DPCF 漏光概率

但问题在于：

- softness 改变时，blocker search 半径会变化
- 固定 bias 不会同步变化
- 美术必须同时调 softness 与 bias，否则效果迅速恶化

### 6.4 adaptive bias 第一次方案无效

第一次方案试图把 bias 跟 [`maxFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477) 挂钩：

```hlsl
float filterNorm = saturate(filterSize / max(maxFilterRadius, 1e-4));
float biasWeight = smoothstep(0.0, 1.0, filterNorm);
float adaptiveBias = 0.002 * dpcfBlockerBias * biasWeight;
```

问题：

1. [`maxFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477) 是静态上限，不是当前 blocker search 真正使用的半径
2. [`filterNorm`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:389) 经常非常小
3. `smoothstep` 又把小值进一步压扁
4. 最终 bias 太小，效果近似无

结论：

> bias 不应该跟 [`maxFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477) 联动，而应该跟 blocker search 当前实际半径联动

### 6.5 adaptive bias 第二次方案

后续改成：

```hlsl
float filterNorm = saturate(filterSize / max(minFilterRadius * 4.0, 1e-4));
float adaptiveBias = 0.002 * dpcfBlockerBias * filterNorm;
```

优点：

- 去掉了对 [`maxFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477) 的依赖
- 跟当前 blocker search 半径变化节奏更接近

但实践中发现：

- 虽然有一定起效
- 整体跳变问题并未完全解决

### 6.6 即使注释掉 blockerStep，跳变仍存在

当用户将 [`blockerStep`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:364) 那段注释后，仍然在某些 softness 区间发生：

- 阴影杂点
- `0.85 -> 0.45` 的明显跳变

这说明：

> 主因不只来自 blockerStep，而是还有更底层的阈值。

---

## 7. 当前最核心的根因判断

### 7.1 第一层阈值：blockSearchFilterSize 的下限钳制

当前 blocker search 半径：[`blockSearchFilterSize`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:490)

```hlsl
float blockSearchFilterSize = max(min(1.0 - shadowCoord.z, maxSampleZDistance) * depth2RadialScale, minFilterRadius);
```

这表示：

- blocker search 半径随 [`depth2RadialScale`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:471) 线性减小
- 但减小到 [`minFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477) 后就被硬卡住

这本身就可能引起一个阈值区间。

### 7.2 第二层阈值：sample 级别的 zOffset 分支切换

这一句被认为是当前**最可疑的跳变源**：

[`radialOffset < minFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:384)
```hlsl
float zOffset = radialOffset * (radialOffset < minFilterRadius ? minFilterRadial2DepthScale : radial2DepthScale);
```

其中：

- [`radialOffset`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:383) = `filterSize * sampleDistNorm`
- [`minFilterRadial2DepthScale`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477)
- [`radial2DepthScale`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:472)

问题在于：

- 这是一个 sample 级硬分支
- 当 softness 略微变化时，一部分 sample 会从“走小半径规则”切换到“走大半径规则”
- 分支切换是离散的，不是平滑的

这非常容易造成：

- 某个小范围参数变化导致整块阴影突然脏掉
- 或者某些 sample 集体换挡造成画面跳变

当前推断：

> 这比 adaptive bias 更像当前杂乱阴影和跳变的主因。

---

## 8. 已形成的解决思路

### 8.1 思路一：将 DPCF bias 做成 blocker bias，而不是 percentage floor

原先 `_PcssPerspectiveParams0.z` 曾经承担过：

- DPCF 软端下限 / percentage floor

后来调整为：

- 平行光 DPCF 的 blocker bias

这个方向是合理的，因为 DPCF 的问题更适合从 blocker 判定阶段解决，而不是在最终 percentage 上硬钳制。

### 8.2 思路二：bias 应与当前 blocker search 半径联动

不是：

- 跟 [`maxFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477) 联动

而应该：

- 跟 [`filterSize`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:341)
- 或 [`blockSearchFilterSize`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:490)
- 或更直接跟 [`depth2RadialScale`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:471)

同步

### 8.3 思路三：真正的跳变要优先消掉 sample 级硬分支

当前更推荐的收敛方向是：

#### 将：

```hlsl
float zOffset = radialOffset * (radialOffset < minFilterRadius ? minFilterRadial2DepthScale : radial2DepthScale);
```

改成：

```hlsl
float radiusT = saturate(radialOffset / max(minFilterRadius, 1e-4));
float radial2DepthScaleBlend = lerp(minFilterRadial2DepthScale, radial2DepthScale, radiusT);
float zOffset = radialOffset * radial2DepthScaleBlend;
```

这样可以：

- 消除 sample 级阈值切换
- 让小半径到大半径 zOffset 规则平滑过渡
- 减少某个 softness 阈值附近的跳变

---

## 9. 目前的最终方案建议

### 9.1 方案分层

#### 第一层：保留 blocker bias 机制

保留平行光 DPCF 的 bias 思路：

[`adaptiveBias`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:389)
```hlsl
float adaptiveBias = 0.02 * dpcfBlockerBias * dpcfBiasRatio;
```

其中 [`dpcfBiasRatio`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:491) 当前来自：

```hlsl
float dpcfBiasRatio = depth2RadialScale / MAX_PCSS_SOFTNESS;
```

这属于“局部/半全局联动”的尝试。

#### 第二层：优先平滑化 zOffset 分支

下一步最值得做的是平滑掉：

- [`radialOffset < minFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:384)

而不是继续只改 bias 曲线。

#### 第三层：必要时再回头调 blockerStep

如果第一层和第二层都收敛后仍有不稳定，再考虑进一步弱化：

- [`blockerStep`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:364)
- `pow(2.2)`
- `filterSize * 0.1`

---

## 10. 调参建议

### 10.1 关于 softness

平行光 DPCF 的 softness 在 CPU 端会经过 [`orthSoftnessScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:457) 缩放。

经验上：

- `0.02` 是当前老基准
- `0.035` 是温和放大（约 1.75x）
- 不建议一次性跳很大，否则 blocker search 半径与 bias 都会变得敏感

### 10.2 关于 bias 与 softness 联动

如果 [`orthSoftnessScale`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:457) 从 `0.02` 提到 `0.035`，推荐经验公式：

```text
newBias = oldBias * sqrt(0.035 / 0.02)
       ≈ oldBias * 1.32
```

这样比线性联动更稳，不容易把阴影一下压黑。

### 10.3 不建议的方向

当前不推荐继续围绕以下方式反复细调：

- 只改 [`maxFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477)
- 只改 fixed bias 常数
- 只改 percentageOccluded 结果钳制

因为当前最明显的问题已经指向 blocker search 内部的硬阈值，而不是单纯“偏移量太大/太小”。

---

## 11. 推荐的后续实施顺序

### Phase 1
平滑化 [`zOffset`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:384) 的分支切换：

- 将 [`radialOffset < minFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:384) 改成 lerp 过渡

### Phase 2
验证：

- softness 从高到低扫一遍
- 看 `0.85 -> 0.45` 区间是否还出现跳变

### Phase 3
如果还有少量不稳定：

- 弱化 [`blockerStep`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:364)
- 把 `0.1x` 的极端半径缩减改温和

### Phase 4
最后再做“美术友好”的自动联动：

- CPU 端让 [`dpcfPercentageOccludedBias`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowController.cs:31) 自动乘以 softness 的经验系数

---

## 12. 当前结论摘要

1. DPCF 不做真正的 PCF，稳定性天然比 PCSS 更依赖 blocker search
2. blocker bias 方向是合理的，但不是跳变问题的根因
3. adaptive bias 不应该依赖 [`maxFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:477)
4. 当前跳变更像是 blocker search 内部的**硬阈值切换问题**
5. 最可疑的根因是：
   - [`max(..., minFilterRadius)`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:490)
   - [`radialOffset < minFilterRadius`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:384)
6. 下一步最有价值的工作不是继续改 bias，而是先把 [`zOffset`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:384) 的硬分支改成平滑过渡

---

## 13. 关键代码位置索引

- 主光阴影入口：[`MainLightRealtimeShadow()`](Shaders/ShaderLibrary/Pipeline/Shadow.hlsl:434)
- 新版统一入口：[`SampleShadow_PCSS()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:531)
- 平行光 blocker search：[`BlockerSearch_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:336)
- 平行光 PCSS 过滤：[`PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:416)
- 平行光总入口：[`SampleShadow_PCSS_Directional()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:467)
- perspective blocker search：[`BlockerSearch()`](Shaders/ShaderLibrary/Pipeline/URPCSS.hlsl:224)
- softness CPU 缩放：[`GetAdaptiveSoftness()`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:454)
- 常量缓冲构建：[`SetupShadowCasterConstantBuffer()`](Plugins/Bind2Unity/TA/CustomShadow/Runtime/Scripts/ShadowUtils.cs:477)

