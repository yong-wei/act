## Context

旧 worklist 只证明当时冻结快照的确定性。ActKG 新增或修订对象后，分母、profile-only 集合和证据边界都会变化。若在当前 manifest 之前预建审核 Issue，就会把历史数量和暂定批次伪装成真实调度关系。

## Goals / Non-Goals

**Goals:**

- 为最新已接纳候选生成完整、确定性、同修订的 CourseCoverage worklist。
- 明确 profile-only 和其他需强化复核的对象，保留历史决定但不继承其权威。
- 产出可由 Buddy 直接转换为 B1..Bn 子变更的精确批次 manifest。

**Non-Goals:**

- 不假定当前数量仍为 3,609 或 profile-only 仍为 1,772。
- 不在本变更内完成逐项 Primary、Challenger 或 Third 决定。
- 不生成正式 Teaching Projection，不激活 CourseCoverage 或任何消费者。

## Decisions

1. **分母来自当前候选成员闭包。** 每个可审核 Canonical 对象恰好出现一次；删除、重复或无法解释的对象使 worklist 失败。
2. **记录语义和证据身份。** 每项绑定 canonical revision、entity type、描述摘要、来源覆盖、模块、关系邻域、证据引用和 digest、Release/Delta 及 authoring revision。`canonicalRevision` 明确定义为对象语义 payload 的确定性 SHA-256：规范化的 Canonical ID、entity type、semantic/display label、description、concept kind、release tier、publication/review status 和 source coverage count；不包含生成时间、包装路径或当前审核角色/结论。
3. **历史决定只作线索。** `priorDecisionRefs` 可以帮助 reviewer 定位证据，但不能预填当前角色、结论或批准状态。
4. **批次按稳定语义键构建。** 先按模块/来源域和 entity type 形成语义块，再按 canonical ID 稳定排序并对超大块确定性分片；每个成员只属于一个批次。
5. **批次身份由内容派生。** `batchId` 和 `memberDigest` 覆盖当前 worklist digest、成员 ID/修订和审核策略。B1..Bn 只能使用 manifest 中的 ID 和成员。
6. **版本漂移整体失效。** 已接纳候选、Delta 或 authoring revision 变化时，worklist 与全部尚未完成的批次 manifest 失效，不能静默增补。
7. **输入路径和证据边界由准入身份决定。** Aggregate 与 predecessor 路径从冻结 binding/terminal Delta 的 Release、Bundle 和 projection identity 派生；ACTIVE Coverage 原件、模块来源文件集合及其派生 membership digest 均纳入 drift fingerprint，并在发布前重新构建 worklist。
8. **证据集原子发布。** 四个输出先完整序列化；新目录通过 sibling staging 后目录 rename 一次发布，已有目录只有四个文件逐字节一致时才 no-op，部分或不同输出 fail closed。Receipt/gate 同时携带受保护 Coverage 原件摘要、允许写集和 selector/writer fence 文件摘要；发布前后复核受保护路径且不改动 authority。
9. **证据来源采用显式分类和摘要语义。** 只有 `course-content/authoring/lessons/**` 与 syllabus blueprint/main 属于 independent-course；canonical metadata 与 topic lexicon 仅作为 aggregate provenance，未知来源不提升为独立课程证据。每条 evidence ref 标注 raw-bytes、selector-evidence 或 semantic-payload 语义，避免把 selector 摘要误当成原文件证明。
10. **authoringRevision 绑定实际输入原字节。** 生成器收集所有实际读取的 binding、admission/Delta/chain、派生 Release/Projection、ACTIVE Coverage、模块来源和 raw-byte 课程证据路径，逐一比较工作树摘要与 `git show <authoringRevision>:<path>`；路径集合及其摘要进入 input fingerprint 和 boundary evidence，任一旧修订漂移都 fail closed。

## Risks / Trade-offs

- [语义块过大导致单个审核变更不可交付] → 对稳定语义块设置确定性上限并按 Canonical ID 分片，同时保留块上下文摘要。
- [历史决定污染当前审核] → 输出仅包含引用和来源，不包含可直接装配为当前决定的终态字段。
- [profile-only 对象被从分母隐藏] → manifest 单列其数量、成员和强制 Challenger 策略，闭包检查覆盖总分母。
- [新 ActKG 发布使批次过期] → worklist/manifest 绑定 A 的 resolution 和 admission digest，漂移时全部失败关闭。

## Migration Plan

1. 从已接纳候选生成当前 worklist 和 assembly receipt。
2. 生成带精确成员与审核策略的 review-batch manifest，并验证并集、交集和分母。
3. 通过 Buddy propose 按 manifest 登记 B1..Bn；在全部批次关闭前保持 Coverage gate 阻断。

## Open Questions

无。最终批次数量是本变更的输出，不能在实现前预设。
