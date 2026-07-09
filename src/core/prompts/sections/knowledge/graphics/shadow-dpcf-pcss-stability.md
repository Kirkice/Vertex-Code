# DPCF 与 PCSS 阴影稳定性案例

## 1. 适用场景

本文档沉淀一个通用阴影案例：在软阴影方案中，尤其是方向光的 DPCF 与 PCSS 变体里，当 `softness`、filter radius、blocker search 半径联动时，容易出现以下问题：

- 阴影边缘跳变
- 软阴影范围内出现杂点
- 参数轻微调整导致阴影从较平滑状态突然切换到脏污状态
- DPCF 比 PCSS 更容易出现漏光、过黑和参数耦合

本文聚焦算法层问题模式、根因判断与推荐修复路径，不绑定具体工程实现。

---

## 2. 背景：DPCF 与 PCSS 的核心差异

### 2.1 PCSS

PCSS 通常包含两阶段：

1. blocker search
2. 根据 blocker 深度估算半影宽度，再做 variable radius PCF

本质上是：

```text
blocker search + variable radius PCF
```

### 2.2 DPCF

DPCF 常见变体通常也会做 blocker search，但不会进入完整的第二阶段 PCF 过滤，而是直接基于 blocker 占比近似构建阴影值。

本质上是：

```text
blocker search + percentage occluded approximation
```

这意味着：

- DPCF 更依赖 blocker search 的稳定性
- DPCF 对 filter radius、bias、sample 分布更敏感
- 在软阴影放大时，更容易出现跳变、漏光和噪点

---

## 3. 典型症状

在方向光软阴影里，如果算法存在半径阈值或 sample 级硬分支，常见症状包括：

- `softness` 从大到小连续调节时，阴影在某一段区间突然变脏
- 阴影值从较稳定状态突变到明显更暗或更亮的状态
- 同一片阴影内部出现离散噪点或斑块
- 参数稍微变化就需要同步手调 bias，表现出明显的参数耦合

如果现象表现为“某个小范围参数变化导致整个阴影观感突然换挡”，通常应优先怀疑算法中存在离散阈值切换，而不仅仅是 bias 选得不合适。

---

## 4. 常见但不稳定的实现模式

### 4.1 blocker search 半径存在硬下限

常见写法：

```hlsl
float blockSearchFilterSize = max(dynamicRadius, minFilterRadius);
```

这类写法的问题在于：

- `dynamicRadius` 会随着 `softness`、receiver depth、light size 等变化
- 一旦减小到 `minFilterRadius` 就被硬钳住
- 在临界区间附近，会形成一段不可平滑跨越的阈值带

这会让 blocker search 半径的变化从连续函数变成分段函数。

### 4.2 sample 级 zOffset 存在硬分支

典型问题写法：

```hlsl
float zOffset = radialOffset * (radialOffset < minFilterRadius ? smallScale : largeScale);
```

这类写法的问题更严重：

- `radialOffset` 往往由 `filterSize * sampleDistNorm` 决定
- 当 `softness` 略微变化时，会有一批 sample 从一种规则切换到另一种规则
- 切换是离散的，不是平滑的

结果是：

- 一部分 sample 的深度判定规则瞬间改变
- blocker 识别结果会集体换挡
- 最终阴影值出现明显跳变或局部脏污

这是方向光 DPCF / PCSS 稳定性问题中非常高频的根因。

---

## 5. 根因判断框架

当软阴影出现跳变时，建议按以下顺序判断：

### 5.1 先分辨是 bias 问题还是阈值问题

如果问题表现为：

- 整体一直偏亮或偏暗
- 漏光随 bias 调整有单调改善

更像是 bias 问题。

如果问题表现为：

- 参数平滑变化时，画面在某个区间突然跳变
- 注释掉部分 bias 或半径缩放后，问题仍存在

更像是阈值问题。

### 5.2 优先检查 blocker search 内部是否存在离散切换

重点检查：

- `max` 或 `min` 对半径做硬钳制
- `if` 或三元表达式对 sample 级规则做离散切换
- 半径、深度偏移、遮挡判定是否由两套不同规则拼接而成

### 5.3 再看 bias 是否跟错误的量联动

如果 bias 联动的是“静态上限”，而不是“当前实际使用半径”，则常见现象是：

- 理论上设计了 adaptive bias
- 实际上大部分区间 bias 几乎不起效
- 参数看似联动，实际节奏不同步

结论通常是：

```text
bias 应跟当前 blocker search 的实际工作半径联动，而不是只跟理论最大半径联动
```

---

## 6. 推荐修复思路

### 6.1 第一优先级：平滑化 sample 级硬分支

如果存在类似：

