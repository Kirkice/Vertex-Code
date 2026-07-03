# Graphics Debug Playbook

这份参考文档沉淀图形开发中的常见渲染问题排查经验，先按“现象”分类，再逐步收敛到具体根因。

建议保持下面这个结构：

1. 现象描述
2. 优先检查项
3. 常见根因
4. 快速验证方法
5. 修复方向

## 总体排查顺序

一般先确认问题属于哪一类，再决定往哪个方向查：

- 变紫 / 粉屏
- 消失或不渲染
- 闪烁
- 鬼影
- 上下翻转
- 渲染错乱
- 黑点 / 白点 / 火花点
- 辉光亮度过曝
- 阴影异常
- 颜色错误 / 明暗异常
- 后处理异常
- 性能正常但结果错误
- 结果正常但性能异常

通用排查原则：

- 先确认问题是“没有 draw”还是“有 draw 但结果不对”
- 先确认问题出在几何阶段、光照阶段、后处理阶段，还是最终合成阶段
- 优先使用最小复现，把复杂效果逐层关掉
- 优先检查最近修改过的 pass、shader keyword、资源绑定和平台分支
- 如果是 Unity 项目，优先配合 Frame Debugger、Profiler、Rendering Debugger 一起看

## 一个通用的渲染 Debug 思路

例如测试 QA 报出来画面上出现了某个异常点、异常块、异常高亮、异常颜色，首先不要急着猜 shader 哪一行有问题，而是先缩小问题归属范围。

### Step 1: 先定位是哪个 GameObject 出问题

- 简单、明显的问题，很多时候一眼就能看出是哪个物体
- 如果画面复杂，一眼看不出来，就用折半查找的方式去隐藏/显示对象，观察画面是否恢复正常
- 如果对象很多，可以按系统、层级、渲染队列、材质类型、特效组分批隐藏
- 目标是先把问题从“整帧异常”缩小到“具体是哪个 GameObject、哪个材质、哪个 pass”

### Step 2: 定位到相关 Shader 或材质特性

- 找到异常 GameObject 后，检查它绑定的材质、shader、keyword、render queue、贴图、Renderer 配置
- 很多问题在这一步就已经很明显了，例如：
  - 开了某个特殊 keyword
  - 使用了某张异常贴图
  - 进了某个特定 pass
  - 材质参数超出合理范围

### Step 3: 如果一眼看不出，就从结果往回溯源

- 在 shader 中从最终输出结果出发，逐步 return 或输出中间变量
- 如果某个中间变量显示出来已经错了，就继续往它的输入上游追
- 一直追到找到第一个开始出错的变量、采样结果、数学表达式或分支条件

常见做法：

- 直接 `return float4(xxx, 1, 1);` 或输出灰度可视化
- 分别输出：
  - albedo
  - normal
  - roughness
  - metallic
  - emissive
  - mask
  - depth
  - 世界坐标 / UV / viewDir / NdotL / NdotV
- 对分支条件输出 0/1，确认实际走了哪条路径

### Step 4: 找到病因后，再判断属于哪一类问题

- shader 编译 / keyword / 平台分支问题
- 贴图导入 / 压缩 / 色彩空间问题
- 深度 / 阴影 / 后处理 / 历史缓存问题
- 特殊机型驱动 / 编译器兼容性问题

## 如何定位具体是哪个 pass 导致的问题

### Editor 下可复现

- 如果能在引擎桌面 Editor 环境下复现，优先在 Editor 下排查
- 这时通常可以直接定位到问题 pass，或者通过 Frame Debugger 快速确认
- 重点看：
  - 问题是从哪一个 pass 开始出现
  - 问题 pass 的输入纹理、输出 RT、shader、材质和 keyword 是否符合预期
  - 同一个对象是否在某个特定 pass 中表现异常，而其他 pass 正常

### 只能真机复现

