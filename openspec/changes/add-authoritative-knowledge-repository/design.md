## Context

Release 接入完成后，消费者仍缺少统一读取边界。候选内容必须可运行验证，又不能因默认展示或查询为空而成为活动生产权威。

## Goals / Non-Goals

**Goals:**

- 建立数据库唯一运行读取边界。
- 隔离 candidate、active 和 legacy 状态。
- 提供三个最小、版本化、可测试投影。

**Non-Goals:**

- 不迁移现有消费者。
- 不提供文件 fallback 或万能 DTO。
- 不切换活动知识版本。

## Decisions

1. `AuthoritativeKnowledgeRepository` 接收明确 ReleaseSet selector，不通过“最新”或空值猜测状态。
2. Repository 查询只访问事务导入后的数据库行；原始 Release 仅供审计和往返验证。
3. `act.canvas.v2` 只承载画布所需类型化节点、关系和图例；`act.node-detail.v2` 提供角色分层详情；`act.migration-review.v1` 提供接入、归档和消费者重绑审计。
4. 投影响应携带 ReleaseSet identity 与 projection version，缓存键不能跨候选和活动状态复用。
5. 不支持的消费者语义与“能够无损保存”分开登记，避免未知类型自动进入业务计算。

## Risks / Trade-offs

- [投影过度膨胀] → 每个投影声明字段边界，后续消费者按真实需求新增 Profile。
- [候选被误用为活动权威] → Repository selector、类型和测试均区分 candidate 与 active。
- [文件与数据库漂移] → 运行时拒绝文件 fallback，漂移只由接入审计报告。

## Migration Plan

先实现 Repository 和投影单元测试，再对当前候选 ReleaseSet 生成确定性摘要。旧图 API 保持原读取路径，直到后续消费者逐项迁移。

## Open Questions

无。
