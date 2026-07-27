## Context

KAQ 是 ACT 的教学与能力治理图，ActKG 是工程知识权威。二者需要显式连接，但不能合并本体或继续复用旧知识节点身份。

## Goals / Non-Goals

**Goals:**

- 建立 KAQ 知识角色到 Canonical Object 的版本化绑定。
- 保留 KAQ 对能力、素养、目标和运行教学语义的所有权。
- 为未来 Teaching Projection 接管知识—知识关系提供迁移边界。

**Non-Goals:**

- 不删除 KAQ。
- 不从工程关系推断先修、包含或关联。
- 不迁移历史学习事实。

## Decisions

1. 绑定实体记录 KAQ role ID、Canonical ID、Release、绑定角色、证据和审核状态。
2. 绑定依据 KAQ 语义重新审核，不从 Legacy ID 或同名节点继承。
3. CourseCoverage 限制可进入当前课程 KAQ 的 Canonical 对象。
4. ActKG Teaching Projection 发布后成为知识—知识教学关系权威；KAQ 继续拥有知识—能力—素养关系。
5. 冲突关系进入一次性审核，确认 ActKG 关系后退役对应 KAQ 旧关系，规划器不得并行消费冲突版本。
6. KAQ authority selector 只在最终停服事务中与其他正式消费者一起切换，绑定完成不能局部激活。

## Risks / Trade-offs

- [一对多或多对一语义] → 允许显式多绑定及角色，不以单一映射强制压缩。
- [Teaching Projection 尚未可用] → 先迁移身份和保留现有 KAQ 教学关系，禁止伪造上游语义。
- [冲突形成路径环] → 关系接管前运行循环和一致性门禁。

## Migration Plan

先生成 KAQ 绑定候选和审计，再发布已审核绑定。Teaching Projection 到达后单独执行冲突迁移与规划器切换验证。

## Open Questions

无。