- 如果只能在真机上复现，尤其是更极端的“特定机型才会出现”
- 这时就需要依赖截帧工具去回放，然后逐个 pass 排查
- 核心目标不是一开始就修，而是先确认：
  - 哪一个 pass 第一次把结果搞错了
  - 它的输入在前一个 pass 是否还是正常的
  - 问题是出在 pass 内部，还是输入资源在更早阶段就已经坏了

### 常用判断方式

- 从最终画面往前看，找到第一个开始异常的 pass
- 同时对比：
  - 当前 pass 输入是否正常
  - 当前 pass 输出是否正常
  - 同一物体在其他 pass 中是否正常
- 如果输入正常、输出异常，大概率问题就在这个 pass 本身
- 如果输入已经异常，那就继续往更前面的 pass 追

## 如何定位具体是哪个材质 keyword 导致的问题

这类问题相对少见，因为通常比较容易定位：

- 找到异常对象对应的材质
- 查看它启用了哪些 keyword
- 逐个切换或裁剪 keyword 组合，观察问题是否消失

常见方法：

- 先禁掉最近新增的 keyword
- 先对比“正常材质”和“异常材质”的 keyword 差异
- 逐个关闭 feature，缩小到具体 keyword
- 确认 shader 实际走的是哪组 `multi_compile` / `shader_feature` 分支

## 如何区分是 Shader 自身问题，还是贴图 / 材质 / 管线输入问题

### 判断 Shader 自身问题

- 给出问题的物体换一个绝对没问题的 Shader，例如 Unity 官方提供的简单 Shader 或项目里已经验证过的稳定 Shader
- 如果替换后画面恢复正常，大概率可以确定是 Shader 自身引起的问题
- 如果替换后依然有问题，那大概率不是 Shader 自身，而是其他因素导致

### 进一步区分思路

#### 更换 Shader 后恢复正常

优先怀疑：

- Shader 逻辑本身有 bug
- Shader keyword 分支错误
- Shader 在某个平台编译或驱动上生成错误代码
- Shader 对输入数据做了不安全的数学运算

#### 更换 Shader 后仍然异常

优先怀疑：

- 贴图内容或导入设置有问题
- 材质参数本身异常
- 管线输入资源有问题，例如深度、法线、阴影、相机颜色纹理
- Renderer、pass、render queue、混合状态、平台宏等外部条件有问题

## 变紫 / 粉屏

### 优先检查项

- Shader 是否编译失败
- 当前材质引用的 Shader 是否丢失
- Shader 是否被 variant stripping 剪掉
- Pass / LightMode / RenderPipeline tag 是否匹配当前管线
- include 路径、宏分支、keyword 组合是否正确

### 常见根因

- Shader 编译报错
- Shader 文件重命名、GUID 丢失、材质引用断开
- Built-in / URP / HDRP 管线写法混用
- Shader target、平台宏或精度写法不兼容当前平台

## 消失或不渲染

### 优先检查项

- Frame Debugger / 截帧里是否存在对应 draw
- Mesh、材质、Renderer 是否真的挂载正确
- 是否被剔除、隐藏、layer/filter 排除
- Pass 是否被 pipeline 选中
- 顶点输出、裁剪空间、深度状态是否异常

### 常见根因

- mesh 丢失或被 culling / 隐藏
- 贴图数量或采样器数量超限
- Bounds 错误、矩阵错误、CullMode / ZTest / ZWrite 配置错误
- SRP 中 renderer feature / custom pass 的过滤条件没命中

## 闪烁

### 优先检查项

- mipmap / LOD / 采样问题
- TAA / 抖动采样
- 深度精度或 Z-fighting
- 法线、高光、粗糙度导致的镜面 aliasing
- 大世界坐标精度问题

### 常见根因

- mipmap 缺失
- TAA 引起边缘闪烁
- 大坐标精度抖动
- DFG / roughness 导致高光点闪烁
- 共面引起 z-fighting

## 鬼影

### 优先检查项

- TAA 是否开启
- clamp / history rejection 是否正确
- velocity buffer / motion vector 是否正确
- 历史缓存是否正确清空

## 上下翻转

### 优先检查项

