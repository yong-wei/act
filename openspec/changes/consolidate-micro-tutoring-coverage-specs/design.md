## Context

#1391 的实现 change `add-micro-tutoring-coverage-audit-gate` 仍位于活动目录，任务已经完成；#1392 的归档创建了同名 canonical spec，但只包含后续的选项级归因要求。直接手写 canonical spec 会绕过 OpenSpec 归档来源，直接归档 #1391 又无法解释当前系列状态漂移，因此需要一个可审计的整理 change。

## Goals / Non-Goals

**Goals:**

- 让 #1391 的完整增量通过标准归档进入 canonical spec。
- 保留 #1392 已归档要求并补齐 Purpose。
- 为以后归档建立“已完成实现、正式规范、Issue 状态一致”的可验证要求。

**Non-Goals:**

- 不改变审计实现、54 题基线或 108 错误选项口径。
- 不重新实现或重新审核 #1391/#1392。
- 不在此 change 中完成 #1393–#1396。

## Decisions

1. **先归档原 #1391 change，再归档本整理 change。** `openspec archive add-micro-tutoring-coverage-audit-gate` 负责把既有四项完整要求合并进 canonical spec；本 change 只增加治理一致性要求，避免复制相同增量造成重名冲突。替代方案是直接编辑 canonical spec，但会失去标准归档 lineage。
2. **不修改历史归档目录。** #1392 的归档工件保持不可变；修正发生在当前 canonical spec 和尚未归档的 #1391 change 上。
3. **Issue 对账以 GitHub 当前事实为准。** #1390 的子项状态和原生父子关系在 proposal 注册阶段修复；OpenSpec 只规定归档验收，不把 Issue 编号写成运行时依赖。

## Risks / Trade-offs

- [两个 change 依次归档可能产生要求重名] → 在归档前严格验证 canonical spec 中不存在 #1391 的四个要求，并按固定顺序执行。
- [整理工作被误认为运行时清场] → 提案和 Issue 明确本 change 只修复规范 authority，不代表 54/54 已完成。

## Migration Plan

1. 验证旧 change 任务全完成、当前 canonical spec 仅包含 #1392 增量。
2. 归档旧 change并严格验证 `micro-tutoring-coverage-audit`。
3. 补齐 canonical Purpose，完成本 change 的一致性检查。
4. 归档本 change；若任一步失败，保留两个活动目录和原 canonical spec，不进行部分手写合并。

## Open Questions

无。
