# Issue #1296 决策记录

## 问题

客户端互动事件可将 `competencyContribution` 直接写入 LearningFact，并被 Portrait v2 消费。仅过滤该字段不足以消除风险，因为事件类型静态映射仍可形成能力贡献。

## 证据

- HTTP 入口为 `POST /api/interactive/events`，其 payload 经 `toLearningEvent` 原样进入 LearningFact 物化。
- `resolveCompetencyContribution` 的解析优先级为 payload、派生指标、事件类型静态映射。
- `mapLearningFactsToPortraitEvidence` 直接读取 LearningFact 的能力贡献形成画像证据。
- 自适应测评在服务端持久化答案并完成治理核验后调用同一物化模块；教师审核直接写入已审核事实。

## 决策过程

### 执行环境

结论：使用隔离工作树。

理由：当前源工作树包含无关的未提交修改；P0-01 需要独立分支、提交和面向 `integration` 的 PR。

### 历史数据

结论：不处理历史客户端污染事实。

理由：Issue #1296 的目标是阻断未来客户端注入。历史修复需要识别受影响事实、确定撤销或重建策略并验证 Portrait v2 回算结果，超出本 Issue 的最小修改范围。

## 已确认的实现边界

- 在 LearningFact 物化边界默认拒绝客户端能力贡献。
- 使用不可由 HTTP 序列化伪造的服务端内存授权标记。
- 仅服务端已核验自适应测评显式获得该资格；教师审核直接写回保持不变。
- 不修改 HTTP 请求或响应字段，不修改数据库结构，不改变普通互动事件记录。
