## Why

教师班级学情诊断中，`riskFlags` 是只包含当前命中风险的稀疏集合，但 provider 输入投影与提示词从未声明这一语义：模型只看到 `studentIds.length = 100` 与 `riskFlags.length = 52`，便把记录数误解为风险数据覆盖人数，生成"风险标志数据仅覆盖 52 名学生"的错误限制并将报告降为 `medium`。同时教师报告投影在无法从结构化覆盖字段推导原因时回退为通用"补充可核验证据"建议，把真实的跨来源证据冲突隐藏在误导性状态文案后面（Issue #1755，报告 `cmti6cg9o000ug6jx7cuea04o`，覆盖率实为 100%）。

## What Changes

- provider 工具投影为风险标志携带稀疏命中语义：字段命名与结构化计数（命中学生数 / 被诊断学生总数分离）明确不与覆盖率混淆，system prompt 声明稀疏集合语义并禁止按 `riskFlags.length` 推断覆盖率。
- 增加确定性生成校验：模型输出把风险命中数量表述为覆盖缺失时按模型行为缺陷拒绝重试，不得持久化。
- 建立结构化置信原因：跨来源证据冲突作为显式降级原因进入报告状态卡片；数据覆盖完整时不得显示"补充可核验证据"式通用建议。
- 将"完整数据 + 稀疏风险标志 + 跨来源冲突"场景补入诊断准确性 fixture/live 基准。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `teacher-diagnosis-generation-governance`: 风险标志输入投影声明稀疏命中语义，提示词禁止覆盖率误读，确定性校验拦截覆盖缺失误述。
- `teacher-diagnosis-report-delivery`: 状态卡片展示具体可核验的降级原因；覆盖完整且存在证据冲突时如实表述为证据冲突，不回退为通用补证据建议。
- `diagnosis-accuracy-regression-gates`: 基准新增稀疏风险标志与跨来源冲突场景类。

## Impact

- 生成端：`src/lib/diagnosis-generation-provider.ts`（工具投影、system prompt、确定性校验）。
- 教师投影：`src/features/teacher/teacher-diagnosis-report-history-projection.ts` 与状态卡片消费方。
- 基准：`src/lib/diagnosis-benchmark/` 场景与 fixture。
- 测试：生成端、输入投影、教师报告投影与 benchmark 回归测试。
- 非目标：不为未命中风险的学生伪造记录；不放宽 #1712 归因约束；不回写历史报告。
