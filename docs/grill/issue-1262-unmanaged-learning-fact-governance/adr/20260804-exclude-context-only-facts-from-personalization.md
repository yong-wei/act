## 背景

Issue #1262 起初以完整的 `evidenceGovernance` 作为推荐、学习者状态和 feature cache 聚合的读取门槛。该条件能够排除未治理事实，但仍会接纳显式 `profileWeight: 0` 或 `skipProfileContribution: true` 的 context-only 事实。

这些事实保留给审计与时间线下钻。若让它们进入个性化，仍会改变连续学习、最近活动、证据覆盖或资源偏好，从而间接形成个性化结论。

## 决策

`isLearningFactEligibleForPersonalization()` 是唯一的事实资格谓词。它要求治理字段完整且 `resolveLearningFactProfileWeight(contextJson) > 0`。

推荐的最近事实、最近活动、连续学习和事实覆盖；学习者状态的资源与媒体偏好；以及 feature cache 的事实计数、活动和时间窗口都使用该谓词。context-only 事实仅保留给审计和时间线读取者。

需要限定返回数量的读取，以合格事实数量为上限而非原始行数。读取者必须在 context-only 事实之后继续按游标分页，直至取得所需合格事实或数据耗尽；否则 context-only 事实仍能通过占用固定窗口间接改变个性化结果。

## 结果

即使治理字段完整，显式零权重或跳过标记也不能驱动个性化行为。已批准的正权重事实保留原有行为。本变更不修改来源事实以及审计、调试读取路径。
