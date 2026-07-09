# Mode Handoff 验收回路模式

## 1. 适用范围

本文档描述 Architect → Code → 回切 Architect 验收的完整回路模式。适用于所有使用多模型协作的场景，特别是：

- Architect Mode 分析并生成执行计划后切换到 Code Mode 执行
- 需要确认 Code Mode 的实现是否符合 Architect Mode 的预期
- 需要在验收不通过时自动触发修复循环

---

## 2. 核心流程

```text
Architect 分析 → 生成 TODO + 验收标准 → Mode Handoff → Code 执行
→ 生成执行报告 → 回切 Architect → 验收对照
→ 通过：完成 / 不通过：生成修复指令 → 再次 Handoff Code
```

---

## 3. 验收标准生成

Architect Mode 在生成 TODO List 时，应同时为每项任务生成可验证的验收标准。

### 验收标准要求

- 每条标准必须是可明确判定"通过/不通过"的
- 优先使用客观条件（文件存在、编译通过、测试通过、行为符合预期）
- 避免模糊表述（如"代码质量好"）

### 示例

```text
验收标准:
  - src/foo.ts 文件中存在 exportFunction 函数
  - 该函数接受 (input: string) 参数并返回 string
  - 运行 pnpm test 通过所有测试
  - 不引入新的 TypeScript 编译错误
```

---

## 4. 执行报告

Code Mode 在所有 TODO 项标记为 completed 后，自动生成执行报告。

### 执行报告内容

- 已完成项
- 未完成项及原因
- 实际修改的文件
- 偏离原计划的事项
- 自评对照验收标准的结果

---

## 5. 自动回切

当 `validationMode = "auto_return"` 时：

1. Code Mode 生成执行报告后自动触发 Mode Handoff 回切 Architect
2. Architect 收到执行报告 + 原始验收标准
3. Architect 逐条对照验收
4. 全部通过 → 完成
5. 有不通过项 → 生成修复指令，再次 Handoff 给 Code Mode

---

## 6. 修复循环

验收不通过时：

- Architect 生成具体的修复指令
- 修复指令随新 Handoff 传递给 Code Mode
- Code Mode 只需关注不通过项的修复
- 修复完成后再次生成执行报告并回切

建议设置最大修复循环次数（如 3 次），避免无限循环。

---

## 7. 可沉淀的经验结论

1. 多模型协作必须有验收回路，否则执行结果不可信
2. 验收标准必须在 Handoff 时就确定，不能事后补
3. 执行报告是回切验收的核心数据载体
4. 修复循环应有限次数，避免无限重试
5. 验收结果应回流知识库，形成经验积累
