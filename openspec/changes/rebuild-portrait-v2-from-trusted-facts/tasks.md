# Tasks

## Analysis

- [x] 梳理 LearningFact 来源、Portrait v2 物化链路与路径规划消费链路
- [x] 完成 grill 文档与设计决策
- [x] 编写 OpenSpec proposal 与 specs

## Implementation

- [x] 新增 `trusted-learning-fact-filter.ts` 与版本化策略
- [x] 扩展 `PortraitLearningFactDelta` 与累计事实序列化，保留信任锚点
- [x] 将可信过滤接入 Portrait v2 物化核心与 legacy compatible snapshot
- [x] 为 `LearnerPortraitStateVersion` 增加信任追溯字段并生成 migration
- [x] 在 publishState 写入 `trustedFactIds`、`trustedFactPolicyVersion`、`trustedInputDigest`
- [x] 提升 Portrait v2 计算版本与迁移版本
- [x] learner-state service 输出可信 Portrait availability 并禁止 legacy fallback
- [x] recommendation-engine 对 NO_EVIDENCE fail closed
- [x] adaptive-learning-path-planner 对 NO_EVIDENCE fail closed

## Tests

- [x] trusted filter 单测覆盖不可信前缀、证据锚点缺失和 simulation 来源
- [x] 混合可信/非可信事实只生成可信 Portrait
- [x] 只有非可信历史事实生成 `NO_EVIDENCE`
- [x] 新增可信事实后增量更新不重新吸收旧污染事实
- [x] NO_EVIDENCE 时推荐与路径规划不读取 legacy fallback
- [x] 相同输入重复重建 digest 与 current pointer 幂等
- [x] 运行相关 Vitest
- [x] 运行 `npm run typecheck`

## Delivery

- [x] 校验 OpenSpec 文档
- [x] 创建单提交并推送到 issue 分支
- [x] 创建 target=integration 的 PR
- [x] 处理 PR review P1：trusted filter 改为正向 allowlist 并拒绝未知/缺锚点事实
- [x] 处理 PR review P2：recommendation-engine 仅跳过向量规则并保留 context-only 推荐
- [x] 在 PR 上回复 review
- [x] 执行中文 `@codex review`（Reviewed commit `77cd568c9b` 未发现重大问题）
- [x] `openspec validate rebuild-portrait-v2-from-trusted-facts --type change --strict`
- [x] `prisma validate`
- [x] `prisma generate`
- [ ] 真实 PostgreSQL migration smoke（本机无可用 PostgreSQL/pg_config，未执行）
