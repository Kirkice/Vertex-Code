# DeepSeek `reasoning_content` 报错排障记录

## 1. 问题现象

在开启 orchestrator 模式后，任务从 Planner 阶段切换到 Worker 阶段，Worker 使用 DeepSeek thinking 模型执行时，首次请求就可能报错：

```text
DeepSeek completion error: 400 The `reasoning_content` in the thinking mode must be passed back to the API.
```

典型触发路径：

1. Planner 使用非 DeepSeek 模型完成规划或模式切换
2. 对话历史中留下 `assistant tool_calls` 和对应 `tool_result`
3. Worker 切换到 DeepSeek V4 thinking 模型
4. DeepSeek 在第一次请求时直接返回 400

## 2. 复现特征

一个稳定复现的场景是：

1. 用户在 orchestrator 模式中发起简单执行任务
2. Planner 先调用 `update_todo_list`、`ask_followup_question`、`switch_mode`
3. Worker 切到 `deepseek-v4-flash` 或 `deepseek-v4-pro`
4. API 请求失败

落盘后的历史通常会包含下面这种结构：

```text
assistant: tool_calls=[update_todo_list]
tool: "Todo list updated successfully..."
assistant: tool_calls=[ask_followup_question]
tool: "<user_message>...</user_message>"
assistant: tool_calls=[switch_mode]
tool: "Successfully switched..."
```

这些消息本身不是 DeepSeek 生成的，但会被后续请求原样带给 DeepSeek。

## 3. 根因分析

### 3.1 表层原因

DeepSeek 的 thinking 模式要求：

- 如果上一轮 assistant 消息包含 `reasoning_content`
- 那么后续续传时必须把对应的 `reasoning_content` 一并传回 API

否则会直接返回 400。

### 3.2 更深层原因

这次问题不只是“DeepSeek 自己上一轮的 `reasoning_content` 丢失”。

真正的高频触发点是：

- Planner 阶段由其他模型生成了工具调用链
- 这些历史消息在切到 DeepSeek Worker 后，被继续当作 assistant/tool continuation 发送
- 但这些 assistant 工具消息并没有 `reasoning_content`
- DeepSeek 在 thinking 模式下会把它们视为不完整的续传上下文，从而报错

换句话说，这是一个“跨模型切换 + reasoning provider 严格校验”的组合问题。

## 4. 修复思路

修复分成两层：

### 4.1 保留可用的 `reasoning_content`

对于 DeepSeek / MiMo / Z.ai 这类 `preserveReasoning = true` 的 provider：

- assistant 消息落盘时保留顶层 `reasoning_content`
- 重建 API 历史时继续透传 `reasoning_content`

这样可以覆盖“同模型续传”场景。

### 4.2 降级外来工具链历史

对于切换到 reasoning provider 之前由其他模型产生的旧工具链历史：

- 如果 assistant 消息包含 `tool_use`
- 但没有 `reasoning_content`
- 则不要再把它当作可续传的 assistant tool-call 链发送

而是将其降级为普通文本上下文，例如：

```text
[Tool used: switch_mode {"mode_slug":"code","reason":"..."}]
```

对应的 `tool_result` 也一并降级为普通文本：

```text
[Tool result: switch_mode]
Successfully switched to code mode.
```

这样做的好处是：

- 保留语义上下文
- 避免伪造 DeepSeek 自己的 tool continuation
- 避免触发 thinking 模式的严格校验

## 5. 代码改动

### 5.1 历史重建保护

文件：

- `src/core/task/Task.ts`

关键改动：

- 在 `buildCleanConversationHistory()` 中识别 `preserveReasoning` provider
- 对“无 `reasoning_content` 的 assistant 工具链”做文本降级
- 将对应 `tool_result` 转成普通 text block

### 5.2 `reasoning_content` 保留

文件：

- `src/core/task/apiConversationHistory.ts`

关键改动：

- assistant 消息落盘时保留顶层 `reasoning_content`
- 对 `handler.getModel()` 增加安全兜底，避免轻量 mock 或非完整 handler 报错

## 6. 相关测试

新增和更新的测试覆盖了两类场景：

- reasoning provider 正常保留 `reasoning_content`
- 从非 reasoning provider 切换到 DeepSeek 时，旧 assistant 工具链会被降级

相关文件：

- `src/core/task/__tests__/reasoning-preservation.test.ts`
- `src/core/task/__tests__/apiConversationHistory.spec.ts`

## 7. 验证结果

本次修复后已完成以下验证：

1. `pnpm.cmd exec tsc --noEmit -p src/tsconfig.json`
2. `pnpm.cmd --dir src exec vitest run core/task/__tests__/reasoning-preservation.test.ts core/task/__tests__/apiConversationHistory.spec.ts`
3. `pnpm.cmd --dir src bundle`

说明：

- 类型检查通过
- 相关单测通过
- 扩展运行包 `src/dist/extension.js` 已重新构建

## 8. 后续建议

为了减少类似问题再次出现，建议后续遵循以下原则：

1. 只要 provider 有 `preserveReasoning` 语义，就不要直接复用其他模型生成的 assistant tool-call 历史
2. 跨模型切换时，优先保留“语义”，而不是保留“原始工具调用结构”
3. 所有 reasoning provider 的历史重建逻辑尽量统一走一套保护分支，避免 DeepSeek、MiMo、Z.ai 分别修补

## 9. 结论

这次 bug 的本质是：

- `reasoning_content` 续传要求
- 与 orchestrator 模式下的跨模型工具链历史复用

发生了冲突。

最终解决方案不是单纯补传字段，而是：

- 能保留的 `reasoning_content` 就保留
- 不属于当前 reasoning provider 的旧工具链就降级为普通文本上下文

这样才能同时兼顾正确性和兼容性。
