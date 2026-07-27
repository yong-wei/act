## Context

ACT 资源用途和 ActKG 来源证据具有不同权威。现有资源绑定旧节点数组，不能作为 Canonical 迁移依据，也不具备增量审核和版本身份。

## Goals / Non-Goals

**Goals:**

- 建立来源 Crosswalk 与教学角色绑定两个清晰层次。
- 以变化端触发的增量流程处理节点和资源变化。
- 让有效教学资源在切换前形成可审核 Canonical 身份。

**Non-Goals:**

- 不把 ACT 教学角色写回 Engineering Release。
- 不为草稿、停用、归档或非教学资产建立阻断门槛。
- 不让候选生成模型批准自己的绑定。

## Decisions

1. Crosswalk 以来源身份、EvidenceSegment identity、版本和内容哈希定位 ACT 原子片段。
2. 绑定实体记录 Canonical revision、资源片段 hash、教学角色、来源、审核状态和提示词版本。
3. 节点变化查询资源索引，资源变化查询 Canonical 索引；相同候选对合同支撑双向增量。
4. 唯一 EvidenceSegment 与唯一资源类型角色同时成立时可确定性发布。
5. 其他候选由隔离上下文 GPT 审核；争议、高影响和结论冲突进入人工队列，结构门禁始终有效。
6. 最终门禁只统计当前有效、可推荐、可入路径或可产生证据的原子资源。
7. 绑定发布状态与生产消费 selector 分离；前者可以在候选阶段完成，后者在最终一次性切换前保持 Legacy。

## Risks / Trade-offs

- [候选量过大] → 通过索引、缓存身份和变化端触发限制重算。
- [模型审核误判] → 生成与审核隔离，高影响和冲突进入人工裁定。
- [来源证据与教学用途混淆] → 分表、分类型和分权限保存两类关系。

## Migration Plan

先建立 Crosswalk 和绑定实体，再运行当前有效资源的 dry-run 清单；发布确定性绑定，审核语义候选，门禁达到完整覆盖后才允许最终切换。

## Open Questions

无。