```hlsl
float zOffset = radialOffset * (radialOffset < minFilterRadius ? smallScale : largeScale);
```

更推荐改为：

```hlsl
float radiusT = saturate(radialOffset / max(minFilterRadius, 1e-4));
float blendedScale = lerp(smallScale, largeScale, radiusT);
float zOffset = radialOffset * blendedScale;
```

这样做的收益：

- 消除 sample 级硬阈值切换
- 让小半径规则到大半径规则连续过渡
- 明显降低 `softness` 临界区间的跳变风险

这通常比继续细调 bias 更有效。

### 6.2 第二优先级：让 bias 跟当前实际工作半径联动

不推荐：

- bias 仅跟 `maxFilterRadius` 或理论上限联动

更推荐：

- 跟 `filterSize`
- 跟 `blockSearchFilterSize`
- 跟与当前 receiver depth 同步变化的半径尺度

目标不是让 bias 绝对更大，而是让 bias 与 blocker 判定范围的变化节奏一致。

### 6.3 第三优先级：弱化过于激进的半径缩放

如果仍有不稳定，再检查以下模式：

- 对 blockerStep 做过强放大
- 使用高指数 `pow`
- 从极小半径到完整半径的切换跨度过大

例如以下模式要谨慎：

```hlsl
filterSize = lerp(filterSize * 0.1, filterSize, saturate(pow(blockerStep, 2.2)));
```

潜在问题：

- 小输入被进一步压扁
- 很多像素过快进入饱和区间
- `softness` 微调会放大成 blocker search 半径突变

推荐把极端缩放改得更温和，再看跳变是否进一步缓解。

---

## 7. 一条实用的实施顺序

### Phase 1

先改 blocker search 内部的 sample 级硬分支，把离散切换改为平滑过渡。

### Phase 2

系统扫一遍 `softness` 区间，观察是否还存在明显的“观感换挡区间”。

### Phase 3

如果仍有少量不稳定，再弱化 blockerStep、幂函数和极端半径压缩。

### Phase 4

最后再做美术友好的参数联动，例如让 DPCF 的 blocker bias 在 CPU 端按经验系数跟 `softness` 自动联动。

这条顺序的核心原则是：

```text
先消除离散阈值，再调 bias 曲线，最后做参数自动化
```

---

## 8. 调参与设计建议

### 8.1 不要把 DPCF 当成完整 PCSS

DPCF 天然不是完整二阶段 PCF 过滤，它更像一种近似方案。因此：

- 参数不应期待与 PCSS 完全同样稳定
- blocker search 的采样质量比最终阴影插值更关键
- bias、sample 分布、半径曲线的设计优先级更高

### 8.2 `softness` 与 bias 的联动应温和

如果 `softness` 放大，bias 可以联动，但不建议做强线性放大。更稳妥的经验是：

- 做缓和型联动
- 优先保证不过黑、不漏光、不过度敏感
- 让 bias 增幅慢于半径增幅

### 8.3 不建议把问题只归因于固定 bias 常数

如果画面存在明显阈值跳变，以下方向通常不是主解：

- 只改 fixed bias 常数
- 只改 `maxFilterRadius`
- 只对最终 `percentageOccluded` 做结果钳制

这些方法有时能缓解表象，但往往不能解决根因。

---

## 9. 可沉淀为 Graphics 知识库的经验结论

1. DPCF 的稳定性高度依赖 blocker search，而不只是最终阴影合成公式
2. 方向光软阴影出现跳变时，应优先排查 blocker search 内部的硬阈值，而不是先怀疑 bias 常数
3. adaptive bias 应与当前实际工作半径联动，而不应只绑定静态上限
4. sample 级的半径规则切换若使用硬分支，非常容易引发阴影脏污与观感换挡
5. 修复顺序应优先是：平滑过渡 → 联动 bias → 弱化激进缩放 → 美术侧参数自动化

---

## 10. 适合作为 Skill 或 Playbook 的提示语

可将以下规则用于未来的图形技能或排障 playbook：

- 当用户反馈 `softness` 微调导致阴影突然变脏时，检查 blocker search 是否存在 sample 级硬分支
- 当 DPCF 比 PCSS 更容易漏光或抖动时，优先检查 blocker 占比近似是否过度依赖离散判定
- 当 adaptive bias 看似存在但效果接近无效时，检查它是否错误绑定在理论最大半径而不是实际工作半径上
- 当 soft shadow 参数表现出强耦合时，优先拆解 radius、bias、sample rule 是否同步变化

---

## 11. 推荐标签

- `shadow`
- `dpcf`
- `pcss`
- `soft-shadow`
- `blocker-search`
- `stability`
- `artifact-analysis`
