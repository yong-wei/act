## Context

v1 的 54 题基线与 108 条错误选项归因已经形成历史资格证据，不能原地扩写。当前目录中有 135 道人工审核且 path-eligible 的题目，按阶段分为 practice 54、checkpoint 27、remediation 27、readiness/readiness-gate 27；其中两道 readiness 预设题为四选一，其余为三选一，因此 v2 分母包含 272 个错误选项。

## Goals / Non-Goals

**Goals:**

- 保留 v1 工件字节与语义兼容性。
- 建立独立命名的 v2 基线和归因目录。
- 运行时对新答题使用 v2 精确目录，未命中时继续 fail-closed。
- 目录生成由当前目录项和语义审核快照确定性验证。

**Non-Goals:**

- 不补齐资源和验证题。
- 不改写历史 `WrongAnswerAttribution`。
- 不纳入未人工审核或非 path-eligible 题目。

## Decisions

### 1. v1 与 v2 工件并存

保留现有 `micro-tutoring-practice-baseline.json` 和 `micro-tutoring-option-attributions.json`，新增带 `-v2` 后缀的工件。运行时默认加载 v2 归因目录，v1 审计仍读取原路径，避免历史回执失效。

### 2. v2 分母绑定审核阶段

v2 基线仅接受同时满足目录 path-eligible、审核结果 approved、审核哈希存在且阶段属于 practice、checkpoint、remediation、readiness 或 readiness-gate 的题目。每条记录保存阶段、内容哈希和题目审核哈希，阶段计数不一致即生成失败。

### 3. 每个错误选项保留独立证据

v2 记录继续使用题目 ID、内容哈希和选项键作为复合身份。同题错误选项使用不同错因、证据摘要和逐选项审核哈希。证据摘要依据审核包中该错误选项的解释形成，不暴露正确答案或学生数据。

### 4. 历史记录不回填

新答案使用 v2 目录。已有 v1/v2 `WrongAnswerAttribution` 仍按最早记录投影，不因目录扩展重新解释；需要新证据时由学生重新作答。

## Risks / Trade-offs

- v2 仅解决归因覆盖，资源和验证题需后续 Issue 才能使全部题目可编排。
- 题目或审核变化会使精确归因失效；生成器和加载器通过内容哈希及审核哈希显式暴露漂移。

## Migration Plan

1. 提交 v2 基线、归因目录及生成测试。
2. 将默认新归因目录切换为 v2，保留 v1 文件和历史读取。
3. 运行定向测试、类型检查和严格 OpenSpec 校验。
4. 回退时恢复默认目录路径；无需数据库迁移。
