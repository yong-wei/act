## Why

微辅导完成学习后需要独立、已审查的验证题确认结果，但当前验证候选只覆盖少量节点。现有题库虽有 remediation 题目，却缺少一个证明其与来源题独立、与规范节点及错因一致、且版本和学生投影稳定的登记合同。

## What Changes

- 从既有自适应评估目录和不可变 `AdaptiveAssessmentItemRef` 派生微辅导验证题治理投影，不建立第二套题库。
- 先审计现有 remediation/checkpoint 题能否满足验证要求，仅在确有内容缺口时补写最小必要题目。
- 要求验证题与来源题的题目 ID 和内容哈希均不同，并绑定相同学习目标、规范节点和适用错因。
- 规定确定性选择、学生安全载荷、授权、退役和内容漂移的 fail-closed 行为。
- 将验证题投影纳入 54 题/108 错误选项覆盖审计。

## Capabilities

### New Capabilities

- `micro-tutoring-validation-registry`: 定义独立验证题的治理投影、资格、选择、版本身份和学生安全投影。

### Modified Capabilities

- `adaptive-assessment-item-catalog`: 明确题目作为微辅导验证候选所需的人工审核、阶段用途、节点和不可变内容身份。
- `micro-tutoring-coverage-audit`: 完整链路必须验证独立、可访问且与来源题无身份复用的验证题候选。

## Impact

- 影响自适应题目目录、数据库题目快照、验证题选择、微辅导编排和覆盖审计。
- 不允许大模型在运行时生成正式验证题，不在本变更中修改验证结果对掌握度的贡献规则。
