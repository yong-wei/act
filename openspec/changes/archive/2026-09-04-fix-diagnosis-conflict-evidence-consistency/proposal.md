## Why

教师学情诊断会把「作业较高、测评较低」写成冲突，但引用的作业与测评可以分属不同学生、分数相同或方向相反。现有校验只确认 `evidenceRefs` 存在于受治理输入中，页面只要看见「冲突／不一致」就显示「证据存在冲突」，使不可核验的模型声明被当成有效冲突。

## What Changes

- 冲突结论持久化前增加确定性语义校验：引用必须属于同一学生或一致学生群体、时间窗可比、分值方向支持声明。
- 跨学生误配、同分、方向不符或时间窗不可比时，按可重试模型行为缺陷拒绝，不持久化。
- 有效的同学生、近时间窗、反方向证据仍可生成并显示「证据存在冲突」。
- 历史报告保持不可变；无法验证的冲突声明不再显示为已确认冲突，改为需要重新生成或人工复核。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `teacher-diagnosis-generation-governance`: 冲突声明必须由引用证据直接证明，而不是仅确认引用存在。
- `teacher-diagnosis-report-delivery`: 未经验证的冲突措辞不得投影为「证据存在冲突」。

## Impact

- `src/lib/diagnosis-generation-provider.ts`、生成 worker 失败分类。
- 教师报告历史投影。
- 生成端、worker、历史投影回归测试。
