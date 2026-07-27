## Context

Legacy 路径的步骤引用旧节点，ActKG 当前又未发布完整教学关系。继续执行旧路径或直接步骤映射都会混合权威。

## Goals / Non-Goals

**Goals:**

- 安全停止并归档未完成 Legacy 路径。
- 保留目标与历史解释。
- 在教学语义可用后生成独立 Canonical 路径。

**Non-Goals:**

- 不映射旧步骤。
- 不使用工程关系生成路径。
- 不重算已完成路径和历史画像。

## Decisions

1. 权威切换事务把未完成 Legacy 路径置为停止归档状态，执行记录不可变。
2. 目标或用户意图作为独立字段保留，不携带旧节点序列约束。
3. 新规划只使用当前累计画像、CourseCoverage、KAQ Canonical 绑定和已发布 Teaching Projection。
4. 新路径具有独立 identity、Canonical ID 和版本，不继承旧执行进度。
5. Teaching Projection 未满足时只显示无法再规划的明确状态，不以旧图 fallback。

## Risks / Trade-offs

- [切换时用户路径中断] → 保留目标并提供明确停止原因，教学语义就绪后生成新路径。
- [旧目标不可解析] → 进入人工可理解的未决状态，不猜测 Canonical 对象。
- [新路径与历史画像不一致] → 只读取当前累计画像，不迁移旧路径掌握度。

## Migration Plan

先实现停止/归档和目标保留，再在 Teaching Projection 测试数据上验证再规划；最终状态转换由统一切换执行。

## Open Questions

无。
