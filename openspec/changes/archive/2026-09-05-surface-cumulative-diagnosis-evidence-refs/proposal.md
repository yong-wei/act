## Why

成长中枢的累计能力诊断已经基于真实学生画像生成结论，但当前服务端把每个维度的 `evidenceRefs` 固定为空，并用不匹配的专项快照类型判断整体状态。结果是学生看到的诊断状态、证据数量、证据摘要和证据抽屉互相矛盾，无法判断结论依据，也不符合学习陪伴对证据可追溯的要求。

## What Changes

- 让累计画像诊断使用服务端已有的受治理证据摘要生成学生安全的证据引用。
- 让累计画像诊断的 materialization 输入和状态反映其真实的累计画像来源，不再因缺少专项快照被错误标记为降级。
- 保留证据覆盖、置信度、证据截止时间和限制信息，并在证据缺失时明确显示限制而不是伪造完整引用。
- 使成长中枢顶部计数、维度卡片和证据抽屉使用同一投影口径。
- 增加有证据累计画像、缺失证据维度及无专项快照场景的回归验证。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `role-based-learning-diagnosis`: 累计画像生成的学生诊断必须提供与真实受治理证据一致的引用、覆盖和状态。

## Impact

- `src/app/api/student/competency-snapshot/route.ts` 的累计诊断投影。
- `src/features/personalization/experience/diagnosis-surface-panel.tsx` 的学生端状态与证据展示。
- 相关学生成长页面、数据治理测试和浏览器验收。
- 不改变画像计算、评分、解锁、学习路径或原始证据权限规则。

