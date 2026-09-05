## Context

v0.37 `engineering.json` 3047 条关系均无 `prerequisite`/`follows`/`leads_to`/`provides_foundation`。领域 overlay `proj-eb4d2d63` 仅 7 条先修；课程先修 `proj-d55c3ac4` 有 139 条 RECOMMENDED 讲义边与 162 核心；课程投影 `proj-c9a6f33e` 有 891 绑定 / 300 canonical，其中 237 个落在领域概览。默认画布只读 overlay。

## Goals / Non-Goals

**Goals:**

- 一层教学投影：domain-fragments。
- 第一波分母：概览 DomainConcept ∩（绑定 ∪ 课程先修核心/端点）。
- 并入 139 条课程先修，保留原 strength/evidence。
- 按 `course-content/syllabus-refactor/blueprint.md` 单元顺序补 RECOMMENDED 扩展边，使每个领域的**内容相关**概览点弱连通。
- 资源绑定以该分母为后续增量输入。

**Non-Goals:**

- 不把 1555 个概览点全部串进默认教学顺序。
- 不从 Canonical ID 或 engineering family shard 推断顺序。
- 不在本变更扫完全部非讲义资源（#2008 增量）。
- 不切换生产 selector。

## Decisions

1. **唯一顺序真源 = domain-fragments overlay。** 课程先修出版物不再作为第二套顺序。
2. **内容相关才进分母。** 绑定或课程先修触及的概览 DomainConcept；其它概览点 coverage 可为 empty。
3. **单元顺序。** 节点取资源 `sourcePath` / 先修 `evidenceRefs` 中最早课次号；无课次的内容相关点排在该领域已排课节点之后，扩展边标记 unscheduled，不得声称是讲义顺序。
4. **139 条原样并入。** 跨域边保留。两端都在内容相关概览内的边进入默认画布。
5. **弱连通范围。** 只要求内容相关子集弱连通；无内容相关点的领域允许 empty。

## Risks / Trade-offs

- [无课次的绑定节点] → 排在领域末尾并标注 unscheduled，不冒充课程序。
- [课程先修与绑定节点重叠少] → 分母取并集。
- [与已归档工程先后修 delta 冲突] → 本修订废止「工程先后修必选骨架」。

## Migration Plan

从前任 overlay `proj-eb4d2d63` 读取 7 条已审边，并入 139 条，按课程序生成扩展边，写入新 domain-fragments release。回滚：指针拨回 `proj-eb4d2d63`。

## Open Questions

无。第一波绑定概览节点、唯一 overlay、废止工程骨架已由用户选定。
