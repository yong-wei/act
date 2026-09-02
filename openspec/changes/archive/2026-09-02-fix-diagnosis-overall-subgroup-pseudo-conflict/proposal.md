## Why

教师端学情诊断报告在证据覆盖完整时误报「证据存在冲突」：生成器把「班级整体作业、测评表现正常」与「部分学生知识进度长期滞后」判为来源间冲突并降低置信度（#1872，#1755 follow-up）。班级总体与局部子群学生范围不同，可以同时成立；方向不同不构成可核验的跨来源冲突。

根因在三处：生成提示词未限定证据冲突必须来自相同学生范围与相近时间窗；持久化前校验不拦截总体—子群伪冲突；历史投影按 `conflicting-source` 等关键词渲染，已持久化的伪冲突继续显示为真实冲突。

## What Changes

- 新增总体—子群伪冲突的确定性识别规则：`班级/整体/总体…正常` 与 `部分/少数/个别学生…薄弱/滞后` 的组合不构成证据冲突。
- 生成提示词补充证据可比性约束：只有相同学生范围、相近时间窗内方向相反的证据才可声明冲突。
- 持久化前校验：summary 或 limitations 出现总体—子群伪冲突表述时，按可重试的模型行为缺陷记录明确错误并重新排队，不持久化该报告。
- 历史报告保持不可变，但投影识别伪冲突后显示「报告需重新生成」及准确原因，不再显示「证据存在冲突」；真实同范围冲突（如同批学生作业高分、测评低分）保留冲突提示。
- 诊断 benchmark 的真实冲突场景表述明确绑定同一批学生与同一时间窗。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `teacher-diagnosis-generation-governance`: 增加总体—子群伪冲突的可重试拦截与证据可比性约束。

## Impact

- `src/lib/diagnosis-generation-provider.ts`（提示词与生成后校验）、`src/lib/diagnosis-generation-worker.ts`（失败分类）。
- `src/features/personalization/diagnosis/role-based-learning-diagnosis.ts` 及报告历史投影（恢复建议文案）。
- `src/lib/diagnosis-benchmark/scenarios.ts`（冲突场景表述）。
- 生成端、worker、历史投影与 benchmark 回归测试。

## Non-Goals

- 不回写或删除历史诊断报告（仅投影层标注）。
- 不修改原始学习证据、薄弱判定阈值或证据覆盖率规则。
- 不隐藏真实、可比较的证据冲突。
