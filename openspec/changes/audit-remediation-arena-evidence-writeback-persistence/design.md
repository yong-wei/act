## Context

`buildArenaSubmissionEvidenceWriteback` 和报告摘要已经能判断写回状态，但后续系统需要稳定读取 Arena 证据。持久化必须解决两个问题：第一，同一个官方提交不能重复写入学习事实；第二，不能把 late/invalid/zero 或未授权上下文错误提升为有效掌握证据。

## Approach

写回链路应分三层：

1. Projection：沿用现有规则解释 attempt policy、limitations 和 KAQ 目标。
2. Materialization：accepted official attempt 通过幂等 key 写入学习证据或记录 blocked/degraded 状态。
3. Consumption：学生反馈、教师报告、证据时间线、路径规划和控灵读取同一个持久 writeback outcome。

幂等键应包含 arena publication/challenge、submission、student、artifact version 和 target KAQ refs，避免重复提交产生重复事实。duplicate-only 判定只适用于同一学生在同一发布上下文内重复提交同一 task/artifact/protocol；跨学生命中同一评测缓存仍是独立官方提交。

## Boundaries

- 不改变 Arena 评分算法；leaderboard 排名有效性继续排除 invalid/late/zero/duplicate-only 和 persisted blocked writeback。KAQ writeback outcome 是学习证据与教师报告的治理真源；历史提交或尚未绑定 KAQ 目标的有效 Arena 任务仍保留原有榜单资格，但不能被提升为终端掌握证据。
- 不把无效 attempt 写成掌握证据。
- 不依赖前端临时状态作为写回成功依据。
- 不关闭课堂 runtime 证据写回之外的课堂生命周期问题。

## Validation Strategy

- Run `openspec validate audit-remediation-arena-evidence-writeback-persistence --strict`.
- Add tests for accepted official writeback persistence, idempotency, late/zero/invalid/duplicate-only blocking, persisted reload duplicate detection, and consumer reads.
- Add evidence showing teacher report, student feedback, leaderboard, evidence timeline, learner-state/path-planning, and Konling context consume persisted outcome.
