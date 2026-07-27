## Context

ReleaseSet 是完整权威知识集合，课程只使用其中受治理的子集。课程范围属于 ACT 教学治理，不应写回 ActKG 或由运行资源自动决定。

## Goals / Non-Goals

**Goals:**

- 建立 Git 作者态的课程覆盖真源。
- 明确三类课程角色和运行准入。
- 保持完整 Release 可浏览但不自动教学激活。

**Non-Goals:**

- 不建立教师在线编辑器。
- 不以资源命中或模型建议自动发布覆盖。
- 不裁剪 Release 导入内容。

## Decisions

1. Overlay 条目引用 Canonical ID、固定 Release 和课程身份，并只允许三类角色。
2. 作者态进入 Git 审核，部署时执行确定性校验并事务导入数据库；数据库投影不得回写作者态。
3. 覆盖候选与正式条目分离，候选不能参与推荐、KAQ、路径、评价或事实写入。
4. Repository 对课程消费者提供显式 coverage selector；未覆盖对象仍可在权威画布浏览。
5. Release 更新后，缺失对象、版本漂移或重复角色使 Overlay 导入关闭。

## Risks / Trade-offs

- [人工维护成本] → 首轮只维护正式课程范围，不建设复杂工作流。
- [完整图谱与课程体验不一致] → UI 区分“可浏览权威对象”和“当前课程覆盖”。
- [模型建议误激活] → 建议只生成候选文件，必须经 Git 变更审核。

## Migration Plan

先定义作者态 schema 和校验器，再建立数据库投影与覆盖查询。对当前根轨迹对象制作最小演示 Overlay，但不激活生产消费者。

## Open Questions

无。
