## Context

学习事实是长期数据边界。新事实需要稳定 Canonical 身份，而旧事实必须保持原修订解释，不能通过映射账本重新解释。

## Goals / Non-Goals

**Goals:**

- 建立切换后 Canonical 新事实写入合同。
- 禁止候选 ReleaseSet 和未覆盖对象写入。
- 保持历史事实和派生状态冻结。

**Non-Goals:**

- 不回填历史 Canonical sidecar。
- 不重算历史画像、诊断、风险或班级聚合。
- 不双写 Legacy 与 Canonical 身份。

## Decisions

1. 新事实必须原子记录 Canonical ID、活动聚合 ReleaseSet/Release、projection/知识修订和既有来源身份。
2. 写入适配器验证活动权威、聚合 CourseCoverage、当前聚合资源绑定和消费者语义支持。
3. candidate 状态在类型、数据库和服务端门禁上均不可写。
4. 切换前实现以 shadow validation 验证，不产生正式 Canonical fact。
5. 历史读取按事实自己的 Legacy revision 或 snapshot 路由，不能使用当前 Canonical 图重新聚合。

## Risks / Trade-offs

- [生产者遗漏新字段] → writer inventory 和静态门禁覆盖全部正式 producer。
- [切换边界并发写入] → 停服并在同一事务切换活动 authority 与写入 selector。
- [历史和新画像混合] → 聚合按事实 identity namespace 分层，并保留版本诊断。

## Migration Plan

先扩展 schema 和固定身份 adapter，运行 producer inventory 与 shadow validation；最终变更停服后才激活 Canonical writer。

## Open Questions

无。
