# Proposal: Land cold-start evidence collection

## Why

新用户和证据不足的学习者没有可靠的掌握度、学习能力或资源偏好事实。现有冷启动只按证据计数二分，starter path 也缺少按维度的诚实限制；一次点击、打开页面或聊天声明若被当成高置信个性化依据，会污染路径解释和后续效果评估。

## What Changes

- 按知识掌握、学习能力、资源偏好和证据新鲜度分别判断不足，而不是只看总证据数为 0。
- 为缺失维度提供受治理采集活动（短诊断、资源试学、短仿真），记录来源、时间、质量、置信度和适用范围。
- 采集结果只影响后续“新建学习路径”；继续原路径必须恢复生成时快照。
- 点击、打开页面、聊天声明和未完成活动不得形成高置信偏好或直接提升 mastery。
- 学生可见限制说明使用客户端安全文案，不把服务端批次或 learner-state 实现细节带进浏览器包。

## Capabilities

### New Capabilities

- `cold-start-evidence-collection`: 冷启动证据不足分维、受治理采集、质量评估与渐进个性化边界。

### Modified Capabilities

无。复用既有 starter path、learner-state 权威边界和 `personalized-path-decision-evidence` 冻结快照，不新增个人中心画像字段，不引入第二套评分或考试系统。

## Impact

- 新增采集投影与学生可见限制文案
- 自适应练习页冷启动/证据不足表面展示分维限制和采集活动
- 新建路径决策证据记录采集带来的可解释变化
- 不改写历史路径、掌握度权威或 Arena 正式成绩
