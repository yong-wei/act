## Context

`MicroInterventionOutcome` 已保存一次独立验证的不可变结果，并明确不直接更新掌握度或正式路径。平台已有 LearningFact、质量权重、Canonical 知识身份、可重放 mastery 和路径规划合同，因此合适的接入点不是在提交验证时同步改分，而是生成受治理的证据投影。

## Goals / Non-Goals

**Goals:**

- 将独立验证结果转成可重放、可撤销、带质量和身份的候选学习事实。
- 让 mastery 与 path 通过既有治理边界消费该投影。
- 保留参与事件、AI 提示与学习证明之间的权威差异。

**Non-Goals:**

- 不改写历史干预、答案或 LearningFact。
- 不把资源打开、完成标记、提示请求或单次通过直接解释为掌握。
- 不绕过 readiness、checkpoint 或 terminal-validation 门禁。

## Decisions

1. **使用 append-only evidence projection/outbox。** 验证提交事务只写 outcome；独立 projector 读取封存结果和当前治理身份，幂等地产生证据。替代方案是在 API 内同步改 mastery，但会耦合失败、重试和历史重算。
2. **参与事件权重为零。** resource opened、action completed、hint requested 仅作为 context-only facts；独立验证通过/失败可产生 assessment-backed evidence，但初始权重保守且不能单独确认终结性掌握。
3. **证据包络绑定完整 lineage。** 至少包含 learner/course、learning goal、canonical node、Authority/Projection/resource identity、source answer、intervention、validation item/content hash、capture revision、算法版本和发生时间。
4. **mastery 只消费可重放投影。** 相同输入和算法必须得到相同 posterior；重复干预、时间衰减、相互冲突和 stale identity 按版本化策略处理并暴露 limitation。
5. **path 使用证据摘要而非原始答案。** planner 读取 confidence/freshness/limitations；低置信度只能触发补救或再验证，不能跳过正式阶段。
6. **隐私与聚合分层。** 私有证据保留内部引用，学生投影和公开报告不含答案、提示正文、用户标识或可逆 option 引用；小样本按独立学习者抑制。

## Risks / Trade-offs

- [双重计算既有答题和微干预验证] → 用 source lineage 和 evidence kind 去重，明确同一次验证只产生一个 profile-grade 候选。
- [过早提高 mastery] → 初始政策保守、单次通过有上限，terminal mastery 仍需独立阶段证据。
- [图谱或 Teaching Projection 漂移] → projector 在写入前核验当前 active identity；不一致进入 drift ledger，不创建部分事实。
- [异步投影延迟] → UI 区分 outcome 已保存与 learner model 已重算，不在同步响应伪造更新。

## Migration Plan

1. 新增影子 projector 和审计报告，只读取新产生的 outcome，不回填历史。
2. 在 production-like PostgreSQL 验证幂等、重放、冲突、漂移和隐私边界。
3. 先向 mastery/path 提供对照摘要但不参与决策，完成校准后由 feature flag 启用权重。
4. 回滚关闭 projector/consumer selector；保留 outcome 和已写入事实的不可变审计记录，并通过算法版本重算排除其贡献。

## Open Questions

- 质量权重和重复验证间隔需要基于真实分布校准；规范只固定上限、证据等级和可重放要求，不预设具体数值。
