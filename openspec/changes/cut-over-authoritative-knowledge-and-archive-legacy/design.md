## Context

最终切换同时涉及数据库、应用、worker、scheduler、全部知识消费者和不可逆的新事实身份。旧图仍需解释历史和保存用户笔记，但不能继续成为业务运行时。

## Goals / Non-Goals

**Goals:**

- 以最新生产数据完成可重复本地演练。
- 在停服窗口一次性切换所有消费者和 Canonical 写入边界。
- 保留权限受控的固定 Legacy Archive。

**Non-Goals:**

- 不建设在线双写、逐消费者生产切换或开放后的旧权威回滚。
- 不在服务器首次试跑迁移。
- 不让 Legacy Archive 提供业务 API 或 AI 能力。

## Decisions

1. Cutover Gate 要求标准 Bundle 兼容、候选导入、ReleaseSet Delta、语义治理、其余消费者变更、完整课程 Release/Teaching Projection、有效资源绑定和所有消费者验收全部通过；工程型 ReleaseSet 不等同于完整课程 Teaching Projection。
2. 正式前导出最新生产数据库，在本地恢复并运行相同应用修订、Schema、ReleaseSet、Overlay、迁移和冒烟。
3. Legacy Archive 固定保存旧节点、关系、修订、路径和节点笔记；沿用旧内容权限，个人笔记仅所有者可见，管理员可审计。
4. 生产停服应用、worker、scheduler 后备份，再运行同一迁移；活动 authority 与 Canonical writer selector 在事务内同时切换。
5. 冒烟通过才恢复服务。恢复前可恢复旧数据库和旧应用；一旦产生 Canonical 事实，只允许再次停服前向修复。
6. 切换后主图移除旧版入口，旧 DTO、业务 API 和运行读取退役；归档使用独立只读合同。
7. 资源、RAG、KAQ、SAR、路径和事实写入的 authority selectors 与活动 ReleaseSet 在同一事务中统一激活。
8. 收藏、布局和最近访问等绑定 Legacy ID 的界面状态按旧图退役范围重置，不建立 Canonical 映射。

## Risks / Trade-offs

- [真实数据异常阻断迁移] → 最新生产导出本地演练并保留逐项失败报告。
- [切换后新事实阻止回滚] → 开放前完成全部冒烟，开放后明确采用前向修复。
- [归档权限泄露] → 复用原授权投影，单独验证笔记 owner-only 和管理员审计。
- [停服时间超预算] → 本地记录迁移 p95 与数据规模，发布前据此制定窗口。

## Migration Plan

冻结应用修订与 ReleaseSet，导出并本地演练；安排停服、备份、迁移、事务切换和冒烟；成功后开放并监控 Canonical writer。失败且尚未开放写入时恢复备份和旧应用。

## Open Questions

无。
