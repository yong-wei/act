## Context

`adaptive-assessment-item-catalog` 已提供内容哈希、人工审核、阶段用途和不可变答题快照，微辅导编排也能绑定一次验证题。缺口在于：没有独立的验证用途投影证明某道现有题可用于某个规范节点/错因，也没有全量排除来源题复用的审计。

## Goals / Non-Goals

**Goals:**

- 优先复用现有受治理题目，为所有 practice-v1 链路提供独立验证候选。
- 统一验证资格、选择、学生投影和漂移语义。
- 保持一个干预实例只绑定一个不可变验证题和一次结果。

**Non-Goals:**

- 不创建第二套题库或按来源题复制验证题。
- 不允许模型临时生成正式验证题。
- 不改变验证结果对掌握度和正式路径的影响。

## Decisions

1. **目录与 `AdaptiveAssessmentItemRef` 是题目 authority。** 新 validation registry 是派生用途投影，引用 catalog item id、内容哈希、review/baseline/version 和学生安全 question ref。
2. **资格由显式 validation binding 决定。** `remediation` 或 `checkpoint` 阶段只是候选来源，不自动授权微辅导验证；人工审核必须确认学习目标、`kn:` 节点、错因、难度和用途。
3. **独立性同时比较题目 ID 与内容哈希。** 任一相同即排除，防止重命名或复制内容冒充独立验证。
4. **先库存审计，后补题。** 对现有 27 道 remediation 及其他已批准题执行候选审计；仅对仍为空的节点/错因单元制作最小必要题目。
5. **服务端确定性选择并封存。** 编排根据受控候选集合、来源题和稳定排序选择一次；客户端不能替换，内容变化产生 `REFERENCE_DRIFT`。

## Risks / Trade-offs

- [题目表面不同但考查路径相同] → 人工审核除 ID/hash 外记录变式独立性 rationale。
- [复用现有题导致验证题池过窄] → 报告每题复用率和节点候选数；不足时保留显式限制。
- [验证载荷泄露答案] → 学生投影只含答题必要字段，答案和教师说明仅服务端读取。

## Migration Plan

1. 生成现有题库验证候选和缺口报告。
2. 人工批准绑定并补齐必要题目，发布 versioned registry。
3. 将编排和覆盖报告切到 registry；旧已开始干预继续使用其不可变快照。
4. 严格模式通过前不移除既有少量验证配置；回滚只停止新 registry 选择。

## Open Questions

- 是否需要为候选复用率设置硬上限，由库存审计结果在实现前确定并记录。