- 当前平台图形 API
- UV 原点约定
- 屏幕纹理、深度纹理、相机颜色纹理采样方向
- blit / fullscreen / copy pass 是否重复翻转

## 渲染错乱

### 优先检查项

- 深度纹理、法线纹理、颜色 RT 是否存在且格式正确
- 当前 pass 采样的资源是否是本帧最新内容
- barrier / 资源状态 / 生命周期是否正确
- 半透明排序是否符合预期
- UV、viewport、scissor、动态分辨率缩放是否一致

### 常见根因

- 未开启深度纹理却采样深度图
- 半透明排序问题
- 当前无相机渲染
- 读写同一 RT 或使用失效临时 RT

## 黑点 / 白点 / 火花点

### 优先检查项

- Shader 中是否有 NaN / Inf
- 是否存在除以 0、log 负数、sqrt 负数、pow 非法输入
- BRDF 输入是否有 clamp / epsilon 保护
- HDR 数值是否异常大

## 辉光亮度过曝

### 优先检查项

- NaN / Inf
- 极端高亮像素
- Bloom threshold、knee、clamp
- TAA / Bloom / tone mapping 链路是否相互放大

## 阴影异常

### 优先检查项

- shadow map 是否真的生成
- 光源是否开启阴影、caster pass 是否执行
- depth bias、normal bias、slope-scaled bias 是否合理
- 采样空间、投影矩阵、级联分割是否正确

### 阴影丢失专项

- 如果截帧或 Frame Debugger 中看不到 shadow map 绘制：
  - 灯光可能没开启阴影
  - 管线或 Quality Settings 可能没开启阴影
  - 阴影关键字可能丢失
- 如果能看到 shadow map 绘制但最终没有阴影：
  - 材质 Queue 可能设置到 3000，透明默认不接收阴影
  - Renderer 组件上可能关闭了阴影接收
  - 阴影采样声明可能不正确，或管线内部被清理
- 特殊情况：`SampleCmpLevelZero` 在极少数高通机型上可能引发阴影丢失；必要时在阴影渲染前显式清理当前激活 RT：

```csharp
cmd.SetRenderTarget(BuiltinRenderTextureType.CurrentActive);
cmd.ClearRenderTarget(true, false, shadowMapClearColor, shadowMapClearDepth);
```

## 颜色错误 / 明暗异常

### 优先检查项

- Gamma / Linear 工作流是否一致
- 贴图导入的 sRGB 选项是否正确
- 法线空间是否混用
- metallic / roughness / AO 通道解释是否正确
- 不同平台贴图压缩格式是否一致

### 常见根因

- LUT / Color Grading 映射错误
- ANGLE 或特殊机型路径差异
- 特殊机型驱动或 shader 编译器优化异常
- 平台贴图压缩格式不同导致模糊或偏色

## 后处理异常

### 优先检查项

- 输入纹理是否来自正确 pass
- depth / normal / motion vector 是否齐全
- half / quarter resolution 采样和回写是否正确
- 历史缓存是否按分辨率变化更新

## 特殊机型函数编译导致的变色和曝光

### 现象

- 只在个别机型上出现变红、变绿
- 同时伴随 Bloom 严重曝光
- 逻辑上看 shader 没问题，但特定设备结果明显错误

### 真实案例摘要

- 某个案例中，三目运算符里直接调用 `abs`，在少数设备上怀疑触发后端驱动或编译器 bug
- 将 `abs(cos(x))` 从三目表达式中提前拆出后恢复正常

## 建议补充的案例信息

- 出现平台：PC / Android / iOS / Console / XR
- 渲染管线：Built-in / URP / HDRP / 自研
- API：D3D11 / D3D12 / Vulkan / Metal / GLES
- 问题现象：截图或录屏
- 复现条件：镜头角度、距离、特定材质、特定 keyword、特定分辨率
- 问题阶段：几何 / 阴影 / 光照 / 后处理 / 合成
- 最终根因
- 最终修复方式
- 是否有副作用
